import swap from './swap.js';

// 定义完成Task的函数
async function complateTradejoeTask(privateKey) {
    return swap(privateKey);
}

export default complateTradejoeTask;