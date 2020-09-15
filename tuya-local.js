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

	function connect(delay) {
		node.log(`Connecting to ${deviceInfo.name} @ ${deviceInfo.ip} (delay: ${delay ? 'yes' : 'no'})`)
		clearTimeout(connectInterval);
		if (delay) {
			setTimeout(() => connect(), 5000);
		} else {
			if (tuyaDevice.isConnected()) {
				node.log(`Device ${deviceInfo.name} already connected.`);
				return;
			}
			node.status({ fill: 'yellow', shape: 'dot', text: 'connecting...' });
			tuyaDevice.connect().then(() => { }).catch(() => { });
		}
	}

	function disconnect() {
		clearTimeout(connectInterval);
		tryReconnect = false;
		node.log(`Disconnect request for ${deviceInfo.name}`);
		if (tuyaDevice.isConnected()) {
			node.log(`Device connected, disconnecting...`);
			tuyaDevice.disconnect();
			node.log(`Disconnected`);
		}
	}

	function handleDisconnection() {
		node.log(`Device ${deviceInfo.name} disconnected, reconnect: ${tryReconnect}`);
		if (tryReconnect) {
			connect(true);
		}
		node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
		node.send({ data: { ...deviceInfo, available: false } });
	}

	tuyaDevice.on('connected', () => {
		node.log(`Device ${deviceInfo.name} connected!`);
		clearTimeout(connectInterval);
		node.status({ fill: 'green', shape: 'dot', text: `connected @ ${new Date().toLocaleTimeString()}` });
		node.send({ data: { ...deviceInfo, available: true } });
	});

	tuyaDevice.on('disconnected', () => {
		node.log(`Device ${deviceInfo.name} disconnected, reconnect: ${tryReconnect}`);
		handleDisconnection();
	});
	tuyaDevice.on('error', (err) => {
		node.log(`Device ${deviceInfo.name} in error state: ${err}, reconnect: ${tryReconnect}`);
		handleDisconnection();
	});

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

