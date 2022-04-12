package com.example.controller;

import javax.swing.SwingUtilities;

public class Main {
    private Main() {}

    public static void main(String[] args) {
        SwingUtilities.invokeLater(App.getInstance());
    }
}
