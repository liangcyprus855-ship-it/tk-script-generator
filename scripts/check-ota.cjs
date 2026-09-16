const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.whenReady().then(async () => {
  Object.defineProperty(app, 'isPackaged', { get: () => true });
  app.getVersion = () => '1.0.7';
  const { NsisUpdater } = require('electron-updater');
  const updater = new NsisUpdater({ provider: 'github', owner: 'liangcyprus855-ship-it', repo: 'tk-script-generator' });
  // Electron may outlive the shell that launched this diagnostic. Never use
  // electron-updater's default console logger on an inherited pipe.
  updater.logger = null;
  updater.autoDownload = false;
  updater.on('error', () => {});
  try {
    const result = await updater.checkForUpdates();
    fs.writeFileSync(path.join(__dirname, '../outputs/ota-check.json'), JSON.stringify({ from: '1.0.7', available: result.updateInfo.version, files: result.updateInfo.files.map(f => f.url) }));
    app.exit(0);
  } catch (e) {
    fs.writeFileSync(path.join(__dirname, '../outputs/ota-check.json'), JSON.stringify({ error: String(e.message).split('\n')[0] }));
    app.exit(1);
  }
});
setTimeout(() => app.exit(2), 60000);
