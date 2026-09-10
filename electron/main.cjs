const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs');
const { createSettingsStore } = require('./settings.cjs');
let mainWindow = null;
let backend = null;
let quitting = false;
let logger = () => {};
if (process.env.TK_SMOKE_DATA_DIR) app.setPath('userData', process.env.TK_SMOKE_DATA_DIR);
function sendUpdate(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('tk:update-status', payload);
}
function configureUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => sendUpdate({ state: 'checking', message: '正在检查更新…' }));
  autoUpdater.on('update-available', (info) => sendUpdate({ state: 'available', version: info.version, message: `发现新版本 ${info.version}` }));
  autoUpdater.on('update-not-available', () => sendUpdate({ state: 'current', message: '当前已经是最新版本' }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ state: 'downloading', percent: Math.round(p.percent || 0), message: `正在下载更新 ${Math.round(p.percent || 0)}%` }));
  autoUpdater.on('update-downloaded', (info) => sendUpdate({ state: 'downloaded', version: info.version, message: `版本 ${info.version} 已下载，可以安装` }));
  autoUpdater.on('error', (err) => sendUpdate({ state: 'error', message: `更新检查失败：${err?.message || err}` }));

  ipcMain.handle('tk:get-version', () => app.getVersion());
  ipcMain.handle('tk:check-update', async () => {
    if (!app.isPackaged) {
      const payload = { state: 'dev', message: '开发模式不检查在线更新' };
      sendUpdate(payload);
      return payload;
    }
    return autoUpdater.checkForUpdates();
  });
  ipcMain.handle('tk:download-update', () => autoUpdater.downloadUpdate());
  ipcMain.handle('tk:install-update', () => autoUpdater.quitAndInstall(false, true));
  ipcMain.handle('tk:open-external', (_e, url) => shell.openExternal(String(url)));
}


async function createWindow() {
  if (!backend) {
    const { startServer } = require(path.join(app.getAppPath(), 'dist', 'server.cjs'));
    backend = await startServer({ rootDir: app.getAppPath(), dataDir: app.getPath('userData'), development: !app.isPackaged && process.argv.includes('--development'), port: 0 });
    const response = await fetch(backend.url + '/api/health', { signal: AbortSignal.timeout(5000) });
    const health = await response.json();
    if (!response.ok || health.ok !== true || health.version !== app.getVersion()) throw new Error('Backend health check failed');
    logger('Backend ready: ' + backend.url);
  }
  mainWindow = new BrowserWindow({ width: 1440, height: 920, minWidth: 1060, minHeight: 720,
    backgroundColor: '#f8fafc', show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) void shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== backend.url) event.preventDefault(); });
  mainWindow.once('ready-to-show', () => { if (!process.env.TK_SMOKE_DATA_DIR) mainWindow.show(); });
  await mainWindow.loadURL(backend.url);
  logger('Renderer loaded');
  if (process.env.TK_SMOKE_DATA_DIR) {
    await mainWindow.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (document.body.innerText.length > 100) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started > 15000) { clearInterval(timer); reject(new Error('Renderer did not mount')); }
      }, 50);
    })`);
    const result = await mainWindow.webContents.executeJavaScript(`(async () => {
      const previousSettings = await window.tkDesktop.loadSettings();
      const settings = { modelConfig: { provider: 'openai', model: 'smoke-script', baseUrl: 'http://127.0.0.1', apiKey: 'smoke-only-script-key' }, visionModelConfig: { provider: 'openai', model: 'smoke-vision', baseUrl: 'http://127.0.0.1', apiKey: 'smoke-only-vision-key' }, useSameModelForVision: false };
      await window.tkDesktop.saveSettings(settings);
      const restored = await window.tkDesktop.loadSettings();
      if (JSON.stringify(restored) !== JSON.stringify(settings)) throw new Error('Settings IPC round trip failed');
      return { title: document.title, text: document.body.innerText, desktop: !!window.tkDesktop, previousModel: previousSettings.modelConfig?.model };
    })()`);
    if (!result.desktop || result.text.length < 100 || result.text.includes('界面发生异常')) throw new Error('Renderer smoke check failed');
    fs.writeFileSync(path.join(app.getPath('userData'), 'renderer.png'), (await mainWindow.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(app.getPath('userData'), 'smoke-result.json'), JSON.stringify({ ...result, url: backend.url, version: app.getVersion() }));
    app.quit();
  } else if (app.isPackaged) setTimeout(() => autoUpdater.checkForUpdates().catch(error => logger(error.message)), 2500).unref();
}
async function fail(error) {
  logger(error.stack || String(error));
  if (!process.env.TK_SMOKE_DATA_DIR) dialog.showErrorBox('TK 脚本生成器启动失败', '请查看日志：' + path.join(app.getPath('userData'), 'logs', 'startup.log') + '\n' + error.message);
  try { await backend?.close(); } catch (closeError) { logger(closeError.message); }
  backend = null;
  app.exit(1);
}
app.whenReady().then(async () => {
  const logs = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logs, { recursive: true });
  logger = message => fs.appendFileSync(path.join(logs, 'startup.log'), new Date().toISOString() + ' ' + message + '\n');
  logger('Starting ' + app.getVersion() + ' packaged=' + app.isPackaged);
  const settings = createSettingsStore(app.getPath('userData'), safeStorage);
  if (process.env.TK_SMOKE_DATA_DIR && !process.env.TK_SMOKE_RESTART) {
    settings.save({ modelConfig: { provider: 'openai', model: 'smoke-script', baseUrl: 'http://127.0.0.1', apiKey: 'smoke-only-script-key' }, visionModelConfig: { provider: 'openai', model: 'smoke-vision', baseUrl: 'http://127.0.0.1', apiKey: 'smoke-only-vision-key' }, useSameModelForVision: false });
  }
  ipcMain.handle('tk:load-settings', () => settings.load());
  ipcMain.handle('tk:save-settings', (_event, value) => settings.save(value));
  configureUpdater();
  await createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) void createWindow().catch(fail); });
}).catch(fail);
app.on('before-quit', event => {
  if (quitting || !backend) return;
  event.preventDefault();
  quitting = true;
  backend.close().then(() => logger('Backend closed')).catch(error => logger(error.message)).finally(() => { backend = null; app.quit(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
