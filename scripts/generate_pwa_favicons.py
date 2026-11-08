import os
import shutil
from PIL import Image

SRC_PATH = "/Users/djfredmax/.gemini/antigravity/brain/0663691b-ce6d-47cb-806e-929ad1a8abb3/.user_uploaded/media_1792333961661_c0723aed.jpg"
APP_PUBLIC = "app/public"
ANDROID_ASSETS = "app/android/app/src/main/assets/public"
ANDROID_RES = "app/android/app/src/main/res"

src = Image.open(SRC_PATH).convert("RGB")
w, h = src.size

# Clean JPEG compression noise in background to exact #020b00 (2, 11, 0)
pixels = src.load()
for y in range(h):
    for x in range(w):
        r, g, b = pixels[x, y]
        if r + g + b < 32:
            pixels[x, y] = (2, 11, 0)

# 1. Master favicon-source.png (1024x1024)
src.save(os.path.join(APP_PUBLIC, "favicon-source.png"), "PNG", optimize=True)

# 2. PWA icons
icons = {
    "android-chrome-512x512.png": 512,
    "android-chrome-192x192.png": 192,
    "apple-touch-icon.png": 180,
    "favicon-32x32.png": 32,
    "favicon-16x16.png": 16,
}

for filename, size in icons.items():
    resized = src.resize((size, size), Image.Resampling.LANCZOS)
    out_path = os.path.join(APP_PUBLIC, filename)
    resized.save(out_path, "PNG", optimize=True)
    print(f"Generated {out_path} ({size}x{size})")

# 3. Bookmark icon JPG (180x180)
bookmark = src.resize((180, 180), Image.Resampling.LANCZOS)
bookmark.save(os.path.join(APP_PUBLIC, "bookmark-icon.jpg"), "JPEG", quality=95)

# 4. Multi-resolution favicon.ico (16, 32, 48)
ico_16 = src.resize((16, 16), Image.Resampling.LANCZOS)
ico_32 = src.resize((32, 32), Image.Resampling.LANCZOS)
ico_48 = src.resize((48, 48), Image.Resampling.LANCZOS)
ico_path = os.path.join(APP_PUBLIC, "favicon.ico")
ico_32.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
print(f"Generated {ico_path}")

# 5. WebP icons for manifest
webp_sizes = [48, 72, 96, 128, 192, 256, 512]
icons_dir = os.path.join(APP_PUBLIC, "assets", "icons")
os.makedirs(icons_dir, exist_ok=True)
for s in webp_sizes:
    resized = src.resize((s, s), Image.Resampling.LANCZOS)
    out_path = os.path.join(icons_dir, f"icon-{s}.webp")
    resized.save(out_path, "WEBP", quality=95)
    print(f"Generated {out_path} ({s}x{s})")

# 6. Android Mipmap icons (ic_launcher.png & ic_launcher_round.png)
mipmap_sizes = {
    "mipmap-ldpi": 36,
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

for folder, s in mipmap_sizes.items():
    folder_path = os.path.join(ANDROID_RES, folder)
    if os.path.exists(folder_path):
        resized = src.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")
        resized.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")
        print(f"Updated {folder} ic_launcher.png ({s}x{s})")

# 7. Android Adaptive Icons (ic_launcher_background.png & ic_launcher_foreground.png)
adaptive_sizes = {
    "mipmap-ldpi": 81,
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

# Create transparent foreground emblem
rgba_src = src.convert("RGBA")
r_pix = rgba_src.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = r_pix[x, y]
        if r + g + b < 32:
            r_pix[x, y] = (2, 11, 0, 0) # transparent background

for folder, s in adaptive_sizes.items():
    folder_path = os.path.join(ANDROID_RES, folder)
    if os.path.exists(folder_path):
        # Background: solid #020b00 (RGB: 2, 11, 0)
        bg = Image.new("RGB", (s, s), (2, 11, 0))
        bg.save(os.path.join(folder_path, "ic_launcher_background.png"), "PNG")
        
        # Foreground: resized transparent emblem
        fg = rgba_src.resize((s, s), Image.Resampling.LANCZOS)
        fg.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")
        print(f"Updated {folder} adaptive icons ({s}x{s})")

# 8. Sync into Android native assets
android_public = ANDROID_ASSETS
if os.path.exists(android_public):
    for root, dirs, files in os.walk(APP_PUBLIC):
        rel_dir = os.path.relpath(root, APP_PUBLIC)
        target_dir = os.path.join(android_public, rel_dir) if rel_dir != "." else android_public
        os.makedirs(target_dir, exist_ok=True)
        for f in files:
            if "icon" in f or "favicon" in f or "chrome" in f or "manifest" in f:
                src_f = os.path.join(root, f)
                dst_f = os.path.join(target_dir, f)
                shutil.copy2(src_f, dst_f)
    print("Synchronized all icons into android native assets.")

print("All icons successfully generated!")
