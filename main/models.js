/**
 * Created by Ahmad on 07/09 Sep/2017.
 */
exports.Connection = class {
    constructor(address, port, isConnected = true) {
        this._address = address;
        this._port = port;
        this.isConnected = isConnected
    }

    sendMessage(socket, message) {
        // console.log(`Sending "${message}" To  ${this.description}`);
        socket.send(message, this.port, this.address);
    }

    equals(address, port) {
        //noinspection EqualityComparisonWithCoercionJS
        return this._address === address && this._port == port;
    }

    toObject() {
        return {
            "address": this.address,
            "port": this.port
        }
    }

    get description() {
        return `${this.address}:${this.port}`;
    }

    get address() {
        return this._address;
    }

    get port() {
        return this._port;
    }

    get isConnected() {
        return this._isConnected;
    }

    set isConnected(value) {
        this._isConnected = !!value;
    }
};

exports.RemoteDevice = class {
    constructor(name, privateConnection, publicConnection) {
        this._name = name;
        this.privateConnection = privateConnection;
        this.publicConnection = publicConnection;
        this._administrativeCode = require("md5")(Math.random() + name + Math.random());
        this.additional = {};
    }

    get connection() {
        if (this.privateConnection.isConnected) {
            return this.privateConnection;
        } else if (this.publicConnection.isConnected) {
            return this.publicConnection
        } else {
            return null;
        }
    }

    get name() {
        return this._name;
    }

    get administrativeCode() {
        return this._administrativeCode;
    }
};

exports.Message = class {
    constructor(event, data, device, who = null, options) {
        this._event = event;
        this._dataString = data;
        this._options = options;
        try {
            this._data = JSON.parse(data);
        } catch (_) {
            this._data = data;
        }
        this._device = device;
        this._who = who;
    }

    get event() {
        return this._event;
    }

    get data() {
        return this._data;
    }

    get device() {
        return this._device;
    }

    get dataString() {
        return this._dataString;
    }

    get who() {
        return this._who;
    }

    get options() {
        return this._options;
    }
};

exports.Message.parseString = function (msg, rinfo, devices) {
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
        hashPositions
            .forEach((i, index) => {
                const optBoundary = (hashPositions[index + 1] !== undefined) ? hashPositions[index + 1] : msg.length;
                const stringOption = msg.substring(i + 1, optBoundary);
                const indexOfEqual = stringOption.indexOf("=");
                if (indexOfEqual === -1) {
                    opts[stringOption] = true;
                } else {
                    opts[stringOption.substring(0, indexOfEqual)] = stringOption.substring(indexOfEqual + 1, stringOption.length);
                }
            });
    }
    return new exports.Message(event, data, deviceOfName, rinfo, opts);
};

exports.ResponseMessage = class ResponseMessage {
    constructor(type, data = undefined, options = undefined) {
        this.type = type;
        this.data = data;
        this.options = options;
    }

    static serialize(type, data = undefined, options = undefined) {
        return JSON.stringify(new ResponseMessage(type, data, options))
    }
};