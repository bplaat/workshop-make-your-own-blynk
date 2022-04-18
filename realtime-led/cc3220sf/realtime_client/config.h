#ifndef CONFIG_H
#define CONFIG_H

#include <WiFi.h>

extern const char *wifi_ssid;
extern const char *wifi_password;
extern IPAddress websocket_ip;
extern uint16_t websocket_port;

#endif
