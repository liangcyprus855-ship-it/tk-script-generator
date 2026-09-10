const fs = require('node:fs');
const path = require('node:path');
function createSettingsStore(directory, encryption) {
  const file = path.join(directory, 'settings.json');
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
  return { load, save };
}
module.exports = { createSettingsStore };
