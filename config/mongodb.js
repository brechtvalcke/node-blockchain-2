module.exports = {
    connectionString: process.env.mongodbConString ? process.env.mongodbConString.replace(/\s+/, "")  : "mongodb://localhost/blockchain"
}