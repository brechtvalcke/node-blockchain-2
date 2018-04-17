const Blockchain = require('./classes/blockchain');
const Transaction = require('./classes/transaction');

let exampleCoin = new Blockchain();
exampleCoin.createTransaction(new Transaction('address1', 'address2', 100));
exampleCoin.createTransaction(new Transaction('address2', 'address1', 50));

console.log('\n Starting the miner...');
exampleCoin.minePendingTransactions('miner-address');

console.log('\nBalance of miner is', exampleCoin.getBalanceOfAddress('miner-address'));

console.log('\n Starting the miner again...');
exampleCoin.minePendingTransactions('miner-address');
exampleCoin.minePendingTransactions('miner-address');
exampleCoin.minePendingTransactions('miner-address');
exampleCoin.minePendingTransactions('miner-address');
exampleCoin.minePendingTransactions('miner-address');
exampleCoin.minePendingTransactions('miner-address');
exampleCoin.minePendingTransactions('miner-address');
exampleCoin.minePendingTransactions('miner-address');
exampleCoin.minePendingTransactions('miner-address');
exampleCoin.minePendingTransactions('miner-address');
exampleCoin.minePendingTransactions('miner-address');
exampleCoin.minePendingTransactions('miner-address');

console.log(exampleCoin.chain);

console.log('\nBalance of miner is', exampleCoin.getBalanceOfAddress('miner-address'));