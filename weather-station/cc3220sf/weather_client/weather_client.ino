#include <WiFi.h>
#include <Wire.h>
#include "config.h"

// I2C Temperature address
#define TEMPERATURE_ADDRESS 0x4a

// LDR pin
#define LDR_PRECISION 12
#define LDR_PIN 24

// Send variables
#define SEND_PERIOD (2 * 1000)
uint32_t send_time = 0;

// The wifi client instance
WiFiClient client;

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

    // Init i2c
    Wire.begin();

    // Init lightness sensor
    analogReadResolution(LDR_PRECISION);
    pinMode(LDR_PIN, INPUT);

    // Connect to wifi with info from config
    wifi_connect();
}

void loop() {
    // Send DHT measure ment every send period
    if (millis() - send_time > SEND_PERIOD) {
        send_time = millis();

        // Read i2c temperature sensor
        Wire.requestFrom(TEMPERATURE_ADDRESS, 1);
        uint8_t temperature = Wire.read();
        Serial.print("[IN] Temperature: ");
        Serial.print(temperature);
        Serial.println(" \u00b0C");

        // Read LDR sensor
        float lightness = ((float)analogRead(LDR_PIN) / (float)(1 << LDR_PRECISION)) * 100.f;
        Serial.print("[IN] Lightness: ");
        Serial.print(lightness);
        Serial.println(" %");

        // Send simple raw HTTP 1.1 GET request to server
        client.stop();
        if (client.connect(api_ip, api_port)) {
            // Start of any HTTP GET request
            client.print("GET /api/measurements/create?name=");
            client.print(device_name);
            client.print("&temperature=");
            client.print(temperature);
            client.print("&lightness=");
            client.print(lightness);
            client.println(" HTTP/1.1");

            // Host HTTP header: mandatory HTTP header for HTTP 1.1 request
            client.print("Host: ");
            client.print(api_ip);
            client.print(":");
            client.println(api_port);

            // Connection HTTP header: close TCP connection when HTTP request is complete
            // And an empty line so HTTP request is done
            client.println("Connection: close");
            client.println();
        } else {
            Serial.println("[HTTP] Can't send a HTTP request to the server!");
        }
    }
}
