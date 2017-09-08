const dgram = require("dgram");
const Rx = require("rxjs/Rx");
const md5 = require('md5');
const RemoteDevice = require("./util.js").RemoteDevice;
const Connection = require("./util.js").Connection;
const Message = require("./util.js").Message;

const server = dgram.createSocket('udp4');

const Event = {
    bus: new Rx.BehaviorSubject(false),
    echo: 1,
    register: 2,
    connect: 3,
    beat: 4,
    observe(code){
        return this.bus.filter(msg => msg.event === code);
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
    for (let i = 0; i < msg.length; i++) {
        if (colonPositions.length > 2) break;
        if (msg[i] === ":" && msg[i - 1] !== "\\") colonPositions.push(i);
    }
    const noData = colonPositions.length === 1;
    if (noData) colonPositions[1] = msg.length;     //to avoid crash

    const event = parseInt(msg.charCodeAt(0));

    const name = msg.substring(colonPositions[0] + 1, colonPositions[1]);
    rinfo.name = name;
    const deviceOfName = devices.find(d => d.name === name) || null;
    const data = noData ? null : msg.substring(colonPositions[1] + 1, msg.length);
    return new Message(event, data, deviceOfName, rinfo);
};
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
                msg._event = Event.beat;
                Event.bus.next(msg);
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
            console.log('Attempt connect', msg);
            const targetDevice = devices.find(d => d.name === msg.data);
            console.log('Attempt connect to ', targetDevice);
            if (targetDevice) {
                let conn = targetDevice.connection;
                msg.device.connection.sendMessage(server, `{"event":"connect","address":"${conn.address}","port":"${conn.port}"}`);
                conn = msg.device.connection;
                targetDevice.connection.sendMessage(server, `{"event":"connect","address":"${conn.address}","port":"${conn.port}"}`);
            }
        }));
})();


server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});
server.bind(serverInfo.port);
