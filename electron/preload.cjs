// Preload runs with context isolation. We expose only a tiny, read-only marker
// so the web app can tell it is running inside the desktop shell if it ever
// needs to. No Node APIs are leaked to the renderer.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
});
