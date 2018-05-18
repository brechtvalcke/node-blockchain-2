const WebSocket = require('ws');
const ipaddr = require('ipaddr.js');

const socketConfig = require("../config/socket");
const ACTION_TYPES = require("./actionTypes");

module.exports = class P2P {

    constructor(blockchain) {
        this.blockchain = blockchain;
        this.server = new WebSocket.Server(socketConfig.server);
        this.clients = [];
        this.peerAdresses = socketConfig.initalClients;
        this.initServer();
        this.connectToPeers();

        this.initDiscovery();
    }

    addNewPeers(peers) {
        peers.forEach(peer => {
            this.addPeer(peer);
        });
    }

    initDiscovery() {
        this.discoveryInterval = setInterval(() => {
            this.fetchPeersFromPeers();
        }, 1000 * 60 * 60 * 5)
    }
    
    addPeer(peer) {
        if(!this.isPeerInList(peer)) {
            this.peerAdresses.push(peer);
            this.addClient(peer);
        }
    }

    isPeerInList(peer) {
        const foundPeer = this.peerAdresses.find(peerAddress => {
            if(peerAddress === peer) {
                return peerAddress;
            }
        });

        return foundPeer ? true : false;
    }

    connectToPeers() {
        this.peerAdresses.forEach(peer => {
            this.addClient(peer);
        });
        setTimeout(() => {
            this.fetchPeersFromPeers();
        }, 5000);
    }

    addClient(address) {
        try {
            console.log("connecting to: " + this.formatAddress(address));
            const ws = new WebSocket(this.formatAddress(address));
            this.initSocket(ws);
            this.clients.push(ws);
        } catch (e) {
            console.log(e);
            return;
        }

    }

    formatAddress(address) {
        const addressSplit = address.split(':');
        if(addressSplit.length > 1) {
            return "ws://" + address;
        }

        return "ws://" + address + ":" + socketConfig.server.port;
    }


    formatIp(ipString) {
        if (ipaddr.isValid(ipString)) {
            try {
                const addr = ipaddr.parse(ipString);
                if (ipaddr.IPv6.isValid(ipString) && addr.isIPv4MappedAddress()) {
                    return addr.toIPv4Address().toString();
                }
                return addr.toNormalizedString();
            } catch (e) {
                return ipString;
            }
        }
        return undefined;
    }

    initSocket(socket) {
        socket.on('error', (err) => {
            // remove faulty client
            this.clients = this.clients.filter((client) => {
                return client.url !== socket.url;
            })

            // remove faulty address from peers
            let addressToRemove = socket.url.slice(5);
            this.peerAdresses = this.peerAdresses.filter((address) => {
                return address !== addressToRemove && address !== addressToRemove + ":" + socketConfig.server.port;
            })
            
        });
        socket.on('connection', (ws, req) => {
            console.log("socket now listening for messages");
            ws.on('message' , (message) => { this.handleServerMessage(message, ws)});
            ws.on("error" , (error) => {
                console.log(error);
            });
            ws.on('close', () => {
                console.log('socket disconnected');
            });
        });
    }

    initServer() {
        this.server.on('connection',  (ws, req) => {
            console.log("socket connected: " + this.formatIp(req.connection.remoteAddress));
            ws.on('message', (message) => this.handleClientMessage(message, ws));
            ws.on("error" , (error) => {
                console:log(error);
            })
          });
    }

    requestChainFromPeers() {
        const req = {
            action: ACTION_TYPES.GET_FULL_CHAIN,
        }
        this.broadcastToPeers(req);
    }

    requestBlockFromPeersByHash(hash) {
        const req = {
            action: ACTION_TYPES.GET_BLOCK_BY_HASH,
            hash: hash,
        }
        this.broadcastToPeers(req);
    }

    fetchPeersFromPeers() {
        const req = {
            action: ACTION_TYPES.GET_PEERS,
            serverPort: socketConfig.server.port,
        }
        this.broadcastToPeers(req);
    }

    broadCastTransaction(transaction) {
        const req = {
            action: ACTION_TYPES.NEW_TRANSACTION,
            transaction: transaction,
        }
        this.broadcastToPeers(req);
    }

    blockMined(block) {
        const req = {
            action: ACTION_TYPES.BLOCK_MINED,
            block: block
        }
        this.broadcastToPeers(req);
    }


    handleClientMessage(message,ws) {
        console.log(message);
        const msg = this.decodeMesage(message);
        const res = {};
        switch(msg.action) {

            case ACTION_TYPES.GET_BLOCK_BY_HASH:
                res.action = ACTION_TYPES.REQUESTED_BLOCK;
                this.blockchain.getBlockByHash(msg.hash)
                .then(block => {     
                    res.data = block;

                    this.encodeAndSend(res,ws);
                })
                .catch( error => {
                    res.error = "could not fetch block"
                });
            break;

            case ACTION_TYPES.GET_FULL_CHAIN:
                res.action = ACTION_TYPES.REQUESTED_CHAIN;
                this.blockchain.getChain()
                .then(chain => {
                    res.data = chain;
                    this.encodeAndSend(res,ws);
                })
                .catch(error => {
                    res.error = "could not fetch chain";
                    this.encodeAndSend(res,ws);
                });
            break;

            case ACTION_TYPES.BLOCK_MINED:
                res.action = ACTION_TYPES.BLOCK_MINE_RESPONSE
                this.blockchain.handleBlockExternalyMined(msg.block)
                .then(res2 => {
                    if(res2.added) {
                        this.broadcastToPeers(msg.block);
                        res.accepted = true;
                        res.data = msg.block;
                        this.encodeAndSend(res,ws);
                    }
                })
                .catch(error => {
                    res.accepted = false;
                    res.reason = error;
                    res.data = msg.block;
                    this.encodeAndSend(res,ws);
                });
            break;

            case ACTION_TYPES.GET_PEERS:
                res.action = ACTION_TYPES.PEERS_RESPONSE;
                res.data = this.peerAdresses;

                this.encodeAndSend(res,ws);

                const reqAddress = ws._socket.address();
                this.addPeer(this.formatIp(reqAddress.address) + ":" + (msg.serverPort * 1));

            break;

            case ACTION_TYPES.NEW_TRANSACTION:
                this.blockchain.handleExternalTransaction(msg.transaction);
            break;
        }
    }

    handleServerMessage(message,ws) {
        console.log(message);
        const msg = this.decodeMesage(message);
        const res = {};
        switch(msg.action) {
            case ACTION_TYPES.BLOCK_MINE_RESPONSE:

                if(msg.accepted) {
                    this.blockchain.approvedBlock(msg.data);
                } else {
                    this.blockchain.declinedBlock(msg.data);
                }
                
            break;
            
            case ACTION_TYPES.REQUESTED_BLOCK:
                this.blockchain.blockRequestResponse(msg.data);
            break;

            case ACTION_TYPES.REQUESTED_CHAIN:
                this.blockchain.chainRequestResponse(msg.data);
            break;

            case ACTION_TYPES.PEERS_RESPONSE:
                this.addNewPeers(msg.data);
            break;
        }
    }

    broadcastToPeers(message) {
        const msg = this.encodeMessage(message);

        this.clients.forEach((client) => {
            client.send(msg, (err) => { err ? this.handleSocketDisconnected(err, client) : ""});
        });
    }

    decodeMesage(message) {
        return JSON.parse(message);
    }

    encodeMessage(message) {
        return JSON.stringify(message);
    }

    encodeAndSend(message,destination) {
        destination.send(this.encodeMessage(message), (err) => {err ? this.handleSocketDisconnected(err, destination) : ""});
    }

    handleSocketDisconnected(err, socket) {
        socket = new WebSocket(socket.url);
        this.initSocket(socket);
    }
}