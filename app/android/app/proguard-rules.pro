# ProGuard / R8 Optimization & Keep Rules for Capacitor & SoundIt App

# Capacitor Core
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# Capacitor Native Plugins
-keep class ee.forgr.social.login.** { *; }
-keep class com.capacitorjs.plugins.** { *; }

# Android WebKit JavaScript Interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve Stack Traces & Annotations
-keepattributes SourceFile,LineNumberTable,Signature,InnerClasses,EnclosingMethod,*Annotation*
-dontwarn com.getcapacitor.**
-dontwarn ee.forgr.social.login.**
