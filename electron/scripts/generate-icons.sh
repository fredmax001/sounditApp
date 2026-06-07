#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sound It — Icon Generation Script
# Converts icon.png → icon.icns (macOS) + icon.ico (Windows) + tray-icon.png
#
# Requirements (macOS — all built-in):
#   • sips      (pre-installed on macOS)
#   • iconutil  (pre-installed on macOS)
#   • ImageMagick (for .ico) — install: brew install imagemagick
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
SRC_PNG="$BUILD_DIR/icon.png"

echo "🎨 Sound It Icon Generator"
echo "────────────────────────────"

# Verify source exists
if [ ! -f "$SRC_PNG" ]; then
  echo "❌ Error: $SRC_PNG not found."
  echo "   Please place your 1024x1024 PNG icon at: $SRC_PNG"
  exit 1
fi

echo "✅ Source icon found: $SRC_PNG"

# ─── macOS .icns ──────────────────────────────────────────────────────────────
echo ""
echo "📦 Generating macOS .icns..."

ICONSET_DIR="$BUILD_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"

# Generate all required macOS icon sizes using individual sips calls
sips -z 16   16   "$SRC_PNG" --out "$ICONSET_DIR/icon_16x16.png"      > /dev/null 2>&1 && echo "   ✓ 16x16"
sips -z 32   32   "$SRC_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png"   > /dev/null 2>&1 && echo "   ✓ 16x16@2x"
sips -z 32   32   "$SRC_PNG" --out "$ICONSET_DIR/icon_32x32.png"      > /dev/null 2>&1 && echo "   ✓ 32x32"
sips -z 64   64   "$SRC_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png"   > /dev/null 2>&1 && echo "   ✓ 32x32@2x"
sips -z 128  128  "$SRC_PNG" --out "$ICONSET_DIR/icon_128x128.png"    > /dev/null 2>&1 && echo "   ✓ 128x128"
sips -z 256  256  "$SRC_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png" > /dev/null 2>&1 && echo "   ✓ 128x128@2x"
sips -z 256  256  "$SRC_PNG" --out "$ICONSET_DIR/icon_256x256.png"    > /dev/null 2>&1 && echo "   ✓ 256x256"
sips -z 512  512  "$SRC_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png" > /dev/null 2>&1 && echo "   ✓ 256x256@2x"
sips -z 512  512  "$SRC_PNG" --out "$ICONSET_DIR/icon_512x512.png"    > /dev/null 2>&1 && echo "   ✓ 512x512"
sips -z 1024 1024 "$SRC_PNG" --out "$ICONSET_DIR/icon_512x512@2x.png" > /dev/null 2>&1 && echo "   ✓ 512x512@2x"

iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"
rm -rf "$ICONSET_DIR"
echo "   ✅ icon.icns created"

# ─── Windows .ico ─────────────────────────────────────────────────────────────
echo ""
echo "📦 Generating Windows .ico..."

if command -v convert &> /dev/null; then
  # Use ImageMagick (best quality multi-res .ico)
  convert "$SRC_PNG" \
    \( -clone 0 -resize 256x256 \) \
    \( -clone 0 -resize 128x128 \) \
    \( -clone 0 -resize 64x64 \)   \
    \( -clone 0 -resize 48x48 \)   \
    \( -clone 0 -resize 32x32 \)   \
    \( -clone 0 -resize 16x16 \)   \
    -delete 0 "$BUILD_DIR/icon.ico" 2>/dev/null
  echo "   ✅ icon.ico created (ImageMagick, multi-res)"
else
  echo "   ⚠️  ImageMagick not found — using sips fallback for .ico"
  echo "      For best results: brew install imagemagick && npm run build:icons"
  # sips fallback (single size .ico — acceptable but not ideal)
  sips -z 256 256 "$SRC_PNG" --out "$BUILD_DIR/icon-256.png" > /dev/null 2>&1
  # Rename as .ico (electron-builder can use a PNG named .ico as fallback)
  cp "$BUILD_DIR/icon-256.png" "$BUILD_DIR/icon.ico"
  rm "$BUILD_DIR/icon-256.png"
  echo "   ✅ icon.ico created (256×256 fallback)"
fi

# ─── Tray icon (16x16 @2x = 32x32 PNG) ───────────────────────────────────────
echo ""
echo "📦 Generating system tray icon..."
sips -z 32 32 "$SRC_PNG" --out "$BUILD_DIR/tray-icon.png" > /dev/null 2>&1
# macOS tray needs a Template image (grayscale) — create a separate one
sips -z 16 16 "$SRC_PNG" --out "$BUILD_DIR/tray-iconTemplate.png" > /dev/null 2>&1
echo "   ✅ tray-icon.png (32×32) created"

# ─── DMG background (800x540) ─────────────────────────────────────────────────
echo ""
echo "📦 Generating macOS DMG background..."
if [ ! -f "$BUILD_DIR/background.png" ]; then
  # Create a simple dark background using sips
  # (A proper background.png was already placed or will be generated)
  sips -z 540 800 "$SRC_PNG" --out "$BUILD_DIR/background-temp.png" > /dev/null 2>&1
  echo "   ℹ️  background.png not found — using icon as placeholder"
  echo "      Replace $BUILD_DIR/background.png with your custom DMG background (800×540 px)"
  mv "$BUILD_DIR/background-temp.png" "$BUILD_DIR/background.png"
else
  echo "   ✅ background.png already exists"
fi

echo ""
echo "────────────────────────────"
echo "✅ All icons generated successfully!"
echo ""
echo "   📁 $BUILD_DIR/"
echo "   ├── icon.png      (source)"
echo "   ├── icon.icns     (macOS)"
echo "   ├── icon.ico      (Windows)"
echo "   ├── tray-icon.png (system tray)"
echo "   └── background.png (DMG installer)"
echo ""
