const fs = require('node:fs');
const path = require('node:path');
function createSettingsStore(directory, encryption) {
  const file = path.join(directory, 'settings.json');
  const authFile = path.join(directory, 'account-session.json');
  const historyFile = path.join(directory, 'generation-history.json');
  function load() {
    if (!fs.existsSync(file)) return {};
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const key of ['modelConfig', 'visionModelConfig']) {
      const config = value[key];
      if (config?.encryptedApiKey) {
        config.apiKey = encryption.decryptString(Buffer.from(config.encryptedApiKey, 'base64'));
        delete config.encryptedApiKey;
      }
    }
    return value;
  }
  function save(input) {
    const value = JSON.parse(JSON.stringify(input));
    for (const key of ['modelConfig', 'visionModelConfig']) {
      const config = value[key];
      if (!config || typeof config.model !== 'string' || typeof config.baseUrl !== 'string') throw new Error('Invalid model settings');
      if (config.apiKey) {
        if (!encryption.isEncryptionAvailable()) throw new Error('系统密钥加密不可用');
        config.encryptedApiKey = encryption.encryptString(config.apiKey).toString('base64');
      }
      delete config.apiKey;
    }
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(file + '.tmp', file);
  }
  function loadAuth() {
    if (!fs.existsSync(authFile)) return null;
    const value = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    const decrypt = (key) => value[key] ? encryption.decryptString(Buffer.from(value[key], 'base64')) : '';
    return { localToken: decrypt('localToken'), cloudToken: decrypt('cloudToken') };
  }
  function saveAuth(input) {
    if (!input || typeof input.localToken !== 'string' || typeof input.cloudToken !== 'string') throw new Error('Invalid account session');
    if (!encryption.isEncryptionAvailable()) throw new Error('系统密钥加密不可用');
    const value = { localToken: encryption.encryptString(input.localToken).toString('base64'), cloudToken: encryption.encryptString(input.cloudToken).toString('base64') };
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(authFile + '.tmp', JSON.stringify(value), { mode: 0o600 });
    fs.renameSync(authFile + '.tmp', authFile);
  }
  function clearAuth() { try { fs.unlinkSync(authFile); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  function loadHistory(accountId) {
    if (!accountId || !fs.existsSync(historyFile)) return [];
    try {
      const all = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      return Array.isArray(all[accountId]) ? all[accountId].slice(0, 200) : [];
    } catch { return []; }
  }
  function saveHistory(accountId, records) {
    if (!accountId || !Array.isArray(records)) throw new Error('Invalid generation history');
    let all = {};
    if (fs.existsSync(historyFile)) {
      try { all = JSON.parse(fs.readFileSync(historyFile, 'utf8')) || {}; } catch { all = {}; }
    }
    all[accountId] = records.slice(0, 200);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(historyFile + '.tmp', JSON.stringify(all), { mode: 0o600 });
    fs.renameSync(historyFile + '.tmp', historyFile);
  }
  return { load, save, loadAuth, saveAuth, clearAuth, loadHistory, saveHistory };
}
module.exports = { createSettingsStore };
