import { WebSocketServer } from 'ws';

// Constants
const MESSAGE_TYPE_LED_UPDATE = 1;
const SERVER_PORT = process.env.PORT || 8080;

// Led state
let ledState = false;

// Websocket server
let clients = [];
const wss = new WebSocketServer({ port: SERVER_PORT });
wss.on('connection', ws => {
    // Add this client to clients array
    clients.push({ ws });

    // Process incoming messages from this client
    ws.on('message', data => {
        // Copy data from Node.js buffer to the nice DataView
        const message = new Uint8Array(data.byteLength);
        data.copy(message, 0, 0, data.byteLength);
        const messageView = new DataView(message.buffer);

        // The first byte of our message is the message type
        const type = messageView.getUint8(0);

        // When we get a led update message we read the new led state and broadcast it to all other clients
        if (type == MESSAGE_TYPE_LED_UPDATE) {
            ledState = messageView.getUint8(1);
            console.log(`[WS] New led state: ${ledState == 1}`);

            // Send the update message to all other clients
            const message = new ArrayBuffer(2);
            const messageView = new DataView(message);
            messageView.setUint8(0, MESSAGE_TYPE_LED_UPDATE);
            messageView.setUint8(1, ledState);
            for (const client of clients.filter(client => client.ws != ws)) {
                client.ws.send(message);
            }
        }
    });

    // Remove the client from the clients array when it disconnects
    ws.on('close', () => {
        clients = clients.filter(client => client.ws != ws);
    });

    // Send connecting client the current led state
    const message = new ArrayBuffer(2);
    const messageView = new DataView(message);
    messageView.setUint8(0, MESSAGE_TYPE_LED_UPDATE);
    messageView.setUint8(1, ledState);
    ws.send(message);
});

// Print message when the server is ready
console.log(`[WS] Websocket server is listening on ws://localhost:${SERVER_PORT}/`);
