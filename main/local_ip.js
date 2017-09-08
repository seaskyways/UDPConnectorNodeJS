const net = require('net');

exports.getLocalIP = function (remoteAddress = "google.com") {
    return new Promise((accept, reject) => {
        const socket = net.createConnection(80, remoteAddress);
        socket.on('connect', () => {
            accept(socket.address().address);
            socket.end();
        });
        socket.on('error', e => {
            reject(e);
        });
    });
};

