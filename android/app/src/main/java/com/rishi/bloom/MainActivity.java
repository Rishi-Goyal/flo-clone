package com.rishi.bloom;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // local plugins must be registered before the bridge starts
        registerPlugin(BloomWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
