# Workshop Make your own Blynk
This is a workshop that shows you how you can create your own small IoT system with an ESP8266, a simple website client and a Node.js backend server

## The two projects
In this workshop we are going to create two different projects:
- The first project is a realtime system to control a LED on our ESP with a button on a website and a Java Desktop app
- The second project is a simple weather station that uses a DHT sensor with and our ESP to send measurements to a server which are then displayed on our website in a realtime chart

## Build instructions
This are the instructions that you need to follow to build and run the two examples on your own computer:

### Node.js websocket server
- Install [Node.js latest version](https://nodejs.org/en/) if you don't have it and add it to your $PATH
- Go to the right folder `cd server`
- Install the packages with `npm install`
- Run the server with `npm start`

### ESP8266 micocontroller
- Install [Visual Studio Code](https://code.visualstudio.com/) if you don't have it
- Go to the right folder `cd microcontroller`
- Install the [Platform IO extension](https://marketplace.visualstudio.com/items?itemName=platformio.platformio-ide) and active it in the folder
- When you are building the Weather Station you need to connect a DHT11 sensor to pin D1 see the [Breadboard Scheme](weather-station/microcontroller/docs/breadboard-scheme.png)
- Copy the `config.cpp.example` to `config.cpp` and fill in your WiFi info and your computer local IP-adress and server port
- When Platform IO is loaded and everything is downloaded you can build and upload the program with the buttons in the bottom statusbar

### Website client
- Just double click the `website/index.html` HTML file to open it in your browser
- Or start a integrated web server in Visual Studio Code with the [Live Server extention](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
- Or use python as a simple HTTP server `cd website` and `python3 -m http.server 5500` then go to `http://localhost:5500/`

### Java Desktop App (only for Realtime LED example)
- Install [Java JDK 8 or higher](https://adoptium.net/temurin/releases) and add it to your $PATH
- Install [Maven](https://maven.apache.org/download.cgi) and add it also to your $PATH
- Go to the right folder `cd realtime-led/java-app`
- Use `./build.sh` to compile and run the application direct
- Use `./build.sh release` to build a static jar file that you can find in the `target/` folder
