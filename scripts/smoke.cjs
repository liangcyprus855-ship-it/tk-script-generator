const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else fs.copyFileSync(from, to);
  }
}
async function main() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(path.resolve('release')), 'TK 安装 测试 '));
  const target = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, '中文 空格 应用');
  if (!process.argv[2]) copyDirectory(path.resolve('release/win-unpacked'), target);
  const data = path.join(root, '用户 数据');
  fs.mkdirSync(data);
  const env = { ...process.env, TK_SMOKE_DATA_DIR: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const executable = path.join(target, 'TK跨境带货脚本生成器.exe');
  if (!fs.existsSync(executable)) throw new Error(`Missing packaged executable: ${executable}. Files: ${fs.readdirSync(target).join(', ')}`);
  const cwd = fs.realpathSync(os.tmpdir());
  console.log(`Smoke executable: ${executable}; cwd: ${cwd}`);
  for (let attempt = 0; attempt < 2; attempt++) {
  if (attempt === 1) env.TK_SMOKE_RESTART = '1';
  const child = spawn(executable, [], { cwd, env, windowsHide: true, stdio: 'pipe' });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const timer = setTimeout(() => child.kill(), 45000);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    const resultFile = path.join(data, 'smoke-result.json');
    if (code !== 0 || !fs.existsSync(resultFile)) throw new Error(`Packaged startup failed (${code}). ${output}\nLogs: ${data}`);
    const result = JSON.parse(fs.readFileSync(resultFile));
    if (result.version !== require('../package.json').version) throw new Error('Wrong packaged version');
    if (result.historyCount !== 1) throw new Error('Generation history did not persist');
    if (attempt === 1 && result.previousModel !== 'smoke-script') throw new Error('Settings lost on restart');
    const settings = fs.readFileSync(path.join(data, 'settings.json'), 'utf8');
    if (settings.includes('smoke-only-')) throw new Error('API key saved in plaintext');
    const log = fs.readFileSync(path.join(data, 'logs/startup.log'), 'utf8');
    if (!log.includes('Backend closed')) throw new Error('Shutdown did not close backend');
    let listening = false;
    try { await fetch(result.url + '/api/health'); listening = true; } catch {}
    if (listening) throw new Error('Backend still listening after exit');
    console.log(`PASS packaged ${result.version}: renderer, IPC, health, Chinese/space paths, shutdown. ${result.title}`);
  } finally { clearTimeout(timer); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

