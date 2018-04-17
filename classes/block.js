const SHA256 = require("crypto-js/sha256");
const blockchainConfig = require('../config/blockchain');
module.exports = class Block {
    constructor(timestamp, transactions, previousHash = '') {
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.hash = this.calculateHash();
        this.difficulty = blockchainConfig.startDifficulty;
        this.nonce = 0;
    }

    calculateHash() {
        return SHA256(this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce).toString();
    }

    mineBlock(difficulty) {
        
        while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
            this.nonce++;
            this.hash = this.calculateHash();
            this.difficulty = difficulty;
            this.timestamp = new Date();
        }
        console.log("BLOCK MINED: " + this.hash);
    }

    hashMatchesDifficulty() {
        const hashInBinary = hexToBinary(this.hash);
        const requiredPrefix = '0'.repeat(this.difficulty);
        return hashInBinary.startsWith(requiredPrefix);
    };


}