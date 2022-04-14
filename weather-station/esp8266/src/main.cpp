#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <DHT.h>
#include "config.h"

// Send variables
#define SEND_PERIOD (2 * 1000)
uint32_t send_time = 0;

// The DHT config
#define DHT_TYPE DHT11
#define DHT_PIN D1
DHT dht(DHT_PIN, DHT_TYPE);

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

    // Init DHT sensor
    dht.begin();

    // Connect to wifi with info from config
    wifi_connect();
}

void loop() {
    // Send DHT measure ment every send period
    if (millis() - send_time > SEND_PERIOD) {
        send_time = millis();

        // Read and print values from DHT sensor
        float temperature = dht.readTemperature();
        float humidity = dht.readHumidity();

        Serial.print("[DHT] Temperature: ");
        Serial.print(temperature);
        Serial.println(" \u00b0C");

        Serial.print("[DHT] Humidity: ");
        Serial.print(humidity);
        Serial.println(" %");

        // Send measurement to server
        char url[255];
        sprintf(url, "%s/api/measurements/create?temperature=%f&humidity=%f", api_url, temperature, humidity);
        Serial.print("[HTTP] ");
        Serial.println(url);

        WiFiClient wifi_client;
        HTTPClient http_client;
        http_client.begin(wifi_client, url);
        if (http_client.GET() == HTTP_CODE_OK) {
            Serial.println("[HTTP] Measurement send successfull");
        } else {
            Serial.println("[HTTP] HTTP error when sending measurement");
        }
    }
}
