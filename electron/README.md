# Sound It — Electron Desktop App

## Quick Start

### Prerequisites
```bash
# Node.js 18+ required
node --version

# Optional: ImageMagick for best Windows .ico quality
brew install imagemagick
```

### Install & Run
```bash
cd electron
npm install
npm start         # Launch app in dev mode
```

### Build Installers
```bash
npm run dist:mac   # → dist/Sound It-1.0.0.dmg  (macOS)
npm run dist:win   # → dist/Sound It Setup 1.0.0.exe  (Windows)
npm run dist:all   # → Both platforms at once
```

> **Windows builds on macOS**: Requires Wine or a Windows machine/VM.
> Use GitHub Actions for cross-platform CI builds.

---

## Icon Setup

1. Place your icon PNG (1024×1024) at `build/icon.png`
2. Run the generation script:
   ```bash
   chmod +x scripts/generate-icons.sh
   npm run build:icons
   ```
   This creates `icon.icns` (macOS), `icon.ico` (Windows), and `tray-icon.png`.

---

## Project Structure

```
electron/
├── main.js          ← Main process (window, tray, menu, IPC)
├── preload.js       ← Secure context bridge
├── package.json     ← App config + electron-builder
├── build/
│   ├── icon.png     ← Source icon (1024×1024 — YOU PROVIDE)
│   ├── icon.icns    ← macOS icon (auto-generated)
│   ├── icon.ico     ← Windows icon (auto-generated)
│   ├── tray-icon.png← System tray icon (auto-generated)
│   ├── background.png← DMG installer background
│   └── offline.html ← Shown when no internet
└── scripts/
    └── generate-icons.sh
```

---

## Distribution Output

| File | Platform | Size |
|------|----------|------|
| `Sound It-1.0.0.dmg` | macOS | ~150MB |
| `Sound It-1.0.0-mac.zip` | macOS (auto-update) | ~145MB |
| `Sound It Setup 1.0.0.exe` | Windows installer | ~160MB |
| `Sound It 1.0.0.exe` | Windows portable | ~155MB |

---

## Keyboard Shortcuts

| Action | macOS | Windows |
|--------|-------|---------|
| Home | `⌘⇧H` | `Ctrl+Shift+H` |
| Events | `⌘⇧E` | `Ctrl+Shift+E` |
| My Tickets | `⌘⇧T` | `Ctrl+Shift+T` |
| Reload | `⌘R` | `Ctrl+R` |
| Zoom In | `⌘=` | `Ctrl+=` |
| Zoom Out | `⌘-` | `Ctrl+-` |
| Full Screen | `⌘^F` | `F11` |
| Back | `⌘←` | `Alt+←` |
| Forward | `⌘→` | `Alt+→` |

---

## Code Signing (optional)

To avoid "unidentified developer" warnings:
- **macOS**: Requires Apple Developer certificate. Set `CSC_LINK` + `CSC_KEY_PASSWORD` env vars.
- **Windows**: Requires EV code signing certificate. Set `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD`.

For internal distribution, users can bypass:
- **macOS**: Right-click → Open → Open anyway
- **Windows**: "More info" → "Run anyway"
