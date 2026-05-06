#!/bin/bash
# Build Sound It mobile apps for both iOS and Android
# Usage: ./scripts/build-mobile.sh [debug|release]

set -e

BUILD_TYPE=${1:-debug}

echo "=== Sound It Mobile Build ($BUILD_TYPE) ==="
echo ""

# Ensure we're in the app directory
cd "$(dirname "$0")/.."

# Step 1: Build web assets
echo "▶ Building web assets..."
npm run build

# Step 2: Sync to native platforms
echo "▶ Syncing to native platforms..."
npx cap sync

# Step 3: Android build
echo "▶ Building Android..."
if [ "$BUILD_TYPE" = "release" ]; then
  if [ -z "$RELEASE_STORE_FILE" ]; then
    echo "⚠️  RELEASE_STORE_FILE not set. Building with debug signing."
    echo "   For production, generate a keystore: ./scripts/generate-android-keystore.sh"
  fi
  cd android && ./gradlew assembleRelease && cd ..
  echo "✅ Android release APK: android/app/build/outputs/apk/release/app-release.apk"
  echo "✅ Android release AAB: android/app/build/outputs/bundle/release/app-release.aab"
else
  cd android && ./gradlew assembleDebug && cd ..
  echo "✅ Android debug APK: android/app/build/outputs/apk/debug/app-debug.apk"
fi

# Step 4: iOS build
echo "▶ Building iOS..."
echo "   Open Xcode with: npx cap open ios"
echo "   Then use Product → Archive to build for App Store."

echo ""
echo "=== Build Complete ==="
