import fs from 'fs';
import Web3 from "web3";
import axios from 'axios';
import HttpsProxyAgent from 'https-proxy-agent';
import complateTradejoeTask from './tradejoe/tradejoe.js';

const web3 = new Web3('https://arb-mainnet.g.alchemy.com/v2/T9w5ZTTRbEjSkQqtPHE-FLQTKGMHUFA_');

const questFactoryContractAddress = '0x52629961f71c1c2564c5aa22372cb1b9fa9eba3e';
const abi = JSON.parse(fs.readFileSync('claimCompressed.json', 'utf8'));
const contract = new web3.eth.Contract(abi, questFactoryContractAddress);

// 替换 proxyHost 和 proxyPort 为实际的代理服务器主机和端口
// const proxyHost = '127.0.0.1';
// const proxyPort = '1087';
// const proxyUrl = `http://${proxyHost}:${proxyPort}`;
// const tunnelingAgent = new HttpsProxyAgent(proxyUrl);
// const isProxy = false;

async function fetchMintReceipt(questId, address, referrerAddress) {
    const url = 'https://api.rabbithole.gg/quest/mint-receipt';
    try {
        const response = await axios.post(url, {
            questId,
            address,
            referrerAddress,
        }, {
            headers: {
                'Content-Type': 'application/json',
            },
            // httpsAgent: tunnelingAgent,
            // proxy: isProxy,
        });
        const data = response.data;
        console.log('Success:', data);

        return { compressedBytes: data.compressedBytes, fee: data.fee };

    } catch (error) {
        console.log('Error:', error);
    }
}

async function claim(account, questId, referrerAddress) {
    const privateKey = account.privateKey;
    const fromAddress = account.address;
    const data = await fetchMintReceipt(questId, fromAddress, referrerAddress);
    const claimCompressed = data.compressedBytes;
    const fee = data.fee;
    const transactionData = contract.methods.claimCompressed(claimCompressed).encodeABI();

    const gasPrice = await web3.eth.getGasPrice();

    // const gasLimit = await contract.methods.claimCompressed(claimCompressed).estimateGas({});
    //暂时先写死一个值
    const gasLimit = 3105341;
    const signedTransaction = await account.signTransaction({
        from: fromAddress,
        to: questFactoryContractAddress,
        data: transactionData,
        value: fee,
        gas: gasLimit,
        gasPrice,
    }, privateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTransaction.rawTransaction);
    return receipt.blockHash;
}


// 判断是否可以领取
async function checkIfRedeemable(fromAddress, questId) {
    const url = `https://api.rabbithole.gg/v1.3/quest/${fromAddress}/${questId}`;
    try {
        const response = await axios.get(url, {
            // httpsAgent: tunnelingAgent,
            // proxy: isProxy,
        });
        const status = response.data.status;
        console.log('status:', status);
        if (status === 'redeemable') {
            return true;
        }
    } catch (error) {
        console.log('Error:', error);
        return undefined;
    }
    return false;
}

async function checkEligibility(fromAddress, questId) {
    const url = `https://api.rabbithole.gg/v1.3/quest/${fromAddress}/${questId}`;
    console.log('url:', url);
    try {
        const response = await axios.get(url, {
            // httpsAgent: tunnelingAgent,
            // proxy: isProxy,
        });
        const data = response.data;
        return data.eligibility.eligible;
    } catch (error) {
        console.log('Error:', error);
        return undefined;
    }
}

async function checkIfCompleted(fromAddress, questId) {
    const url = `https://api.rabbithole.gg/v1.3/quest/${fromAddress}/${questId}`;
    try {
        const response = await axios.get(url, {
            // httpsAgent: tunnelingAgent,
            // proxy: isProxy,
        });
        return response.data.status === 'completed';
    } catch (error) {
        console.log('Error:', error);
        return undefined;
    }
}

async function doTask(privateKey, taskName) {
    let result;
    switch (taskName) {
        case 'tradejoe':
            result = await complateTradejoeTask(privateKey);
            break;
        default:
            break;
    }
    return result;
}

const referrerAddress = '0xcD01A3acED67e266be21117376C7025B384Cd4d7';
const questIdMap = { '34d8a551-768b-4029-aa5b-ce537ade1208': 'tradejoe' };

// 遍历questIdMap，依次执行任务
for (const [questId, taskName] of Object.entries(questIdMap)) {
    console.log('start to process quest:', questId);
    const privateKeyFile = fs.readFileSync('privatekeys.csv', 'utf8');
    const privateKeys = privateKeyFile.split('\n');
    // 遍历执行任务
    for (let i = 0; i < privateKeys.length; i++) {
        const privateKey = privateKeys[i].trim();
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const fromAddress = account.address;
        const isComplated = await checkIfCompleted(fromAddress, questId);
        console.log('isComplated:', isComplated);
        if (isComplated) {
            console.log(fromAddress + ' quest is completed, skip');
            continue;
        }
        const isEligibility = await checkEligibility(fromAddress, questId);
        console.log(fromAddress + ' isEligibility:', isEligibility);
        if (isEligibility === undefined) {
            console.log('checkEligibility failed ' + fromAddress);
            continue;
        } else if (!isEligibility) {
            console.log(fromAddress + 'is not eligible ');
            oontinue;
        }
        doTask(privateKey, taskName);
        // 等待30秒
        await new Promise(resolve => setTimeout(resolve, 30000));
        let redeemable = await checkIfRedeemable(fromAddress, questId);
        if (redeemable === undefined) {
            console.log('canClaim failed ' + fromAddress);
            continue;
        } else if (redeemable) {
            const result = await claim(account, questId, referrerAddress);
            if (!result) {
                console.log(fromAddress + 'cliam failed');
                continue;
            }
            console.log(fromAddress + 'cliam success');
        }
        const isTaskSuccess = false;
        while (redeemable) {
            if (isTaskSuccess) {
                const taskHash = doTask(privateKey, taskName);
                // 如果 taskHash 不是 undefined，说明任务执行成功
                if (taskHash) {
                    console.log(fromAddress + 'doTask success');
                    isTaskSuccess = true;
                } else {
                    console.log(fromAddress + 'doTask failed');
                    break;
                }
            }
            // 等待30秒
            await new Promise(resolve => setTimeout(resolve, 30000));
            redeemable = await checkIfRedeemable(fromAddress, questId);
            if (!redeemable) {
                console.log(fromAddress + 'quest is completed');
                continue;
            }
        }
    }
}
