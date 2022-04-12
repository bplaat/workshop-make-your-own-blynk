import http from 'http';

// Constants
const SERVER_PORT = process.env.PORT || 8080;

// Array to store our received measurements
const measurements = [];

// Create the HTTP server
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
        // Create measurement add it to the measurements
        const measurement = {
            id: measurements.length + 1,
            temperature: parseFloat(searchParams.get('temperature')),
            humidity: parseFloat(searchParams.get('humidity')),
            created_at: Date.now()
        };
        measurements.push(measurement);

        // Return success message
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // 404 Not Found endpoint
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
});

// Start the HTTP server and print started text
server.listen(SERVER_PORT, () => {
    console.log(`[HTTP] Server is listening on http://localhost:${SERVER_PORT}/`);
});
