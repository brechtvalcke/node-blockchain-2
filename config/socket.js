module.exports = {
    server:{
        port: (process.env.socketPort * 1 ) || 8080
    },
    initalClients: [
        "127.0.0.1:8080",
        "127.0.0.1:8081",
    ]
};