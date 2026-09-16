const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const dataDir = path.join(process.env.APPDATA, 'TK跨境带货脚本生成器');
app.setPath('userData', dataDir);
app.whenReady().then(async () => {
  const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'));
  const key = safeStorage.decryptString(Buffer.from(saved.modelConfig.encryptedApiKey, 'base64')).trim();
  const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-i', path.join(process.env.USERPROFILE, '.ssh/id_ed25519'),
    'root@107.173.144.109', '/tmp/node-v22.14.0-linux-x64/bin/node /opt/tk-platform-api/set-mimo-env.mjs'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.end(JSON.stringify({ key }));
  let output = ''; child.stdout.on('data', b => { output += b; });
  // Do not emit child stderr: provisioning failures must not echo stdin.
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  fs.writeFileSync(path.join(__dirname, '../outputs/key-provision-result.json'), JSON.stringify({ success: code === 0 }));
  app.exit(code === 0 ? 0 : 1);
}).catch(() => { fs.writeFileSync(path.join(__dirname, '../outputs/key-provision-result.json'), JSON.stringify({ success: false })); app.exit(1); });
