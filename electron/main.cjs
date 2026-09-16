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
let updateState = { state: "idle" };
let updateCheck = null;
let retryTimer = null;
let retryCount = 0;
function sendUpdate(payload) {
  updateState = payload;
  logger("Updater " + payload.state + (payload.version ? " " + payload.version : ""));
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('tk:update-status', payload);
}
async function checkUpdates() {
  if (updateCheck || ['downloading', 'downloaded'].includes(updateState.state)) return updateState;
  updateCheck = autoUpdater.checkForUpdates();
  try { await updateCheck; retryCount = 0; }
  catch (error) {
    sendUpdate({ state: 'error', message: '暂时无法连接更新服务，正在自动重试；也可点击重试。' });
    logger('Updater check failed: ' + String(error.code || error.message).split('\n')[0]);
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void checkUpdates(), Math.min(300000, 15000 * 2 ** Math.min(retryCount++, 5)));
    retryTimer.unref();
  } finally { updateCheck = null; }
  return updateState;
}
async function installUpdate() {
  if (quitting) return;
  quitting = true;
  try { await backend?.close(); } catch (error) { logger('Backend close: ' + error.message); }
  backend = null;
  autoUpdater.quitAndInstall(true, true);
}
function configureUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => sendUpdate({ state: 'checking', message: '正在检查更新…' }));
  autoUpdater.on('update-available', (info) => sendUpdate({ state: 'available', version: info.version, message: `发现新版本 ${info.version}`, releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '' }));
  autoUpdater.on('update-not-available', () => sendUpdate({ state: 'current', message: '当前已经是最新版本' }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ state: 'downloading', percent: Math.round(p.percent || 0), message: `正在下载更新 ${Math.round(p.percent || 0)}%` }));
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdate({ state: 'downloaded', version: info.version, message: `版本 ${info.version} 已下载，正在静默安装并重启` });
    // NSIS 静默安装：用户只需点击一次“更新”，下载完成后自动重启应用。
    setTimeout(() => void installUpdate(), 1000);
  });
  autoUpdater.on('error', () => sendUpdate({ state: 'error', message: '更新连接失败，请点击重试。' }));
  ipcMain.handle('tk:update-state', () => updateState);

  ipcMain.handle('tk:get-version', () => app.getVersion());
  ipcMain.handle('tk:check-update', async () => {
    if (!app.isPackaged) {
      const payload = { state: 'dev', message: '开发模式不检查在线更新' };
      sendUpdate(payload);
      return payload;
    }
    return checkUpdates();
  });
  ipcMain.handle('tk:download-update', () => autoUpdater.downloadUpdate());
  ipcMain.handle('tk:install-update', installUpdate);
  ipcMain.handle('tk:open-external', (_e, url) => shell.openExternal(String(url)));
}


async function createWindow() {
  if (!backend) {
    const { startServer } = require(path.join(app.getAppPath(), 'dist', 'server.cjs'));
    backend = await startServer({ rootDir: app.getAppPath(), dataDir: app.getPath('userData'), commercialMode: app.isPackaged, development: !app.isPackaged && process.argv.includes('--development'), port: 0 });
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
  } else if (app.isPackaged) {
    setTimeout(() => void checkUpdates(), 2500).unref();
    setInterval(() => void checkUpdates(), 5 * 60 * 1000).unref();
  }
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
  const bootstrapMimoKey = String(process.env.TK_MIMO_BOOTSTRAP_KEY || '').trim();
  if (bootstrapMimoKey) {
    const current = settings.load();
    settings.save({ ...current, modelConfig: { provider: 'openai', cloudProviderId: 'xiaomi-mimo', baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5', apiKey: bootstrapMimoKey, inputMode: 'text' }, visionModelConfig: { provider: 'openai', cloudProviderId: 'xiaomi-mimo', baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5', apiKey: bootstrapMimoKey, inputMode: 'multimodal' }, useSameModelForVision: false });
    delete process.env.TK_MIMO_BOOTSTRAP_KEY;
    logger('MiMo cloud model settings encrypted into userData');
  }
  if (app.isPackaged) {
    const stored = settings.load();
    const cloud = stored.modelConfig;
    if (cloud?.cloudProviderId === 'xiaomi-mimo' && cloud.apiKey) {
      process.env.TK_COMMERCIAL_PROVIDER = 'openai';
      process.env.TK_COMMERCIAL_CLOUD_PROVIDER = 'xiaomi-mimo';
      process.env.TK_COMMERCIAL_BASE_URL = cloud.baseUrl || 'https://api.xiaomimimo.com/v1';
      process.env.TK_COMMERCIAL_MODEL = cloud.model || 'mimo-v2.5';
      process.env.TK_COMMERCIAL_API_KEY = cloud.apiKey;
      process.env.TK_COMMERCIAL_INPUT_MODE = cloud.inputMode || 'text';
    }
  }
  if (process.env.TK_SMOKE_DATA_DIR && !process.env.TK_SMOKE_RESTART) {
    settings.save({ modelConfig: { provider: 'openai', model: 'smoke-script', baseUrl: 'http://127.0.0.1', apiKey: 'smoke-only-script-key' }, visionModelConfig: { provider: 'openai', model: 'smoke-vision', baseUrl: 'http://127.0.0.1', apiKey: 'smoke-only-vision-key' }, useSameModelForVision: false });
  }
  ipcMain.handle('tk:load-settings', () => settings.load());
  ipcMain.handle('tk:save-settings', (_event, value) => settings.save(value));
  ipcMain.handle('tk:load-auth', () => settings.loadAuth());
  ipcMain.handle('tk:save-auth', (_event, value) => settings.saveAuth(value));
  ipcMain.handle('tk:clear-auth', () => settings.clearAuth());
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
