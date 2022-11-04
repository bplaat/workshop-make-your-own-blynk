import crypto from 'crypto';
import http from 'http';
import { WebSocketServer } from 'ws';

// Constants
const SERVER_PORT = process.env.PORT || 8080;

const MessageType = {
    INIT_DEVICES: 1,
    NEW_DEVICE: 2,
    INIT_MEASUREMENTS: 3,
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

function encodeDevice(buffer, pos, device) {
    const view = new DataView(buffer);
    const idBytes = uuid2bytes(device.id);
    for (let i = 0; i < 16; i++) view.setUint8(pos++, idBytes[i]);

    const nameBytes = new TextEncoder().encode(device.name);
    view.setUint16(pos, nameBytes.length, true); pos += 2;
    for (let i = 0; i < nameBytes.length; i++) view.setUint8(pos++, nameBytes[i]);
    return pos;
}

function encodeMeasurement(buffer, pos, measurement) {
    const view = new DataView(buffer);
    const idBytes = uuid2bytes(measurement.id);
    for (let i = 0; i < 16; i++) view.setUint8(pos++, idBytes[i]);

    const deviceIdBytes = uuid2bytes(measurement.device_id);
    for (let i = 0; i < 16; i++) view.setUint8(pos++, deviceIdBytes[i]);

    view.setUint8(pos++, measurement.type);
    view.setFloat32(pos, measurement.value, true); pos += 4;
    view.setUint32(pos, measurement.created_at, true); pos += 4;
    return pos;
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
        messageView.setUint8(pos++, MessageType.INIT_DEVICES);
        messageView.setUint32(pos, devices.length, true); pos += 4;
        for (const device of devices) {
            pos = encodeDevice(message, pos, device);
        }
        ws.send(message);
    }

    // Send init measurements message
    {
        const message = new ArrayBuffer(1 + 4 + measurements.length * (16 + 16 + 1 + 4 + 4));
        const messageView = new DataView(message);
        let pos = 0;
        messageView.setUint8(pos++, MessageType.INIT_MEASUREMENTS);
        messageView.setUint32(pos, measurements.length, true); pos += 4;
        for (const measurement of measurements) {
            pos = encodeMeasurement(message, pos, measurement);
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
                const measurementClone = { ...measurement };
                if (measurement.type == MeasurementType.TEMPERATURE) measurementClone.type = 'temperature';
                if (measurement.type == MeasurementType.HUMIDITY) measurementClone.type = 'humidity';
                if (measurement.type == MeasurementType.LIGHTNESS) measurementClone.type = 'lightness';
                return measurementClone;
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
                const message = new ArrayBuffer(1 + 16 + 2 + new TextEncoder().encode(device.name).length);
                const messageView = new DataView(message);
                let pos = 0;
                messageView.setUint8(pos++, MessageType.NEW_DEVICE);
                encodeDevice(message, pos, device);
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
            messageView.setUint8(pos++, MessageType.NEW_MEASUREMENTS);
            messageView.setUint32(pos, newMeasurements.length, true); pos += 4;
            for (const measurement of newMeasurements) {
                pos = encodeMeasurement(message, pos, measurement);
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
