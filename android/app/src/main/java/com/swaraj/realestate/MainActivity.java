package com.swaraj.realestate;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Install the splash screen BEFORE super.onCreate()
        // This shows the splash immediately on cold start
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }
}
