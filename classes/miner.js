var request = require('request');   

const minerConfig = require('../config/miner');
const expressConfig = require('../config/express');

const Blockchain = require('./blockchain');
const Transaction = require('./transaction');
const Block = require('./block');

const blockchain = new Blockchain(true);

module.exports = class Miner {

    constructor() {
        this.startMiningCycle();
    }

    startMiningCycle() {
        blockchain.getChain().then((chain) => {
            this.selectOptimalTransactionsToMine().then((transactionsToConfirm) => {
                blockchain.mineTransactions(minerConfig.minerWalletId, transactionsToConfirm, chain)
                .then((block) => {

                    // ask interface to broadcast freshly mined block
                    request.post('http://localhost:' + expressConfig.port + "/blockMined", {token: minerConfig.minerToken, block: block}, (err,httpResponse,body) => {
                        if(err){
                            this.handleErrorDuringMining(err);
                        }

                        this.startMiningCycle();
                    })
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
