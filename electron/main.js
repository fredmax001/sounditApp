'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  shell,
  ipcMain,
  nativeImage,
  nativeTheme,
  dialog,
  net,
} = require('electron');
const path = require('path');
const Store = require('electron-store');

// ─── Constants ────────────────────────────────────────────────────────────────
const APP_URL       = 'https://sounditent.com';
const APP_NAME      = 'Sound It';
const APP_PROTOCOL  = 'soundit';
const isDev         = process.argv.includes('--dev');
const isMac         = process.platform === 'darwin';
const isWin         = process.platform === 'win32';

// ─── Persistent Window State ──────────────────────────────────────────────────
const store = new Store({
  defaults: {
    windowState: { width: 1280, height: 800, maximized: false },
  },
});

// ─── Globals ──────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray       = null;
let isQuitting = false;

// ─── Single Instance Lock ─────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // Bring existing window to front
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Handle deep link from second instance (Windows)
    const deepLink = argv.find((arg) => arg.startsWith(`${APP_PROTOCOL}://`));
    if (deepLink) handleDeepLink(deepLink);
  });
}

// ─── Deep Link Protocol ───────────────────────────────────────────────────────
if (isMac) {
  app.setAsDefaultProtocolClient(APP_PROTOCOL);
} else {
  app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1] || '')]);
}

function handleDeepLink(url) {
  if (!mainWindow) return;
  try {
    const parsed = new URL(url);
    // e.g. soundit://event/123  →  https://sounditent.com/events/123
    const route  = parsed.pathname.replace(/^\/\//, '/');
    mainWindow.loadURL(`${APP_URL}${route}`);
    mainWindow.focus();
  } catch (e) {
    console.error('Deep link parse error:', e);
  }
}

// ─── Icon Helper ──────────────────────────────────────────────────────────────
function getIconPath() {
  if (isMac) return path.join(__dirname, 'build', 'icon.icns');
  if (isWin) return path.join(__dirname, 'build', 'icon.ico');
  return path.join(__dirname, 'build', 'icon.png');
}

function getTrayIcon() {
  if (isMac) {
    // macOS: use 2× colored icon resized to 22 px for crisp Retina tray
    const trayPng = path.join(__dirname, 'build', 'tray-icon@2x.png');
    const img = nativeImage.createFromPath(trayPng);
    if (!img.isEmpty()) {
      return img.resize({ width: 22, height: 22 });
    }
  }
  const trayPng = path.join(__dirname, 'build', 'tray-icon.png');
  const img = nativeImage.createFromPath(trayPng);
  if (img.isEmpty()) {
    // Fallback to main icon at small size
    const fallback = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
    return fallback.resize({ width: 16, height: 16 });
  }
  return img;
}

// ─── Window Creation ──────────────────────────────────────────────────────────
function createWindow() {
  const state = store.get('windowState');

  mainWindow = new BrowserWindow({
    width:          state.width,
    height:         state.height,
    x:              state.x,
    y:              state.y,
    minWidth:       1024,
    minHeight:      700,
    title:          APP_NAME,
    icon:           getIconPath(),
    backgroundColor: '#0a0a0a',
    // macOS: use hidden-inset titlebar for a native app feel
    titleBarStyle:  isMac ? 'hiddenInset' : 'default',
    // Windows: show default title bar
    frame:          true,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      webSecurity:      true,
      // Allow the app to use camera (for QR scanner) and microphone
      allowRunningInsecureContent: false,
    },
    show: false, // show after ready-to-show
  });

  // Restore maximized state
  if (state.maximized) mainWindow.maximize();

  // ── Load the app ────────────────────────────────────────────────────────────
  mainWindow.loadURL(APP_URL);

  // Show window once content is painted (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  // ── Window state persistence ─────────────────────────────────────────────────
  ['resize', 'move'].forEach((evt) => {
    mainWindow.on(evt, () => {
      if (!mainWindow.isMaximized()) {
        store.set('windowState', {
          ...mainWindow.getBounds(),
          maximized: false,
        });
      }
    });
  });
  mainWindow.on('maximize',   () => store.set('windowState.maximized', true));
  mainWindow.on('unmaximize', () => store.set('windowState.maximized', false));

  // ── Minimize to tray instead of closing (optional) ───────────────────────────
  mainWindow.on('close', (event) => {
    if (!isQuitting && isMac) {
      // On macOS, hide to dock (standard macOS behaviour)
      event.preventDefault();
      mainWindow.hide();
    } else {
      // Save state on real close
      if (!mainWindow.isMaximized()) {
        store.set('windowState', {
          ...mainWindow.getBounds(),
          maximized: false,
        });
      }
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // ── Navigation guards ────────────────────────────────────────────────────────
  // Allow navigation within sounditent.com domains and Google OAuth
  const ALLOWED_ORIGINS = [
    'https://sounditent.com',
    'https://sounditent.cn',
    'https://accounts.google.com',
    'https://oauth2.googleapis.com',
  ];

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = ALLOWED_ORIGINS.some((origin) => url.startsWith(origin));
    if (!allowed) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Open new-window links in system browser (social share, payment links, etc.)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const allowed = ALLOWED_ORIGINS.some((origin) => url.startsWith(origin));
    if (!allowed) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // ── Offline / Error page ─────────────────────────────────────────────────────
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -2 || errorCode === -106 || errorCode === -105) {
      // Network errors — show offline page
      mainWindow.loadFile(path.join(__dirname, 'build', 'offline.html'));
    }
    console.error('Failed to load:', validatedURL, errorCode, errorDescription);
  });

  // Retry when back online
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(`
      window.addEventListener('online', () => {
        window.location.href = '${APP_URL}';
      });
    `).catch(() => {});
  });

  // ── Certificate handling ──────────────────────────────────────────────────────
  // Trust production cert (remove if using proper CA cert)
  mainWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
    if (url.startsWith('https://sounditent.com') || url.startsWith('https://sounditent.cn')) {
      event.preventDefault();
      callback(true);
    } else {
      callback(false);
    }
  });
}

