#include <WiFi.h>
#include <Wire.h>
#include "config.h"

// Constants
#define MESSAGE_TYPE_LED_UPDATE 1

// The led state
bool ledState;
void updateLedState(bool newLedState) {
    ledState = newLedState;

    // Update the LED pin with the current state
    digitalWrite(RED_LED, ledState);
    digitalWrite(GREEN_LED, ledState);
    digitalWrite(YELLOW_LED, ledState);
}

// Handle incomming websocket messages
void websocket_handle_message(uint8_t *message) {
    // The first byte of our message is the message type
    uint8_t type = message[0];

    // If the message is a led update message update the led state
    if (type == MESSAGE_TYPE_LED_UPDATE) {
        updateLedState(message[1]);
        Serial.print("[WS] New led state: ");
        Serial.println(ledState ? "true" : "false");
    }
}

// Connect to WiFi
void wifi_connect(void) {
    // Connect to the WiFi network in the config
    Serial.print("\n[WIFI] Connecting to ");
    Serial.print(wifi_ssid);

    WiFi.begin((char *)wifi_ssid, (char *)wifi_password);
    while (WiFi.status() != WL_CONNECTED) {
        Serial.print(".");
        delay(500);
    }

    // Print local IP address
    Serial.print("\n[WIFI] IP address: ");
    Serial.println(WiFi.localIP());

    // Print the micocontroller's MAC address
    uint8_t macAddress[6];
    WiFi.macAddress(macAddress);
    Serial.print("[WIFI] MAC address: ");
    Serial.print(macAddress[0], HEX);
    Serial.print(":");
    Serial.print(macAddress[1], HEX);
    Serial.print(":");
    Serial.print(macAddress[2], HEX);
    Serial.print(":");
    Serial.print(macAddress[3], HEX);
    Serial.print(":");
    Serial.print(macAddress[4], HEX);
    Serial.print(":");
    Serial.println(macAddress[5], HEX);
}

void setup() {
    // Init serial
    Serial.begin(9600);

    // Init led pins
    pinMode(RED_LED, OUTPUT);
    pinMode(GREEN_LED, OUTPUT);
    pinMode(YELLOW_LED, OUTPUT);

    // Connect to wifi with info from config
    wifi_connect();
}

void loop() {
    // A super simple websocket client (dont use in production it is not conform spec)
    // See https://datatracker.ietf.org/doc/html/rfc6455 for more info about the Websocket spec
    WiFiClient client;
    if (client.connect(websocket_ip, websocket_port)) {
        // Send HTTP request with upgrade to websocket headers
        client.println("GET / HTTP/1.1");
        client.print("Host: ");
        client.print(websocket_ip);
        client.print(":");
        client.println(websocket_port);
        client.println("Connection: Upgrade");
        client.println("Sec-WebSocket-Version: 13");
        client.println("Sec-WebSocket-Key: 2cN9hgbncbm4s4W9z0/fKQ=="); // Hard code security key always nice :)
        client.println("Upgrade: websocket");
        client.println();

        // Read intial HTTP upgrade response
        while (!(client.read() == '\r' && client.read() == '\n' && client.read() == '\r' && client.read() == '\n'));
        Serial.println("[WS] We have connected to the websocket server!");

        // Read incoming websocket frames
        while (client.connected()) {
            if (client.available() > 0) {
                // We only accept small websocket frames
                uint8_t buffer[4];
                buffer[0] = client.read(); // 0 - 3: Opcode
                buffer[1] = client.read(); // 0 - 7: Payload length
                for (int32_t i = 0; i < buffer[1] & 127; i++) {
                    uint8_t byte = client.read();
                    if (i < 2) buffer[2 + i] = byte;
                }

                // We it is a binary data frame we send it to the handle message function
                if ((buffer[0] & 0xf) == 2) {
                    websocket_handle_message(&buffer[2]);
                }
            }
        }

        // When the client disconnects we stop
        client.stop();
        Serial.println("[WS] We have disconnect from the websocket server!");
    } else {
        Serial.println("[WS] Can't connect to the websocket server!");
    }

    // After some delay we reconnect with the Websocket server
    delay(2500);
}
