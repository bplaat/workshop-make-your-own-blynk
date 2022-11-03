// Enable or disable sensors
// #define DHT_ENABLED
#define I2C_TEMP_ENABLED
#define LDR_ENABLED

// Include libraries
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#ifdef DHT_ENABLED
#include <DHT.h>
#endif
#ifdef I2C_TEMP_ENABLED
#include <Wire.h>
#endif
#include "config.h"

// Send variables
#define SEND_PERIOD (2 * 1000)
uint32_t send_time = 0;

// The DHT config
#define DHT_TYPE DHT11
#define DHT_PIN D1
#ifdef DHT_ENABLED
DHT dht(DHT_PIN, DHT_TYPE);
#endif

// The I2C temperature config
#define I2C_TEMP_ADDR 0x4a

// The LDR config
#define LDR_PRECISION 10
#define LDR_PIN A0

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

    // Init sensors
#ifdef DHT_ENABLED
    dht.begin();
#endif
#ifdef I2C_TEMP_ENABLED
    Wire.begin();
#endif
#ifdef LDR_ENABLED
    pinMode(LDR_PIN, INPUT);
#endif

    // Connect to wifi with info from config
    wifi_connect();
}

void loop() {
    // Send DHT measure ment every send period
    if (millis() - send_time > SEND_PERIOD) {
        send_time = millis();
        float temperature = -1;
        float humidity = -1;
        float lightness = -1;

        // Read sensors
#ifdef DHT_ENABLED
        temperature = dht.readTemperature();
        humidity = dht.readHumidity();
#endif
#ifdef I2C_TEMP_ENABLED
        Wire.requestFrom(I2C_TEMP_ADDR, 1);
        temperature = Wire.read();
#endif
#ifdef LDR_ENABLED
        lightness = ((float)analogRead(LDR_PIN) / (float)(1 << LDR_PRECISION)) * 100.f;
#endif

        // Print sensor values
        if (temperature != -1) {
            Serial.print("[SENSOR] Temperature: ");
            Serial.print(temperature);
            Serial.println(" \u00b0C");
        }
        if (humidity != -1) {
            Serial.print("[SENSOR] Humidity: ");
            Serial.print(humidity);
            Serial.println(" %");
        }
        if (lightness != -1) {
            Serial.print("[SENSOR] Lightness: ");
            Serial.print(lightness);
            Serial.println(" %");
        }

        // Send measurement to server
        char url[255];
        sprintf(url, "%s/api/measurements/create?name=%s", api_url, device_name);
        if (temperature != -1) {
            char queryPart[255];
            sprintf(queryPart, "&temperature=%f", temperature);
            strcat(url, queryPart);
        }
        if (humidity != -1) {
            char queryPart[255];
            sprintf(queryPart, "&humidity=%f", humidity);
            strcat(url, queryPart);
        }
        if (lightness != -1) {
            char queryPart[255];
            sprintf(queryPart, "&lightness=%f", lightness);
            strcat(url, queryPart);
        }
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
