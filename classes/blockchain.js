const Block = require('./block');
const Transaction = require('./transaction');
const blockchainConfig = require('../config/blockchain');

module.exports = class Blockchain{
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = blockchainConfig.startDifficulty;
        this.pendingTransactions = [];
        this.miningReward = blockchainConfig.miningReward;
    }

    createGenesisBlock() {
        return new Block(new Date(Date.parse("2018-01-01")), [], "0");
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    addblockToChain(block) {
        this.chain.push(block);
        // -1 genesis block telt niet mee
        if((this.chain.length - 1) % blockchainConfig.difficultyAdjustmentInterval === 0) {
            this.difficulty = this.getAdjustedDifficulty();
        }
    }

    minePendingTransactions(miningRewardAddress){
        let block = new Block(new Date(), this.pendingTransactions, this.getLatestBlock().hash);
        const startDate = new Date();
        block.mineBlock(this.difficulty);
        const endDate = new Date();
        console.log('Block successfully mined! It took: '+ (endDate.getTime() - startDate.getTime()) + " ms.");
        this.addblockToChain(block);

        this.pendingTransactions = [
            new Transaction(null, miningRewardAddress, this.miningReward)
        ];
    }

    createTransaction(transaction){
        this.pendingTransactions.push(transaction);
    }

    getBalanceOfAddress(address){
        let balance = 0;

        for(const block of this.chain){
            for(const trans of block.transactions){
                if(trans.fromAddress === address){
                    balance -= trans.amount;
                }

                if(trans.toAddress === address){
                    balance += trans.amount;
                }
            }
        }

        return balance;
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++){
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }

        return true;
    }

    getAdjustedDifficulty() {
        const latestBlock = this.getLatestBlock();
        const prevAdjustmentBlock = this.chain[this.chain.length - blockchainConfig.difficultyAdjustmentInterval];
        const timeExpected = (blockchainConfig.blockGenerationInterval * blockchainConfig.difficultyAdjustmentInterval) * 1000;
        const timeTaken = latestBlock.timestamp.getTime() - prevAdjustmentBlock.timestamp.getTime();
        console.log(timeTaken,timeExpected);
        if (timeTaken < timeExpected / 2) {
            return prevAdjustmentBlock.difficulty + 1;
        } else if (timeTaken > timeExpected * 2) {
            return prevAdjustmentBlock.difficulty - 1;
        } else {
            return prevAdjustmentBlock.difficulty;
        }
    };
}