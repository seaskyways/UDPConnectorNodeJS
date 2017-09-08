const dgram = require('dgram');

const udp_matchmaker = dgram.createSocket('udp4');
const udp_port = 0;

const clients = {};

udp_matchmaker.on('listening', function () {
    const address = udp_matchmaker.address();
    console.log('# listening [%s:%s]', address.address, address.port);
});

udp_matchmaker.on('message', function (data, rinfo) {
    try {
        data = JSON.parse(data);
    } catch (e) {
        return console.log('! Couldn\'t parse data (%s):\n%s', e, data);
    }
    if (data.type === 'register') {
        clients[data.name] = {
            name: data.name,
            connections: {
                local: data.linfo,
                public: rinfo
            }
        };
        console.log('# Client registered: %s@[%s:%s | %s:%s]', data.name,
            rinfo.address, rinfo.port, data.linfo.address, data.linfo.port);
    } else if (data.type === 'connect') {
        let i;

        const couple = [clients[data.from], clients[data.to]];
        for (i = 0; i < couple.length; i++) {
            if (!couple[i]) return console.log('Client unknown!');
        }

        for (i = 0; i < couple.length; i++) {
            send(couple[i].connections.public.address, couple[i].connections.public.port, {
                type: 'connection',
                client: couple[(i + 1) % couple.length],
            });
        }
    }
});

const send = function (host, port, msg, cb) {
    const data = new Buffer(JSON.stringify(msg));
    udp_matchmaker.send(data, 0, data.length, port, host, function (err, bytes) {
        if (err) {
            udp_matchmaker.close();
            console.log('# stopped due to error: %s', err);
        } else {
            console.log('# sent ' + msg.type);
            if (cb) cb();
        }
    });
};

udp_matchmaker.bind(udp_port);