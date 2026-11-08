'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ─── Expose safe APIs to renderer process ────────────────────────────────────
// Only expose specific, validated methods — never expose raw ipcRenderer
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion:  () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Open URLs in system browser safely
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // System notifications
  notify: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),

  // In-app navigation
  navigate: (route) => ipcRenderer.invoke('navigate', route),

  // Platform helpers
  isMac:     process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux:   process.platform === 'linux',
});
