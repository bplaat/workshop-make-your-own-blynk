#include <Arduino.h>
#include <ArduinoWebsockets.h>
#include <ESP8266WiFi.h>

#include "config.h"

using namespace websockets;

// Constants
#define MESSAGE_TYPE_LED_UPDATE 1
#define LED_PIN 2

// The led state
bool ledState;
void updateLedState(bool newLedState) {
    ledState = newLedState;

    // Update the LED pin with the current state
    // it's inverted so LOW means LED goes on
    digitalWrite(LED_PIN, !ledState);
}

// Websockets client instance
WebsocketsClient ws;

// Connect to the WiFi network in the config
void wifi_connect(void) {
    Serial.print("\n[WIFI] Connecting to ");
    Serial.print(wifi_ssid);

    WiFi.begin(wifi_ssid, wifi_password);
    while (WiFi.status() != WL_CONNECTED) {
        Serial.print(".");
        delay(500);
    }

    Serial.print("\n[WIFI] IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("[WIFI] MAC address: ");
    Serial.println(WiFi.macAddress());
}

void setup() {
    // Init serial
    Serial.begin(9600);

    // Init led pin
    pinMode(LED_PIN, OUTPUT);

    // Connect to wifi with info from config
    wifi_connect();

    // Connect to websocket
    ws.connect(websocket_url);
    ws.onMessage([](WebsocketsMessage msg) {
        // Get a raw pointer to the websocket message data
        uint8_t *message = (uint8_t *)msg.c_str();

        // The first byte of our message is the message type
        uint8_t type = message[0];

        // If the message is a led update message update the led state
        if (type == MESSAGE_TYPE_LED_UPDATE) {
            updateLedState(message[1]);
            Serial.print("[WS] New led state: ");
            Serial.println(ledState ? "true" : "false");
        }
    });
}

void loop() {
    // Handle websocket connection stuff
    ws.poll();
}