// ─── System Tray ─────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(getTrayIcon());
  tray.setToolTip(APP_NAME);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Open ${APP_NAME}`,
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
        else createWindow();
      },
    },
    { type: 'separator' },
    {
      label: 'Events',
      click: () => {
        if (mainWindow) { mainWindow.loadURL(`${APP_URL}/events`); mainWindow.show(); }
      },
    },
    {
      label: 'My Tickets',
      click: () => {
        if (mainWindow) { mainWindow.loadURL(`${APP_URL}/dashboard/tickets`); mainWindow.show(); }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: isMac ? 'Cmd+Q' : 'Ctrl+Q',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    else createWindow();
  });

  // Windows: double-click opens app
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

// ─── Application Menu ─────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    // macOS app menu
    ...(isMac ? [{
      label: APP_NAME,
      submenu: [
        { role: 'about', label: `About ${APP_NAME}` },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: `Hide ${APP_NAME}` },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        {
          label: `Quit ${APP_NAME}`,
          accelerator: 'Cmd+Q',
          click: () => { isQuitting = true; app.quit(); },
        },
      ],
    }] : []),
    // File menu (Windows / Linux)
    ...(!isMac ? [{
      label: 'File',
      submenu: [
        {
          label: 'Quit',
          accelerator: 'Ctrl+Q',
          click: () => { isQuitting = true; app.quit(); },
        },
      ],
    }] : []),
    // Navigate menu
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Home',
          accelerator: isMac ? 'Cmd+Shift+H' : 'Ctrl+Shift+H',
          click: () => mainWindow?.loadURL(APP_URL),
        },
        {
          label: 'Events',
          accelerator: isMac ? 'Cmd+Shift+E' : 'Ctrl+Shift+E',
          click: () => mainWindow?.loadURL(`${APP_URL}/events`),
        },
        {
          label: 'My Tickets',
          accelerator: isMac ? 'Cmd+Shift+T' : 'Ctrl+Shift+T',
          click: () => mainWindow?.loadURL(`${APP_URL}/dashboard/tickets`),
        },
        {
          label: 'Artists',
          click: () => mainWindow?.loadURL(`${APP_URL}/artists`),
        },
        { type: 'separator' },
        {
          label: 'Go Back',
          accelerator: isMac ? 'Cmd+Left' : 'Alt+Left',
          click: () => { if (mainWindow?.webContents.canGoBack()) mainWindow.webContents.goBack(); },
        },
        {
          label: 'Go Forward',
          accelerator: isMac ? 'Cmd+Right' : 'Alt+Right',
          click: () => { if (mainWindow?.webContents.canGoForward()) mainWindow.webContents.goForward(); },
        },
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: isMac ? 'Cmd+R' : 'Ctrl+R',
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: 'Force Reload',
          accelerator: isMac ? 'Cmd+Shift+R' : 'Ctrl+Shift+R',
          click: () => mainWindow?.webContents.reloadIgnoringCache(),
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: isMac ? 'Cmd+=' : 'Ctrl+=',
          click: () => {
            const z = mainWindow?.webContents.getZoomFactor() || 1;
            mainWindow?.webContents.setZoomFactor(Math.min(z + 0.1, 3));
          },
        },
        {
          label: 'Zoom Out',
          accelerator: isMac ? 'Cmd+-' : 'Ctrl+-',
          click: () => {
            const z = mainWindow?.webContents.getZoomFactor() || 1;
            mainWindow?.webContents.setZoomFactor(Math.max(z - 0.1, 0.5));
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: isMac ? 'Cmd+0' : 'Ctrl+0',
          click: () => mainWindow?.webContents.setZoomFactor(1),
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
        ...(isDev ? [{ role: 'toggleDevTools', label: 'Developer Tools' }] : []),
      ],
    },
    // Edit (copy/paste/undo etc.)
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    // Window menu (macOS standard)
    ...(isMac ? [{
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    }] : []),
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: `${APP_NAME} Website`,
          click: () => shell.openExternal('https://sounditent.com'),
        },
        {
          label: 'Contact Support',
          click: () => shell.openExternal('mailto:info@sounditent.com'),
        },
        { type: 'separator' },
        {
          label: `About ${APP_NAME}`,
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type:    'info',
              title:   `About ${APP_NAME}`,
              message: APP_NAME,
              detail:  `Version ${app.getVersion()}\nExcellence in Entertainment\nhttps://sounditent.com`,
              icon:    path.join(__dirname, 'build', 'icon.png'),
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── App Events ───────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Set app user model ID (Windows taskbar)
  if (isWin) app.setAppUserModelId('com.sounditent.app');

  createWindow();
  createTray();
  buildMenu();

  // macOS deep link
  app.on('open-url', (_event, url) => handleDeepLink(url));
});

// macOS: re-open window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else if (mainWindow) mainWindow.show();
});

// Windows/Linux: quit when all windows closed
app.on('window-all-closed', () => {
  if (!isMac) { isQuitting = true; app.quit(); }
});

app.on('before-quit', () => { isQuitting = true; });

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-platform',    () => process.platform);

ipcMain.handle('open-external', (_event, url) => {
  // Security: only open http/https URLs
  if (/^https?:\/\//.test(url)) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('show-notification', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, icon: path.join(__dirname, 'build', 'icon.png') }).show();
  }
});

ipcMain.handle('navigate', (_event, route) => {
  mainWindow?.loadURL(`${APP_URL}${route}`);
});
