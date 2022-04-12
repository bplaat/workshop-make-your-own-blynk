package com.example.controller;

import java.nio.ByteBuffer;
import java.net.URI;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

public class Client extends WebSocketClient {
    public static interface OnLedStateUpdateListener {
        public void onLedStateUpdate(boolean newLedState);
    }

    public static final int MESSAGE_TYPE_LED_UPDATE = 1;

    private static Client instance = null;

    private boolean connected = false;

    private OnLedStateUpdateListener onLedStateUpdateListener = null;

    private Client(URI uri) {
        super(uri);
    }

    // Creates or gets the single client instance
    public static Client getInstance() {
        if (instance == null) {
            try {
                instance = new Client(new URI(Config.WEBSOCKET_URL));
            } catch (Exception exception) {
                exception.printStackTrace();
            }
        }
        return instance;
    }

    // Returns if the client is connected
    public boolean isConnected() {
        return connected;
    }

    // Set the on led state update listener
    public void setOnLedStateUpdateListener(OnLedStateUpdateListener onLedStateUpdateListener) {
        this.onLedStateUpdateListener = onLedStateUpdateListener;
    }

    // Send a led state update message
    public void updateLedState(boolean newLedState) {
        byte[] message = new byte[2];
        message[0] = MESSAGE_TYPE_LED_UPDATE;
        message[1] = (byte)(newLedState ? 1 : 0);
        send(message);
    }

    // Listen when the connection opens
    public void onOpen(ServerHandshake handshakedata) {
        connected = true;
    }

    // Listen to incoming message
    public void onMessage(String data) {}
    public void onMessage(ByteBuffer data) {
        // Get a byte array from the incoming message
        byte[] message = data.array();

        // The first byte of our message is the message type
        int type = message[0];

        // If the message is a led update message call the led state update listener
        if (type == MESSAGE_TYPE_LED_UPDATE && onLedStateUpdateListener != null) {
            onLedStateUpdateListener.onLedStateUpdate(message[1] == 1);
        }
    }

    // Listen to websocket closes
    public void onClose(int code, String reason, boolean remote) {
        connected = false;
    }

    // Listen to websocket errors
    public void onError(Exception exception) {
        exception.printStackTrace();
    }
}
