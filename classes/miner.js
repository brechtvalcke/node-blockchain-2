const blockchainConfig = require('../config/blockchain');
const minerConfig = require('../config/miner');
const mongodbConfig = require('../config/mongodb');

const Blockchain = require('./blockchain');
const Transaction = require('./transaction');
const Block = require('./block');

const mongoose = require('mongoose');
mongoose.connect(mongodbConfig.connectionString);

const blockchain = new Blockchain();

module.exports = class Miner {

    constructor() {
        this.startMiningCycle();
    }

    startMiningCycle() {
        blockchain.getChain().then((chain) => {
            this.selectOptimalTransactionsToMine().then((transactionsToConfirm) => {
                const latestBlock = chain[chain.length - 1];
                blockchain.mineTransactions(minerConfig.minerWalletId, transactionsToConfirm, latestBlock)
                .then((res) => {
                    this.startMiningCycle();
                }).catch(error => {
                    this.handleErrorDuringMining(error);
                })

            }).catch(error => {
                this.handleErrorDuringMining(error);
            })
        }).catch(error => {
            this.handleErrorDuringMining(error);
        })
    }

    handleErrorDuringMining(error) {
        console.log(error);
        this.startMiningCycle();
    }

    selectOptimalTransactionsToMine() {
        return new Promise((resolve, reject) => {
            Transaction.find({}, (err,res) => {
                if(err) {
                    reject(err);
                }
                resolve(res);
            });
        });
    }

}
