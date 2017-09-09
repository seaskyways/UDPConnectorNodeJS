const dgram = require("dgram");
const Rx = require("rxjs/Rx");
const md5 = require('md5');
const RemoteDevice = require("./util.js").RemoteDevice;
const Connection = require("./util.js").Connection;
const Message = require("./util.js").Message;

const server = dgram.createSocket('udp4');

const Event = {
    bus: new Rx.ReplaySubject(1),
    echo: 1,
    register: 2,
    connect: 3,
    beat: 4,
    observe(code) {
        return this.bus.filter(msg => msg.event === code);
    },
    observeOption(opt) {
        return this.bus.filter(msg => msg.options[opt] !== undefined);
    }
};

const devices = [];

const serverInfo = {
    port: 6580,
};

server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});


let parseMessage = function (msg, rinfo) {
    let colonPositions = [];
    let hashPositions = [];
    for (let i = 0; i < msg.length; i++) {
        if (msg[i] === ":" && msg[i - 1] !== "\\") colonPositions.push(i);
        if (msg[i] === "#" && msg[i - 1] !== "\\") hashPositions.push(i);
    }
    const noData = colonPositions.length === 1;
    const noOpts = hashPositions.length === 0;
    if (noData) colonPositions[1] = msg.length;     //to avoid crash

    const event = parseInt(msg.charCodeAt(0));

    const name = msg.substring(colonPositions[0] + 1, colonPositions[1]);
    rinfo.name = name;
    const deviceOfName = devices.find(d => d.name === name) || null;
    const data = noData ? null : msg.substring(colonPositions[1] + 1, hashPositions[0] || msg.length);

    const opts = {};
    if (!noOpts) {
        for (let i in hashPositions) {
            i = parseInt(i);
            const optBoundary = (hashPositions[i + 1] !== undefined) ? hashPositions[i + 1] : msg.length;
            const s_opt = msg.substring(hashPositions[i] + 1, optBoundary);
            const i_equal = s_opt.indexOf("=");
            if (i_equal === -1) {
                opts[s_opt] = true;
            } else {
                opts[s_opt.substring(0, i_equal)] = s_opt.substring(i_equal + 1, s_opt.length);
            }
        }
    }
    return new Message(event, data, deviceOfName, rinfo, opts);
};

//onMessage
(function () {
    function runt(e) {
        console.log("Runt Message received");
        console.error(e);
    }

    server.on('message', (msg, rinfo) => {
        console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
        msg = msg.toString().trim();
        if (msg.length === 0) return runt('Blank Message');
        try {
            msg = parseMessage(msg, rinfo);
            Event.bus.next(msg);
        } catch (e) {
            runt(e);
        }
    });
})();

//eventHandlers
(function () {
    function safe1(lambda) {
        return x1 => {
            try {
                lambda(x1)
            } catch (e) {
                console.error(e)
            }
        }
    }

    Event.observe(Event.register)
        .subscribe(safe1(msg => {
            const deviceOfName = devices.find(d => d.name === msg.who.name);
            if (deviceOfName !== undefined) {
                return;
            }
            const privateConnection = new Connection(msg.data.address, msg.data.port, false);
            const publicConnection = new Connection(msg.who.address, msg.who.port);
            const remoteDevice = new RemoteDevice(msg.who.name, privateConnection, publicConnection);
            devices.push(remoteDevice);
            remoteDevice.connection.sendMessage(server, JSON.stringify(devices.map(d => d.name)));
            remoteDevice.connection.sendMessage(server, JSON.stringify({
                "event": "adminCode",
                "code": remoteDevice.administrativeCode
            }));
        }));

    Event.observe(Event.echo)
        .subscribe(safe1(msg => {
            server.send(msg.dataString || "ECHO", msg.who.port, msg.who.address);
        }));

    Event.observe(Event.beat)
        .subscribe(safe1(msg => {
            if (msg.device.additional.beat === undefined) msg.device.additional.beat = {};
            msg.device.additional.beat.time = new Date();
            console.log(`${msg.who.name}: sent beat: time = ${msg.device.additional.beat.time}`)
        }));

    Event.observe(Event.connect)
        .subscribe(safe1(msg => {
            const targetDevice = devices.find(d => d.name === msg.data);
            if (targetDevice) {
                let conn = targetDevice.connection;
                msg.device.connection.sendMessage(server, `{"event":"connect","address":"${conn.address}","port":"${conn.port}"}`);
                conn = msg.device.connection;
                targetDevice.connection.sendMessage(server, `{"event":"connect","address":"${conn.address}","port":"${conn.port}"}`);
            }
        }));

    Event.observeOption('ack')
        .subscribe(safe1(msg => {
            if (msg.device !== null)
                msg.device.connection.sendMessage(server, `ack=${msg.options.ack}`)
        }));

    Event.bus.filter(msg => msg.device !== null)
        .subscribe(safe1(msg => {
            if (msg.device.additional.beat === undefined) msg.device.additional.beat = {};
            msg.device.additional.beat.time = new Date();
            console.log(`${msg.who.name}: sent beat: time = ${msg.device.additional.beat.time}`)
        }));
})();

server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});
server.bind(serverInfo.port);
