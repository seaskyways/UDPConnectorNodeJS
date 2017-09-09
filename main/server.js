const dgram = require("dgram");
const Rx = require("rxjs/Rx");
// const md5 = require('md5');
const ResponseMessage = require("./models").ResponseMessage;
const RemoteDevice = require("./models.js").RemoteDevice;
const Connection = require("./models.js").Connection;
const Message = require("./models.js").Message;

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

server.on("error", (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});


//region onMessage Handler
// noinspection ConstantIfStatementJS
if (true) {
    let runt = (e) => {
        console.log("Runt Message received");
        console.error(e);
    };

    server.on('message', (msg, rinfo) => {
        console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
        msg = msg.toString().trim();
        if (msg.length === 0) return runt('Blank Message');
        try {
            msg = Message.parseString(msg, rinfo, devices);
            Event.bus.next(msg);
        } catch (e) {
            runt(e);
        }
    });
}
//endregion

//region eventHandlers
// noinspection ConstantIfStatementJS
if (true) {
    let safe1 = (lambda) => {
        return x1 => {
            try {
                lambda(x1)
            } catch (e) {
                console.error(e)
            }
        }
    };

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
            remoteDevice.connection.sendMessage(
                server,
                ResponseMessage.serialize("auth", {"code": remoteDevice.administrativeCode})
            );
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
        .filter(msg => msg.device !== null)
        .filter(msg => msg.options.auth === msg.device.administrativeCode)
        .subscribe(safe1(msg => {
            const targetDevice = devices.find(d => d.name === msg.data);
            if (targetDevice) {
                let conn = targetDevice.connection;
                msg.device.connection.sendMessage(server,
                    ResponseMessage.serialize("connect", {"address": conn.address, "port": conn.port})
                );
                conn = msg.device.connection;
                targetDevice.connection.sendMessage(server,
                    ResponseMessage.serialize("connect", {"address": conn.address, "port": conn.port})
                );
            }
        }));

    Event.observeOption('ack')
        .filter(msg => msg.device !== null)
        .subscribe(safe1(msg => {
            msg.device.connection.sendMessage(server, ResponseMessage.serialize("ack", {"ack": msg.options.ack}))
        }));

    Event.bus.filter(msg => msg.device !== null)
        .subscribe(safe1(msg => {
            if (msg.device.additional.beat === undefined) msg.device.additional.beat = {};
            msg.device.additional.beat.time = new Date();
            console.log(`${msg.who.name}: sent beat: time = ${msg.device.additional.beat.time}`)
        }));
}
//endregion

server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});
server.bind(serverInfo.port);
