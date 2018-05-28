var request = require('request'); 

const Block = require('./block');
const Transaction = require('./transaction');

const blockchainConfig = require('../config/blockchain');
const expressConfig = require("../config/express");

const P2P = require('../socket');

const genesisBlock = new Block({
    previousHash: "",
    timestamp: new Date(2018, 1, 1, 0, 0, 0, 0),
    transactions: [],
    difficulty: 0,
    nonce: 0,
    index: 0,
})

module.exports = class Blockchain {
    constructor(miner = false) {
        this.createGenesisBlockIfEmpty()
        this.miningReward = blockchainConfig.miningReward;
        if (!miner) {
            this.p2p = new P2P(this);
        }
    }

    getChain() {
        return new Promise((resolve, reject) => {
            Block.find({}, null, {
                sort: {
                    index: 1
                }
            }, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        })
    }

    getBlockByHash(hash) {
        return new Promise((resolve, reject) => {
            Block.find({
                hash: hash
            }, (err, res) => {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
    }

    createGenesisBlockIfEmpty() {
        this.getChain().then((res) => {
            if (res.length === 0) {
                genesisBlock.hash = genesisBlock.calculateHash();
                genesisBlock.save();
            }
        })
    }

    getDifficulty(index, chain) {

        // if no only genesis block is present use start difficulty
        if (chain.length <= 1) {
            return blockchainConfig.startDifficulty;
        }

        // check if new difficulty should be calculated
        if ((index - 1) % blockchainConfig.difficultyAdjustmentInterval === 0) {
            return this.getAdjustedDifficulty(chain);
        }

        // return last used difficulty
        return chain[chain.length - 1].difficulty;
    }

    broadCastMinedBlock(block) {
        this.p2p.blockMined(block);
    }


    addblockToChain(block, broadcast = false) {
        return new Promise((resolve, reject) => {
            block.save().then((res) => {
                resolve(true);
            }).catch(error => {
                reject(error);
            });
        });
    }

    rollbackBlock(block) {
        block.remove({
            _id: block.id
        }, (err) => {
            console.log(err);
        });
    }

    createRewardTransaction(miningRewardAddress, block) {
        return new Promise((resolve, reject) => {
            const transaction = new Transaction({
                fromAddress: null,
                toAddress: miningRewardAddress,
                amount: this.miningReward,
            })
            
            // send transaction to interface who can broadcast instead of adding it directly
            request.post('http://localhost:' + expressConfig.port + "/pending", {
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(transaction),
            }, (err, httpResponse, body) => {
                if (err || body !== "added") {
                    reject(err);
                }
                resolve(body);
            });
        })
    }

    deleteTransaction(transaction) {
        return new Promise((resolve, reject) => {
            Transaction.remove({
                _id: transaction._id
            }, (err) => {
                if (err) {

                    reject(error);
                }
                resolve(true);
            });
        });

    }

    mineTransactions(miningRewardAddress, transactions, chain) {
        const latestBlock = chain[chain.length - 1];
        return new Promise((resolve, reject) => {
            let block = new Block({
                index: latestBlock.index + 1,
                previousHash: latestBlock.hash,
                timestamp: new Date(),
                transactions: transactions,
                hash: "",
            });

            console.log("starting new mining cycle with difficulty: " + this.getDifficulty(block.index, chain));

            const startDate = new Date();
            // blocking function (not ideal but mining needs to be blocking because it's javascript searching for a hash as fast as it can)
            block = Block.mineBlock(this.getDifficulty(block.index, chain), block);
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
                                console.log(3);
                                console.log('ERROR: Block  mined. But removing transactions failed! It took: ' + (endDate.getTime() - startDate.getTime()) + " ms.");
                                this.rollbackBlock(block);
                                reject(error);
                            })
                    })
                    .catch(err => {
                        console.log(2);
                        console.log('ERROR: Block  mined. But saving block failed! It took: ' + (endDate.getTime() - startDate.getTime()) + " ms.");
                        this.rollbackBlock(block);
                        reject(err);
                    })


            }).catch(err => {
                console.log(1);
                console.log('ERROR: Block  mined. But saving block failed! It took: ' + (endDate.getTime() - startDate.getTime()) + " ms.");
                reject(err);
            })
        });

    }

    broadCastTransaction(transaction) {
        this.p2p.broadCastTransaction(transaction);
    }

    handleExternalTransaction(transactionJson) {
        new Transaction(transactionJson).save();
    }

    getBalanceOfAddress(address) {
        return new Promise((resolve, reject) => {
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

    getAdjustedDifficulty(chain) {
        const latestBlock = chain[chain.length - 1];
        const prevAdjustmentBlock = chain[chain.length - blockchainConfig.difficultyAdjustmentInterval];
        const timeExpected = (blockchainConfig.blockGenerationInterval * blockchainConfig.difficultyAdjustmentInterval) * 1000 * 60;
        const timeTaken = latestBlock.timestamp.getTime() - prevAdjustmentBlock.timestamp.getTime();

        if (timeTaken < timeExpected / 2) {
            return prevAdjustmentBlock.difficulty + 1;
        } else if (timeTaken > timeExpected * 2) {
            return prevAdjustmentBlock.difficulty - 1;
        } else {
            return prevAdjustmentBlock.difficulty;
        }
    }

    handleBlockExternalyMined(block) {
       
        return new Promise((resolve, reject) => {
            block = new Block(block);

            this.getChain()
                .then((chain) => {
                    const latestBlock = chain[chain.length - 1];

                    if (block.hash === latestBlock.hash) {
                        // block already added do nothing
                        console.log("block already added skipping");
                        resolve({
                            added: false
                        });
                        return;
                    }

                    if (block.previousHash !== latestBlock.hash) {
                        // blockchain might not be up to date or block is faulty. Request chain from others to check
                        console.log("hashref does noet match. requesting longest chain")
                        this.p2p.requestChainFromPeers();
                        // do not add block because it can't be checked. Leave it to other nodes to add it.
                        reject("could not be checked");
                    }

                    if (!this.isValidBlock(block, chain)) {
                        // block is faulty do not add
                        reject("block not valid");
                    }

                    // trying to add block to chain
                    this.addblockToChain(block)
                        .then((resAdding) => {

                            // remove transactions from pending transactions
                            let transactionPromises = [];
                            block.transactions.forEach(transaction => {
                                transactionPromises.push(this.deleteTransaction(transaction));
                            });

                            Promise.all(transactionPromises)
                                .then((res) => {
                                    resolve({
                                        added: true
                                    });
                                })
                                .catch((error) => {
                                    reject("failed to remove transactions from block");
                                    this.rollbackBlock(block);
                                });
                        })
                        .catch(error => {
                            reject("failed to add block");
                        });

                })
                .catch(error => {
                    reject("server error");
                });
        })

    }

    validHash(block, difficulty) {
        block = new Block(block);
        const requiredPrefix = '0'.repeat(difficulty);

        if (!block.hash.startsWith(requiredPrefix)) {
            return false;
        }

        if (block.hash !== block.calculateHash()) {
            return false;
        }

        return true;
    }

    isValidBlock(block, chain) {

        const chainUntillBlock = chain.filter((b) => b.index < block.index);
        console.log(chainUntillBlock);
        const latestBlock = chainUntillBlock[chainUntillBlock.length - 1];

        // check again in case we use this function outside of handleBlockExternalyMined()
        if (block.previousHash !== latestBlock.hash) {
            return false;
        }

        // check if index is one higher then the latest block
        if ((block.index - 1) !== latestBlock.index) {
            return false;
        }

        // check if difficulty is correct
        if ((block.difficulty !== this.getDifficulty(block.index, chainUntillBlock))) {
            return false;
        }

        // check if hash matches difficulty and nonce
        if (!this.validHash(block, block.difficulty)) {
            return false;
        }

        // check if timestamp is later then previousblock
        if (block.timestamp.getTime() <= latestBlock.timestamp.getTime()) {
            return false;
        }

        return true;

    }


    replaceChain(chain) {
        return new Promise((resolve, reject) => {
            Block.remove({}, (err) => {
                if (err) {
                    reject(err);
                }
                chain.forEach(block => {
                    new Block(block).save();
                })
                resolve(true);
            });
        });
    }

    chainRequestResponse(externalChain) {
        console.log("external chain recieved")
        if (!this.isValidChain(externalChain)) {
            // decline chain
            console.log("chain declined");
            return;
        }

        this.getChain()
            .then(currentChain => {
                // chain with highest work becomes the active chain
                if (this.getTotalWork(externalChain) > this.getTotalWork(currentChain)) {
                    // accept chain
                    this.replaceChain(externalChain)
                        .then(res => {
                            console.log("chain replaced by network chain");
                        })
                        .catch(error => {
                            console.log("tried to replace chain but it failed");
                        })
                }

                // decline chain
            })
            .catch(error => {
                console.log(error);
            })
    }

    isValidChain(chain) {

        // genesis block must be the same

        genesisBlock.hash = genesisBlock.calculateHash();
        if (chain[0].hash !== genesisBlock.hash) {
            console.log("genesisblock does noet match");
            return false;
        }

        for (let i = 1; i <= chain.length - 1; i++) {
            if (!this.isValidBlock(chain[i], chain)) {
                console.log("block not valid so chain not valid");
                return false;
            }
        }

        return true;

    }

    getTotalWork(chain) {
        // we asume the chain is correct. Manual validation is required before calling this function
        const work = 0;
        chain.forEach(block => {
            work += block.difficulty;
        });
        
        return work;
    }

}