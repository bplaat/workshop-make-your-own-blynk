import crypto from 'crypto';
import http from 'http';
import { WebSocketServer } from 'ws';

// Constants
const SERVER_PORT = process.env.PORT || 8080;

const MessageType = {
    INIT_DEVICES: 1,
    INIT_MEASUREMENTS: 2,
    NEW_DEVICE: 3,
    NEW_MEASUREMENTS: 4
};

const MeasurementType = {
    TEMPERATURE: 1,
    HUMIDITY: 2,
    LIGHTNESS: 3
};

// Utils
function uuid2bytes(uuid) {
    const hexs = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(hexs.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

// Data store
const devices = [];
const measurements = [];

// Websocket server
let clients = [];
const wss = new WebSocketServer({ noServer: true });
wss.on('connection', ws => {
    // Add this client to clients array
    clients.push({ ws });

    // Remove the client from the clients array when it disconnects
    ws.on('close', () => {
        clients = clients.filter(client => client.ws != ws);
    });

    // Send init devices message
    {
        let messageSize = 1 + 4;
        for (const device of devices) messageSize += 16 + 2 + new TextEncoder().encode(device.name).length;

        const message = new ArrayBuffer(messageSize);
        const messageView = new DataView(message);
        let pos = 0;
        messageView.setUint8(pos, MessageType.INIT_DEVICES); pos += 1;
        messageView.setUint32(pos, devices.length, true); pos += 4;
        for (const device of devices) {
            const deviceIdBytes = uuid2bytes(device.id);
            for (let i = 0; i < 16; i++) messageView.setUint8(pos++, deviceIdBytes[i]);

            const deviceNameBytes = new TextEncoder().encode(device.name);
            messageView.setUint16(pos, deviceNameBytes.length, true); pos += 2;
            for (let i = 0; i < deviceNameBytes.length; i++) messageView.setUint8(pos++, deviceNameBytes[i]);
        }
        ws.send(message);
    }

    // Send init measurements message
    {
        const message = new ArrayBuffer(1 + 4 + measurements.length * (16 + 16 + 1 + 4 + 4));
        const messageView = new DataView(message);
        let pos = 0;
        messageView.setUint8(pos, MessageType.INIT_MEASUREMENTS); pos += 1;
        messageView.setUint32(pos, measurements.length, true); pos += 4;
        for (const measurement of measurements) {
            const measurementIdBytes = uuid2bytes(measurement.id);
            for (let i = 0; i < 16; i++) messageView.setUint8(pos++, measurementIdBytes[i]);

            const deviceIdBytes = uuid2bytes(measurement.device_id);
            for (let i = 0; i < 16; i++) messageView.setUint8(pos++, deviceIdBytes[i]);

            messageView.setUint8(pos, measurement.type); pos += 1;
            messageView.setFloat32(pos, measurement.value, true); pos += 4;
            messageView.setUint32(pos, measurement.created_at, true); pos += 4;
        }
        ws.send(message);
    }
});

// HTTP server
const server = http.createServer((req, res) => {
    // Parse incoming pathname and GET variables
    const { pathname, searchParams } = new URL(req.url, `http://localhost:${SERVER_PORT}/`);
    console.log(`[HTTP] ${req.method} ${pathname}`);

    // Home endpoint
    if (pathname == '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Weather Station API');
        return;
    }

    // List devices endpoint
    if (pathname == '/api/devices') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: devices }));
        return;
    }

    // List measurements endpoint
    if (pathname == '/api/measurements') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            data: measurements.map(measurement => {
                if (measurement.type == MeasurementType.TEMPERATURE) measurement.type = 'temperature';
                if (measurement.type == MeasurementType.HUMIDITY) measurement.type = 'humidity';
                if (measurement.type == MeasurementType.LIGHTNESS) measurement.type = 'lightness';
                return measurement;
            })
        }));
        return;
    }

    // Create measurements endpoint
    if (pathname == '/api/measurements/create') {
        const newMeasurements = [];
        const currentTime = Math.floor(Date.now() / 1000);

        // The name and at least one measurement must be given
        if (
            !searchParams.has('name') || searchParams.get('name').length < 2 ||
            !(searchParams.has('temperature') || searchParams.has('humidity') || searchParams.has('lightness'))
        ) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
            return;
        }

        // Select or create the device by name
        let device = devices.find(device => device.name == searchParams.get('name'));
        if (device == null) {
            device = {
                id: crypto.randomUUID(),
                name: searchParams.get('name')
            };
            devices.push(device);

            // Broadcast new device message
            if (clients.length > 0) {
                const deviceNameBytes = new TextEncoder().encode(device.name);

                const message = new ArrayBuffer(1 + 16 + 2 + deviceNameBytes.length);
                const messageView = new DataView(message);
                let pos = 0;
                messageView.setUint8(pos, MessageType.NEW_DEVICE); pos += 1;

                const deviceIdBytes = uuid2bytes(device.id);
                for (let i = 0; i < 16; i++) messageView.setUint8(pos++, deviceIdBytes[i]);

                messageView.setUint16(pos, deviceNameBytes.length, true); pos += 2;
                for (let i = 0; i < deviceNameBytes.length; i++) messageView.setUint8(pos++, deviceNameBytes[i]);

                for (const client of clients) {
                    client.ws.send(message);
                }
            }
        }

        // Create temperature measurement when given
        if (searchParams.has('temperature')) {
            const measurement = {
                id: crypto.randomUUID(),
                device_id: device.id,
                type: MeasurementType.TEMPERATURE,
                value: parseFloat(searchParams.get('temperature')),
                created_at: currentTime
            };
            measurements.push(measurement);
            newMeasurements.push(measurement);
        }

        // Create humidity measurement when given
        if (searchParams.has('humidity')) {
            const measurement = {
                id: crypto.randomUUID(),
                device_id: device.id,
                type: MeasurementType.HUMIDITY,
                value: parseFloat(searchParams.get('humidity')),
                created_at: currentTime
            };
            measurements.push(measurement);
            newMeasurements.push(measurement);
        }

        // Create lightness measurement when given
        if (searchParams.has('lightness')) {
            const measurement = {
                id: crypto.randomUUID(),
                device_id: device.id,
                type: MeasurementType.LIGHTNESS,
                value: parseFloat(searchParams.get('lightness')),
                created_at: currentTime
            };
            measurements.push(measurement);
            newMeasurements.push(measurement);
        }

        // Broadcast new measurements message
        if (clients.length > 0) {
            const message = new ArrayBuffer(1 + 4 + newMeasurements.length * (16 + 16 + 1 + 4 + 4));
            const messageView = new DataView(message);
            let pos = 0;
            messageView.setUint8(pos, MessageType.NEW_MEASUREMENTS); pos += 1;
            messageView.setUint32(pos, newMeasurements.length, true); pos += 4;
            for (const measurement of newMeasurements) {
                const measurementIdBytes = uuid2bytes(measurement.id);
                for (let i = 0; i < 16; i++) messageView.setUint8(pos++, measurementIdBytes[i]);

                const deviceIdBytes = uuid2bytes(measurement.device_id);
                for (let i = 0; i < 16; i++) messageView.setUint8(pos++, deviceIdBytes[i]);

                messageView.setUint8(pos, measurement.type); pos += 1;
                messageView.setFloat32(pos, measurement.value, true); pos += 4;
                messageView.setUint32(pos, measurement.created_at, true); pos += 4;
            }
            for (const client of clients) {
                client.ws.send(message);
            }
        }

        // Return success message
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // 404 Not Found endpoint
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
});

// Listen to HTTP upgrade requests (websockets use this)
server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, `http://localhost:${SERVER_PORT}/`);
    console.log(`[HTTP] ${req.method} UPGRADE ${pathname}`);

    // Upgrade HTTP request to a websocket connection and to our websocket server
    if (pathname === '/ws') {
        wss.handleUpgrade(req, socket, head, ws => {
            wss.emit('connection', ws, req);
        });
        return;
    }

    socket.destroy();
});

// Start the HTTP server and print started text
server.listen(SERVER_PORT, () => {
    console.log(`[HTTP] Server is listening on http://localhost:${SERVER_PORT}/`);
});
