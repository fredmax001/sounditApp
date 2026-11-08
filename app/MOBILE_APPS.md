# Sound It — Mobile Apps (iOS & Android)

> Built with [Capacitor](https://capacitorjs.com/) wrapping the existing React web app.

---

## Project Structure

```
app/
├── android/          # Android Studio project (Capacitor)
├── ios/              # Xcode project (Capacitor)
├── assets/           # Source images for icons & splash screens
│   ├── icon.png      # 1024×1024 app icon source
│   └── splash.png    # 2732×2732 splash screen source
├── src/
│   ├── lib/appUrl.ts       # Web URL helper for share links
│   ├── components/DeepLinkHandler.tsx  # Deep link routing
│   └── main.tsx            # Capacitor native plugin init
├── capacitor.config.ts     # Capacitor configuration
└── MOBILE_APPS.md          # This file
```

---

## What Works

- **Full SPA experience** — All React routes, auth, payments, events, tickets, etc.
- **Native share sheet** — Uses Capacitor Share plugin for system-level sharing
- **Camera access** — Capacitor Camera plugin ready for photo uploads
- **Status bar styling** — Black background with light icons
- **Splash screen** — Branded splash on app launch
- **Deep links** — `https://sounditent.com/events/5` opens directly in the app
- **Safe areas** — CSS `env(safe-area-inset-*)` handles notches & home indicators

---

## Prerequisites

### macOS (required for iOS builds)

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | `brew install node` |
| Java | 21 | `brew install openjdk@21` |
| Xcode | 15+ | Mac App Store |
| Android Studio | Latest | [developer.android.com/studio](https://developer.android.com/studio) |
| CocoaPods | Latest | `sudo gem install cocoapods` |

### Environment Setup

Add to your `~/.zshrc` or `~/.bash_profile`:

```bash
# Java 21 (required for Android builds)
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH=$JAVA_HOME/bin:$PATH

# Android SDK (adjust path if installed elsewhere)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
```

Then reload: `source ~/.zshrc`

---

## Quick Start

### 1. Install dependencies

```bash
cd app
npm install
```

### 2. Build web assets & sync to native projects

```bash
npm run build
npx cap sync
```

### 3. Open native IDEs

```bash
# Android Studio
npx cap open android

# Xcode
npx cap open ios
```

---

## Android

### Debug Build (test locally)

```bash
cd android
./gradlew assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release Build (for Google Play)

#### Step 1: Generate your release keystore (ONCE ONLY)

```bash
cd app
bash scripts/generate-android-keystore.sh
```

**⚠️ BACKUP THE KEYSTORE FILE AND PASSWORDS.**
If you lose them, you cannot update the app on Google Play ever again.

#### Step 2: Set environment variables

```bash
export RELEASE_STORE_FILE=/path/to/soundit-release.keystore
export RELEASE_STORE_PASSWORD=your_keystore_password
export RELEASE_KEY_ALIAS=soundit
export RELEASE_KEY_PASSWORD=your_key_password
```

#### Step 3: Build release AAB

```bash
cd android
./gradlew bundleRelease
```

AAB output: `android/app/build/outputs/bundle/release/app-release.aab`

Upload this `.aab` file to Google Play Console.

### Android Version Bump

Edit `android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        versionCode 2        // Increment by 1 for every release
        versionName "1.1.0"  // Human-readable version
    }
}
```

---

## iOS

### Build from Xcode

1. Open the project:
   ```bash
   npx cap open ios
   ```

2. In Xcode, select the **App** target and configure:
   - **Signing & Capabilities** → Select your Apple Developer Team
   - **Bundle Identifier**: `com.sounditent.app`
   - **Deployment Target**: iOS 15.0

3. Select a device/simulator and press **Cmd+R** to run.

### Archive for App Store

1. In Xcode, select **Any iOS Device (arm64)** as the target.
2. Go to **Product → Archive**.
3. In the Organizer window, click **Distribute App** → **App Store Connect**.
4. Follow the prompts to upload.

### iOS Version Bump

Edit in Xcode or edit `ios/App/App.xcodeproj/project.pbxproj`:

- `MARKETING_VERSION` = `1.1.0` (human-readable)
- `CURRENT_PROJECT_VERSION` = `2` (build number, must increase)

---

## Deep Linking

### Android
Already configured in `AndroidManifest.xml`:
- `https://sounditent.com/events/*`
- `https://sounditent.com/profiles/*`
- `https://sounditent.com/artists/*`
- `https://sounditent.com/vendors/*`
- Custom scheme: `soundit://open/...`

