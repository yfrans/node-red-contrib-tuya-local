const TuyaApi = require('tuyapi');

let _red = null;

function TuyaLocal(config) {
	_red.nodes.createNode(this, config);

	const node = this;
	const tuyaDevice = new TuyaApi({
		id: config.devId,
		key: config.devKey,
		ip: config.devIp,
		version: config.protocolVer
	});

	let tryReconnect = true;
	let connectInterval = null;
	let deviceInfo = { ip: config.devIp, name: config.devName };

	function connect(setTimeout) {
		clearTimeout(connectInterval);
		if (setTimeout) {
			setTimeout(() => connect(), 5000);
		} else {
			node.status({ fill: 'yellow', shape: 'dot', text: 'connecting...' });
			tuyaDevice.connect().then(() => { }).catch(() => { });
		}
	}

	function disconnect() {
		tryReconnect = false;
		if (tuyaDevice.isConnected()) {
			tuyaDevice.disconnect();
		}
	}

	function handleDisconnection() {
		if (tryReconnect) {
			connect(true);
		}
		node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
		node.send({ data: { ...deviceInfo, available: false } });
	}

	tuyaDevice.on('connected', () => {
		clearTimeout(connectInterval);
		node.status({ fill: 'green', shape: 'dot', text: `connected @ ${new Date().toLocaleTimeString()}` });
	});

	tuyaDevice.on('disconnected', () => handleDisconnection());
	tuyaDevice.on('error', () => handleDisconnection());

	tuyaDevice.on('data', (data, commandByte) => {
		if (commandByte) {
			node.send({ data: { ...deviceInfo, available: true }, commandByte: commandByte, payload: data });
		}
	});

	node.on('input', (msg) => {
		let command = msg.payload;
		if (typeof command === 'string') {
			switch (command) {
				case 'request':
					tuyaDevice.get({ schema: true });
					break;
				case 'connect':
					connect();
					break;
				case 'disconnect':
					disconnect();
					break;
			}
		} else if ('dps' in command) {
			tuyaDevice.set(command);
		} else {
			node.log(`Unknown command for ${deviceInfo.name}: ${command}`);
		}
	});

	node.on('close', (removed, done) => {
		disconnect();
		done();
	});

	connect();
}

module.exports = function (red) {
	_red = red;
	_red.nodes.registerType('tuya-local', TuyaLocal);
};

