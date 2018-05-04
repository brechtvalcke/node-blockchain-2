const Blockchain = require('./classes/blockchain');
const Transaction = require('./classes/transaction');
const Block = require('./classes/block');

const mongoose = require("mongoose");
const bodyParser = require('body-parser')
const express = require("express");
const app = express();

const expressConfig = require('./config/express');
const mongodbConfig = require('./config/mongodb');
const minerConfig = require('./config/miner');

mongoose.connect(mongodbConfig.connectionString);

const blockchain = new Blockchain();

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true,
    limit: 52428800,
    parameterLimit: 10000,
}));

// add pending transaction to be confirmed
app.post("/pending", (req,res) => {
    const transaction = new Transaction(req.body).save();
    blockchain.broadCastTransaction(transaction);
    res.send("added");
});

// get all pending transactions
app.get("/pending", (req,res) => {
    Transaction.find({},(err,pendingTransactions) => {
        if(err) {
            res.status(400).json({error: "Something went wrong"});
        }
        res.json(pendingTransactions);
    });
});

// check the balance of a certain wallet
app.get("/balance/:walletId", (req,res) => {
    blockchain.getBalanceOfAddress(req.params.walletId)
    .then((balance) => {
        res.send(balance);
    })
    .catch(error => {
        res.status(400).json({error: "Something went wrong"});
    })
});

app.get("/blockMined", (req,res) => {
    if(req.body.token !== minerConfig.minerToken) {
        res.status(400).json({error: "Token invalid"});
        return;
    }
    const minedBlock = req.body.block;
    blockchain.addblockToChain(block, true);
    res.json({succes: "block broadcasted"});
})

// return the full blockchain in json format
app.get("/", (req,res) => {
    Block.find({}, (err,blocks) => {
        if(err) {
            res.status(400).json({error: "Something went wrong"});
        }
        res.json(blocks)
    });
});

app.listen(expressConfig.port,() => {
    console.log("server started on port: " + expressConfig.port);
});
