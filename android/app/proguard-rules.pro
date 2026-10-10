# ─────────────────────────────────────────────────────────────────────────────
# Swaraj ProGuard / R8 rules
# ─────────────────────────────────────────────────────────────────────────────

# Keep line numbers in stack traces for debugging production crashes
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Capacitor core ────────────────────────────────────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin { *; }

# ── WebView JavaScript interface ──────────────────────────────────────────────
# Keeps any class annotated with @android.webkit.JavascriptInterface callable from JS
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── AndroidX / Jetpack ────────────────────────────────────────────────────────
-keep class androidx.core.app.CoreComponentFactory { *; }
-dontwarn androidx.**

# ── Cordova bridge (used by Capacitor internally) ─────────────────────────────
-keep class org.apache.cordova.** { *; }

# ── Suppress warnings for missing classes in transitive deps ──────────────────
-dontwarn org.apache.cordova.**
-dontwarn com.google.android.gms.**
