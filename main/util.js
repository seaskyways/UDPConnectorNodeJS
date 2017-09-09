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