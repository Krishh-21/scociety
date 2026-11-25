package com.jodo.demo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;

/** Launches the hosted app in the system browser's authentication context. */
public final class MainActivity extends Activity {
    private static final Uri JODO_URL = Uri.parse("https://jodo-private-demo.vercel.app/");
    private static final String CUSTOM_TAB_SESSION = "android.support.customtabs.extra.SESSION";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        findViewById(R.id.open_jodo).setOnClickListener(view -> openJodo());

        if (savedInstanceState == null) openJodo();
    }

    private void openJodo() {
        View error = findViewById(R.id.browser_error);
        error.setVisibility(View.GONE);

        // Browsers that recognise this extra display a Custom Tab. Other browsers
        // handle the same ACTION_VIEW intent as a regular HTTPS navigation.
        Bundle tab = new Bundle();
        tab.putBinder(CUSTOM_TAB_SESSION, null);
        Intent intent = new Intent(Intent.ACTION_VIEW, JODO_URL)
                .addCategory(Intent.CATEGORY_BROWSABLE)
                .putExtras(tab);

        try {
            startActivity(intent);
        } catch (ActivityNotFoundException noBrowser) {
            error.setVisibility(View.VISIBLE);
        }
    }
}
