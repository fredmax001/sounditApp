#!/bin/bash
# Generate Android release keystore for Sound It app
# Run this ONCE and keep the keystore file + credentials safe.
# You CANNOT update the app on Google Play without the same keystore.

set -e

KEYSTORE_FILE="soundit-release.keystore"
KEY_ALIAS="soundit"
VALIDITY_DAYS=10000

if [ -f "$KEYSTORE_FILE" ]; then
  echo "⚠️  Keystore already exists: $KEYSTORE_FILE"
  echo "   If you lost the original, you cannot recover it. You must create a new Play Store app."
  exit 1
fi

echo "=== Sound It Android Release Keystore ==="
echo "This keystore is required to sign your app for Google Play."
echo "Store it in a password manager along with the password you choose."
echo ""

keytool -genkey -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity "$VALIDITY_DAYS"

echo ""
echo "✅ Keystore created: $KEYSTORE_FILE"
echo ""
echo "Next steps:"
echo "1. Move $KEYSTORE_FILE to a safe location (e.g. ~/keystores/)"
echo "2. Set these environment variables before building:"
echo "   export RELEASE_STORE_FILE=/path/to/$KEYSTORE_FILE"
echo "   export RELEASE_STORE_PASSWORD=<your_keystore_password>"
echo "   export RELEASE_KEY_ALIAS=$KEY_ALIAS"
echo "   export RELEASE_KEY_PASSWORD=<your_key_password>"
echo "3. Build release AAB: cd android && ./gradlew bundleRelease"
echo "4. Upload android/app/build/outputs/bundle/release/app-release.aab to Google Play"
