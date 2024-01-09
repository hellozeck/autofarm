import fs from 'fs';
import Web3 from "web3";

// 使用适当的Web3提供者初始化Web3实例
const provider = new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/');
const web3 = new Web3(provider);

// 生成私钥和地址的方法
function generateWallets(numWallets) {
    const wallets = [];
    const privateKeys = [];
    const addresses = [];

    for (let i = 0; i < numWallets; i++) {
        // 生成私钥
        const wallet = web3.eth.accounts.create();
        wallets.push(wallet);
        privateKeys.push(wallet.privateKey);
        // address 为小写
        addresses.push(wallet.address.toLowerCase());
    }

    // 将私钥写入privatekeys.csv文件
    const privateKeysCSV = privateKeys.join('\n');
    fs.writeFileSync('privatekeys.csv', privateKeysCSV);

    // 将地址写入address.csv文件
    const addressesCSV = addresses.join('\n');
    fs.writeFileSync('address.csv', addressesCSV);

    console.log('Private keys saved to privatekeys.csv');
    console.log('Addresses saved to address.csv');
}

// 调用方法生成钱包
generateWallets(5);
