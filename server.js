const Blockchain = require('./classes/blockchain');
const Transaction = require('./classes/transaction');
const Block = require('./classes/block');

const mongoose = require("mongoose");
const bodyParser = require('body-parser')
const express = require("express");
const app = express();

const expressConfig = require('./config/express');
const mongodbConfig = require('./config/mongodb');

mongoose.connect(mongodbConfig.connectionString);

const blockchain = new Blockchain();

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true,
    limit: 52428800,
    parameterLimit: 10000,
}));


app.post("/pending", (req,res) => {
    new Transaction(req.body).save();
    res.send("added");
});

app.get("/pending", (req,res) => {
    Transaction.find({},(err,pendingTransactions) => {
        if(err) {
            res.status(400).json({error: "Something went wrong"});
        }
        res.json(pendingTransactions);
    });
});

app.get("/balance/:walletId", (req,res) => {
    blockchain.getBalanceOfAddress(req.params.walletId)
    .then((balance) => {
        res.send(balance);
    })
    .catch(error => {
        res.status(400).json({error: "Something went wrong"});
    })
})

app.get("/", (req,res) => {
    Block.find({}, (err,blocks) => {
        if(err) {
            res.status(400).json({error: "Something went wrong"});
        }
        res.json(blocks)
    });
})

app.listen(expressConfig.port);
