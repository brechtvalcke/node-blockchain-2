const blockchainConfig = require("./blockchain");
module.exports = {
    refreshTransactionInterval: blockchainConfig.blockGenerationInterval / 2,
    minerWalletId: "miner-wallet",
}