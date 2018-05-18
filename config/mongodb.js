
module.exports = {
    connectionString: process.env.mongodbConString ? process.env.mongodbConString.slice(1) : "mongodb://localhost/blockchain"
}