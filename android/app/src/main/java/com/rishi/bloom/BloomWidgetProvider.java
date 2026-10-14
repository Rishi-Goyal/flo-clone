package com.rishi.bloom;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * Home-screen widget. The web app pushes a small JSON snapshot through
 * BloomWidgetPlugin; this provider renders it, recomputing the day-relative
 * values (cycle day, countdown, phase) from dates so the widget stays correct
 * every day even if the app isn't opened. No network, no credentials.
 */
public class BloomWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "bloom_widget";
    static final String KEY = "snapshot";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context));
    }

    /** Re-render every placed Bloom widget (called after a new snapshot). */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, BloomWidgetProvider.class));
        if (ids.length == 0) return;
        RemoteViews views = render(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    static RemoteViews render(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.bloom_widget);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(
            context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONObject s;
        try {
            s = new JSONObject(prefs.getString(KEY, "{}"));
        } catch (Exception e) {
            s = new JSONObject();
        }
        String role = s.optString("role", "none");
        long today = todayEpochDay();

        String title;
        String phase = null;
        int cycleDay = -1;
        Integer daysUntil = null;
        int daysLate = 0;
        String confidence = s.optString("confidence", "low");
        int window = s.optInt("windowDays", 4);
        boolean stale = false;

        if ("tracker".equals(role) && s.has("lastPeriodStart")) {
            title = "Bloom";
            cycleDay = (int) (today - epochDay(s.optString("lastPeriodStart"))) + 1;
            if (s.has("predictedNextStart")) {
                daysUntil = (int) (epochDay(s.optString("predictedNextStart")) - today);
                daysLate = Math.max(0, -daysUntil - window);
            }
            if (cycleDay <= Math.round(s.optDouble("avgPeriodLength", 5))) {
                phase = "menstrual";
            } else if (s.has("ovulationDate")) {
                long dist = today - epochDay(s.optString("ovulationDate"));
                phase = Math.abs(dist) <= 1 ? "ovulation" : (dist < -1 ? "follicular" : "luteal");
            } else {
                phase = "follicular";
            }
        } else if ("partner".equals(role) && s.has("phase")) {
            String owner = s.optString("ownerName", "");
            title = owner.isEmpty() ? "Bloom" : owner + "’s cycle";
            long elapsed = s.has("asOf") ? today - epochDay(s.optString("asOf")) : 0;
            phase = s.optString("phase");
            cycleDay = s.optInt("cycleDay", 0) + (int) elapsed;
            if (s.has("daysUntil")) {
                daysUntil = s.optInt("daysUntil") - (int) elapsed;
                daysLate = Math.max(0, -daysUntil - window);
            }
            // the partner never gets the raw dates, so the phase can't be
            // recomputed natively — ask for a refresh once it may be stale
            stale = elapsed >= 3;
        } else {
            title = "Bloom";
        }

        v.setTextViewText(R.id.widget_title, title);

        if (phase == null || cycleDay < 1) {
            v.setTextViewText(R.id.widget_day, "—");
            v.setTextViewText(R.id.widget_phase, "No cycle data yet");
            v.setTextViewText(R.id.widget_sub, "Open Bloom to get started");
            v.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_bg_none);
            v.setTextColor(R.id.widget_phase, 0xFF8A6B7D);
            return v;
        }

        v.setTextViewText(R.id.widget_day, "Day " + cycleDay);
        v.setTextViewText(R.id.widget_phase, phaseLabel(phase));
        v.setTextColor(R.id.widget_phase, phaseText(phase));
        v.setInt(R.id.widget_root, "setBackgroundResource", phaseBg(phase));

        String sub;
        if (stale) {
            sub = "Open Bloom to refresh";
        } else if (daysLate > 0) {
            sub = "Period " + daysLate + (daysLate == 1 ? " day late" : " days late");
        } else if (daysUntil == null) {
            sub = "";
        } else if (daysUntil <= 0) {
            sub = "Period expected around now";
        } else if ("high".equals(confidence)) {
            sub = "Next period in ~" + daysUntil + (daysUntil == 1 ? " day" : " days");
        } else {
            sub = "Next period in " + Math.max(0, daysUntil - window) + "–" + (daysUntil + window) + " days";
        }
        v.setTextViewText(R.id.widget_sub, sub);
        return v;
    }

    static String phaseLabel(String phase) {
        switch (phase) {
            case "menstrual": return "Period";
            case "follicular": return "Follicular phase";
            case "ovulation": return "Ovulation";
            default: return "Luteal phase";
        }
    }

    static int phaseText(String phase) {
        switch (phase) {
            case "menstrual": return 0xFF8F2B4C;
            case "follicular": return 0xFF8A5C12;
            case "ovulation": return 0xFF2F6D59;
            default: return 0xFF6E51A0;
        }
    }

    static int phaseBg(String phase) {
        switch (phase) {
            case "menstrual": return R.drawable.widget_bg_menstrual;
            case "follicular": return R.drawable.widget_bg_follicular;
            case "ovulation": return R.drawable.widget_bg_ovulation;
            default: return R.drawable.widget_bg_luteal;
        }
    }

    /** yyyy-MM-dd -> days since epoch (UTC calendar math; avoids java.time on API 24/25). */
    static long epochDay(String iso) {
        try {
            String[] p = iso.split("-");
            Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
            c.clear();
            c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
            return c.getTimeInMillis() / 86400000L;
        } catch (Exception e) {
            return todayEpochDay();
        }
    }

    /** The device's local calendar date, as an epoch day. */
    static long todayEpochDay() {
        Calendar local = Calendar.getInstance();
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.clear();
        c.set(local.get(Calendar.YEAR), local.get(Calendar.MONTH), local.get(Calendar.DAY_OF_MONTH));
        return c.getTimeInMillis() / 86400000L;
    }
}
