package com.example.controller;

import java.awt.Component;
import java.awt.Dimension;
import java.awt.Font;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.UIManager;

public class App implements Runnable {
    private static App instance = new App();

    private boolean ledState;

    private JButton toggleButton;

    private App() {}

    public static App getInstance() {
        return instance;
    }

    // Update led state and button text
    private void updateLedState(boolean newLedState) {
        ledState = newLedState;
        toggleButton.setText(ledState ? "ON" : "OFF");
    }

    // Runs in the right Swing UI Thread
    public void run() {
        // Use native OS theme because the default Java Swing theme is super super super ugly!
        try {
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        } catch (Exception exception) {
            exception.printStackTrace();
        }

        // Create the window
        JFrame frame = new JFrame("Realtime LED Controller");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setSize(800, 600);
        frame.setMinimumSize(new Dimension(320, 240));
        frame.setLocationRelativeTo(null);

        // Create client instance
        Client client = Client.getInstance();
        client.setOnLedStateUpdateListener(newLedState -> {
            updateLedState(newLedState);
        });

        // Create the rest of the GUI
        JPanel root = new JPanel();
        root.setLayout(new BoxLayout(root, BoxLayout.PAGE_AXIS));
        frame.add(root);

        root.add(Box.createVerticalGlue());

        JLabel headerLabel = new JLabel("Realtime LED Controller");
        headerLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        headerLabel.setFont(headerLabel.getFont().deriveFont(Font.BOLD, 32.f));
        root.add(headerLabel);

        root.add(Box.createVerticalStrut(16));

        toggleButton = new JButton("Connecting...");
        toggleButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        toggleButton.setFont(headerLabel.getFont().deriveFont(16.f));
        toggleButton.setPreferredSize(new Dimension(0, 64));
        toggleButton.addActionListener(event -> {
            if (!client.isConnected()) return;
            updateLedState(!ledState);
            client.updateLedState(ledState);
        });
        root.add(toggleButton);

        root.add(Box.createVerticalGlue());

        // Show window
        frame.setVisible(true);

        // Connect to the websocket server
        client.connect();
    }
}
