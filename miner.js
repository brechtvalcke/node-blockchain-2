const mongoose = require('mongoose');

const mongodbConfig = require('./config/mongodb');
const Miner = require('./classes/miner');

mongoose.connect(mongodbConfig.connectionString);

const miner = new Miner();
