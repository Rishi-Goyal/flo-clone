package com.rishi.bloom;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge: BloomWidget.update({ json }) stores the snapshot and redraws widgets. */
@CapacitorPlugin(name = "BloomWidget")
public class BloomWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json", "{}");
        getContext()
            .getSharedPreferences(BloomWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(BloomWidgetProvider.KEY, json)
            .apply();
        BloomWidgetProvider.refreshAll(getContext());
        call.resolve();
    }
}
