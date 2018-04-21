const Block = require('./block');
const Transaction = require('./transaction');
const blockchainConfig = require('../config/blockchain');

module.exports = class Blockchain {
    constructor() {
        this.createGenesisBlockIfEmpty()
        this.difficulty = blockchainConfig.startDifficulty;
        this.miningReward = blockchainConfig.miningReward;
    }

    getChain() {
        return new Promise((resolve, reject) => {
            Block.find({}, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        })
    }

    createGenesisBlockIfEmpty() {
        this.getChain().then((res) => {
            if (res.length === 0) {
                const genesisBlock = new Block({
                    previousHash: "",
                    timestamp: new Date(2018, 1, 1, 0, 0, 0, 0),
                    transactions: [],
                    difficulty: 0,
                    nonce: 0,
                    index: 0,
                })
                genesisBlock.hash = genesisBlock.calculateHash();
                genesisBlock.save();
            }
        })
    }

    addblockToChain(block) {
        return new Promise((resolve, reject) => {
            this.getChain().then((chain) => {
                block.save().then((res) => {
                    // -1 genesis block telt niet mee
                    if ((chain.length - 1) % blockchainConfig.difficultyAdjustmentInterval === 0) {
                        this.difficulty = this.getAdjustedDifficulty(chain);
                    }
                    resolve(true);
                }).catch(error => {
                    reject(error);
                });
            }).catch(error => {
                reject(error);
            });
        });
    }

    rollbackBlock(block) {
        block.deleteOne({_id: block.id});
    }

    createRewardTransaction(miningRewardAddress, block) {
        return new Promise((resolve,reject) => {
            new Transaction({
                fromAddress: null,
                toAddress: miningRewardAddress,
                amount: this.miningReward,
            }).save().then((res2) => {
                resolve(true);
            })
            .catch(error => {
                reject(error);
            });
        })
    }

    deleteTransaction(transaction) {
        return new Promise((resolve,reject) => {
            Transaction.deleteOne({_id: transaction._id},(err) => {
                if(err) {

                    reject(error);
                }
                resolve(true);
            });
        });

    }

    mineTransactions(miningRewardAddress,transactions,latestBlock) {
        console.log("starting new mining cycle");
        return new Promise((resolve,reject) => {
            let block = new Block({
                index: latestBlock.index + 1,
                previousHash: latestBlock.hash,
                timestamp: new Date(),
                transactions: transactions,
                hash: "",
            });

            const startDate = new Date();
            // blocking function (not ideal but mining needs to be blocking because it's javascript searching for a hash as fast as it can)
            block = Block.mineBlock(this.difficulty, block);
            const endDate = new Date();
    
            this.addblockToChain(block).then((res) => {
                this.createRewardTransaction(miningRewardAddress, block).then((res2) => {
                    const transactionPromises = [];
                    block.transactions.forEach(transaction => {
                        transactionPromises.push(this.deleteTransaction(transaction));
                    });
                    Promise.all(transactionPromises).then((res) => {
                        console.log('Block  mined. It took: ' + (endDate.getTime() - startDate.getTime()) + " ms.");
                        resolve(block);

                    })
                    .catch((error) => {
                        console.log('ERROR: Block  mined. But saving block failed! It took: ' + (endDate.getTime() - startDate.getTime()) + " ms.");
                        this.rollbackBlock(block);
                    })
                })
                .catch(err => {
                    console.log('ERROR: Block  mined. But saving block failed! It took: ' + (endDate.getTime() - startDate.getTime()) + " ms.");
                    this.rollbackBlock(block);
                    reject(err);
                })
                

            }).catch(err => {
                console.log('ERROR: Block  mined. But saving block failed! It took: ' + (endDate.getTime() - startDate.getTime()) + " ms.");
                reject(err);
            })
        });

    }

    getBalanceOfAddress(address) {
        return new Promise((resolve,reject) => {
            let balance = 0;
            this.getChain().then((chain) => {
                for (const block of chain) {
                    for (const trans of block.transactions) {
                        if (trans.fromAddress === address) {
                            balance -= trans.amount;
                        }
        
                        if (trans.toAddress === address) {
                            balance += trans.amount;
                        }
                    }
                }
                resolve(balance);
            })
            .catch(error => {
                reject(error);
            })
        })
    }

    isChainValid(chain) {
        for (let i = 1; i < chain.length; i++) {
            const currentBlock = chain[i];
            const previousBlock = chain[i - 1];

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }

        return true;
    }

    getAdjustedDifficulty(chain) {
        const latestBlock = chain[chain.length - 1];
        const prevAdjustmentBlock = chain[chain.length - blockchainConfig.difficultyAdjustmentInterval];
        const timeExpected = (blockchainConfig.blockGenerationInterval * blockchainConfig.difficultyAdjustmentInterval) * 1000;
        const timeTaken = latestBlock.timestamp.getTime() - prevAdjustmentBlock.timestamp.getTime();

        if (timeTaken < timeExpected / 2) {
            return prevAdjustmentBlock.difficulty + 1;
        } else if (timeTaken > timeExpected * 2) {
            return prevAdjustmentBlock.difficulty - 1;
        } else {
            return prevAdjustmentBlock.difficulty;
        }
    };
}