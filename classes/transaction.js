const SHA256 = require("crypto-js/sha256");
const blockchainConfig = require('../config/blockchain');
const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
    fromAddress: String,
    toAddress: String,
    amount: Number,
});

module.exports = mongoose.model("Transaction", transactionSchema);