### iOS
Configured in `Info.plist`:
- Associated domain: `applinks:sounditent.com`
- URL scheme: `soundit://`

**⚠️ For iOS Universal Links to work**, you must host an `apple-app-site-association` file at:
```
https://sounditent.com/.well-known/apple-app-site-association
```

Sample content:
```json
{
  "applinks": {
    "details": [{
      "appIDs": ["TEAM_ID.com.sounditent.app"],
      "paths": ["/events/*", "/profiles/*", "/artists/*", "/vendors/*"]
    }]
  }
}
```

---

## Store Submission Checklist

### Google Play Store

- [ ] Create Google Play Developer account ($25 one-time fee)
- [ ] Create app in Play Console
- [ ] Upload release AAB (`bundleRelease`)
- [ ] Fill store listing (title, description, screenshots)
- [ ] Set up Content Rating questionnaire
- [ ] Add Privacy Policy URL (`https://sounditent.com/privacy`)
- [ ] Configure app pricing & distribution
- [ ] Submit for review

### Apple App Store

- [ ] Enroll in Apple Developer Program ($99/year)
- [ ] Create app in App Store Connect
- [ ] Upload build via Xcode Organizer
- [ ] Fill App Information (name, subtitle, description)
- [ ] Upload screenshots for all required device sizes
- [ ] Add Privacy Policy URL
- [ ] Complete App Privacy (data collection disclosures)
- [ ] Set Pricing & Availability
- [ ] Submit for review

---

## Capacitor Workflow

After making changes to the React app:

```bash
cd app
npm run build          # Build web assets
npx cap sync           # Copy to native projects + update plugins
npx cap open android   # Or ios, to test in native IDE
```

**Do NOT edit files inside `android/` or `ios/` manually** unless you know they won't be overwritten by `cap sync`. Safe to edit:
- `AndroidManifest.xml`
- `build.gradle` (app-level)
- Xcode project settings (signing, capabilities)
- Native plugin configurations

---

## Troubleshooting

### Android build fails with "invalid source release: 21"
Make sure `JAVA_HOME` points to Java 21:
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH=$JAVA_HOME/bin:$PATH
java -version  # Should show 21
```

### iOS build fails with signing errors
In Xcode, go to **Signing & Capabilities** and select your Apple Developer Team. If you don't have one, enroll at [developer.apple.com](https://developer.apple.com).

### App shows white screen on launch
Check the JavaScript console for errors. In Safari (iOS) or Chrome (Android), use the remote debugger.

### Deep links not working
- **Android**: Verify `assetlinks.json` is hosted at `https://sounditent.com/.well-known/assetlinks.json`
- **iOS**: Verify `apple-app-site-association` is hosted and your App ID prefix is correct.

---

## Native Plugins Installed

| Plugin | Purpose |
|--------|---------|
| `@capacitor/app` | App state, back button, URL open events |
| `@capacitor/browser` | In-app browser for external links |
| `@capacitor/camera` | Native camera for photo uploads |
| `@capacitor/share` | Native share sheet |
| `@capacitor/splash-screen` | Branded launch screen |
| `@capacitor/status-bar` | Status bar color & style |

---

## Support

For Capacitor-specific issues: [capacitorjs.com/docs](https://capacitorjs.com/docs)
For Android signing: [developer.android.com/studio/publish/app-signing](https://developer.android.com/studio/publish/app-signing)
For iOS distribution: [developer.apple.com/documentation/xcode/distributing-your-app](https://developer.apple.com/documentation/xcode/distributing-your-app)
