import fs from 'fs';
import Web3 from "web3";

const provider = new Web3.providers.HttpProvider('https://arbitrum-mainnet.infura.io/v3/762868e9a5954a2cb3013ffea75e6759');
const web3 = new Web3(provider);

const LBFactoryContractAddress = '0x8e42f2F4101563bF679975178e880FD87d3eFd4e';
const LBFactoryAbiFile = fs.readFileSync('tradejoe/LBFactory.json');
const LBFactory = new web3.eth.Contract(JSON.parse(LBFactoryAbiFile), LBFactoryContractAddress);

const LBRouterContractAddress = '0xb4315e873dbcf96ffd0acd8ea43f689d8c20fb30';
const LBRouterAbiFile = fs.readFileSync('tradejoe/LBRouter.json');
const LBRouter = new web3.eth.Contract(JSON.parse(LBRouterAbiFile), LBRouterContractAddress);

// 构造交易对象
async function swap(privateKey) {
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const fromAddress = account.address;

    const tokenA = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    const tokenB = '0x912CE59144191C1204E64559FE8253a0e49E6548';
    const binStep = 10;

    const lbPairInformation = await LBFactory.methods.getLBPairInformation(tokenA, tokenB, binStep).call();

    console.log('lbPairInformation:', lbPairInformation);

    const pairAddress = lbPairInformation[1];
    console.log('pairAddress:', pairAddress);

    const amountIn = web3.utils.toWei("0.00000000001", "ether");
    const amountOut = await LBRouter.methods.getSwapOut(pairAddress, amountIn, true).call();
    console.log('amountIn:', amountIn);
    console.log('amountOut:', amountOut);

    const slip = 0.07; // 7%
    const amountOutMin = Math.floor(amountOut[1].toString() * (1 - slip)); // 向下取整
    console.log("amountOutMin", amountOutMin);

    const versions = [2];
    const tokenPath = [
        tokenA, tokenB
    ];

    const currentTimeStamp = Math.floor(Date.now() / 1000);
    const deadline = currentTimeStamp + 30;
    console.log('deadline:', deadline);
    const pairBinSteps = [binStep]

    const path = {
        pairBinSteps,
        versions,
        tokenPath
    };
    console.log('path:', path);
    const txObject = await LBRouter.methods.swapExactNATIVEForTokens(
        amountOutMin,
        path,
        fromAddress,
        deadline
    );
    const gasPrice = await web3.eth.getGasPrice();
    console.log('gasPrice:', gasPrice);

    //暂时先写死gasLimit
    const gasLimit = 4000000;
    const txParams = {
        from: fromAddress,
        to: LBRouterContractAddress,
        gas: gasLimit,
        gasPrice: gasPrice,
        value: amountIn,
        data: txObject.encodeABI()
    };
    console.log('txParams:', txParams);

    web3.eth.accounts.signTransaction(txParams, privateKey)
        .then(signedTx => {
            // 发送交易
            web3.eth.sendSignedTransaction(signedTx.rawTransaction)
                .on('transactionHash', hash => {
                    console.log('Transaction hash:', hash);
                    return hash;
                })
                .on('error', error => {
                    console.error('Transaction error:', error);
                    return undefined;
                });
        })
        .catch(error => {
            console.error('Signing error:', error);
            return undefined;
        });
}


export default swap;