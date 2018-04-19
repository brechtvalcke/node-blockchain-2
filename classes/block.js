const SHA256 = require("crypto-js/sha256");
const blockchainConfig = require('../config/blockchain');
const mongoose = require("mongoose");

const Transaction = require("./transaction");

const blockSchema = new mongoose.Schema({
    index: {type: Number, unique : true, dropDups: true},
    previousHash: String,
    timestamp: {type: Date, default: Date.now},
    transactions: [{
        _id: String,
        fromAddress: String,
        toAddress: String,
        amount: Number,
    }],
    hash: String,
    difficulty: {type: Number, default: 0},
    nonce: {type: Number, default: 0},
});

blockSchema.methods.calculateHash = function() {
    return SHA256(this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce).toString();
}


blockSchema.statics.mineBlock = (difficulty, block) => {
    block.difficulty = difficulty;
    while (block.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
        block.nonce++;
        block.hash = block.calculateHash();
    }
    block.timestamp = new Date();
    return block;
}

blockSchema.methods.hashMatchesDifficulty = function() {
    const hashInBinary = hexToBinary(this.hash);
    const requiredPrefix = '0'.repeat(this.difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};

module.exports = mongoose.model('block',blockSchema);