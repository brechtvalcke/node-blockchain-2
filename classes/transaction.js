const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
    fromAddress: String,
    toAddress: String,
    amount: Number,
    creationDate: {type: Date, default: Date.now}
});

module.exports = mongoose.model("Transaction", transactionSchema);
