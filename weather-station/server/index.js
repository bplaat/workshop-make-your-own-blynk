import http from 'http';
import { WebSocketServer } from 'ws';

// Constants
const SERVER_PORT = process.env.PORT || 8080;

const MessageType = {
    INIT_MEASUREMENTS: 1,
    NEW_MEASUREMENTS: 2
};

const MeasurementType = {
    TEMPERATURE: 1,
    HUMIDITY: 2,
    LIGHTNESS: 3
};

// Array to store our received measurements
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

    // Send all measurements to the client
    const message = new ArrayBuffer(1 + 4 + measurements.length * (4 + 1 + 4 + 4));
    const messageView = new DataView(message);
    let pos = 0;
    messageView.setUint8(pos, MessageType.INIT_MEASUREMENTS); pos += 1;
    messageView.setUint32(pos, measurements.length, true); pos += 4;
    for (const measurement of measurements) {
        messageView.setUint32(pos, measurement.id, true); pos += 4;
        messageView.setUint8(pos, measurement.type); pos += 1;
        messageView.setFloat32(pos, measurement.value, true); pos += 4;
        messageView.setUint32(pos, measurement.created_at, true); pos += 4;
    }
    ws.send(message);
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

    // List measurements endpoint
    if (pathname == '/api/measurements') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: measurements }));
        return;
    }

    // Create measurements endpoint
    if (pathname == '/api/measurements/create') {
        const newMeasurements = [];

        // Create temperature measurement when given
        if (searchParams.has('temperature')) {
            const measurement = {
                id: measurements.length + 1,
                type: MeasurementType.TEMPERATURE,
                value: parseFloat(searchParams.get('temperature')),
                created_at: Math.floor(Date.now() / 1000)
            };
            measurements.push(measurement);
            newMeasurements.push(measurement);
        }

        // Create humidity measurement when given
        if (searchParams.has('humidity')) {
            const measurement = {
                id: measurements.length + 1,
                type: MeasurementType.HUMIDITY,
                value: parseFloat(searchParams.get('humidity')),
                created_at: Math.floor(Date.now() / 1000)
            };
            measurements.push(measurement);
            newMeasurements.push(measurement);
        }

        // Create lightness measurement when given
        if (searchParams.has('lightness')) {
            const measurement = {
                id: measurements.length + 1,
                type: MeasurementType.LIGHTNESS,
                value: parseFloat(searchParams.get('lightness')),
                created_at: Math.floor(Date.now() / 1000)
            };
            measurements.push(measurement);
            newMeasurements.push(measurement);
        }

        // Send connected websocket clients a message
        if (clients.length > 0) {
            const message = new ArrayBuffer(1 + 4 + newMeasurements.length * (4 + 1 + 4 + 4));
            const messageView = new DataView(message);
            let pos = 0;
            messageView.setUint8(pos, MessageType.NEW_MEASUREMENTS); pos += 1;
            messageView.setUint32(pos, newMeasurements.length, true); pos += 4;
            for (const measurement of newMeasurements) {
                messageView.setUint32(pos, measurement.id, true); pos += 4;
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
