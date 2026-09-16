// Run on LA-02 through SSH; the key arrives only on stdin, never argv/logs.
import fs from 'node:fs';
let data = '';
for await (const chunk of process.stdin) data += chunk;
const { key } = JSON.parse(data);
if (typeof key !== 'string' || !/^sk-[a-zA-Z0-9_-]{20,200}$/.test(key.trim())) throw new Error('Invalid credential format');
const file = '/opt/tk-platform-api/.env';
const current = fs.readFileSync(file, 'utf8');
if (!fs.existsSync(file + '.before-server-generation')) fs.writeFileSync(file + '.before-server-generation', current, { mode: 0o600, flag: 'wx' });
const next = current.split(/\r?\n/).filter(line => !line.startsWith('MIMO_API_KEY=')).join('\n').trimEnd() + '\nMIMO_API_KEY=' + key.trim() + '\n';
fs.writeFileSync(file + '.tmp', next, { mode: 0o600 });
fs.renameSync(file + '.tmp', file);
console.log('Server model credential configured (value not displayed)');
