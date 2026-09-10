import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { startServer } from '../server';
const require = createRequire(import.meta.url);
const { createSettingsStore } = require('../electron/settings.cjs');
test('dynamic ports, health, production assets, API validation and shutdown in Chinese/space path', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'TK 中文 空格 '));
  mkdirSync(path.join(root, 'dist'));
  writeFileSync(path.join(root, 'dist/index.html'), '<html>原有 UI</html>');
  const first = await startServer({ rootDir: root });
  const second = await startServer({ rootDir: root });
  try {
    assert.notEqual(first.url, second.url);
    const address = first.server.address();
    assert.ok(address && typeof address !== 'string');
    assert.equal(address.address, '127.0.0.1');
    assert.deepEqual(await (await fetch(first.url + '/api/health')).json(), { ok: true, version: '1.0.3' });
    assert.match(await (await fetch(first.url)).text(), /原有 UI/);
    for (const route of ['generate', 'generate-one', 'analyze-product-image']) {
      const response = await fetch(first.url + '/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 400);
    }
    await assert.rejects(startServer({ rootDir: root, port: Number(new URL(first.url).port) }), /EADDRINUSE/);
  } finally { await first.close(); await second.close(); rmSync(root, { recursive: true }); }
  await assert.rejects(fetch(first.url));
});
test('missing frontend fails immediately instead of startup timeout', async () => {
  await assert.rejects(startServer({ rootDir: path.join(tmpdir(), 'missing-tk-frontend') }), /Frontend missing/);
});

test('commercial account foundation registers, authenticates, quotes and persists credits outside the app bundle', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'TK 商业账户 '));
  mkdirSync(path.join(root, 'dist'));
  writeFileSync(path.join(root, 'dist/index.html'), '<html>commercial</html>');
  const dataDir = mkdtempSync(path.join(tmpdir(), 'TK 用户数据 '));
  const backend = await startServer({ rootDir: root, dataDir });
  const post = async (route: string, body: any, token?: string) => {
    const response = await fetch(backend.url + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { response, data: await response.json() };
  };
  try {
    const registered = await post('/api/account/register', { email: 'creator@example.com', password: 'strong-pass-123' });
    assert.equal(registered.response.status, 200);
    assert.equal(registered.data.user.credits, 100);
    const loggedIn = await post('/api/account/login', { email: 'creator@example.com', password: 'strong-pass-123' });
    assert.equal(loggedIn.response.status, 200);
    const me = await (await fetch(backend.url + '/api/account/me', { headers: { Authorization: `Bearer ${loggedIn.data.token}` } })).json();
    assert.equal(me.user.email, 'creator@example.com');
    assert.deepEqual((await post('/api/billing/quote', { duration: '60秒' })).data, { duration: '60秒', credits: 24 });
    assert.equal((await fetch(backend.url + '/api/account/ledger', { headers: { Authorization: `Bearer ${loggedIn.data.token}` } })).status, 200);
  } finally { await backend.close(); rmSync(root, { recursive: true }); rmSync(dataDir, { recursive: true }); }
});

test('mock recharge order increases credits exactly once and creates a recharge ledger entry', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'TK 支付订单 ')); mkdirSync(path.join(root, 'dist')); writeFileSync(path.join(root, 'dist/index.html'), '<html>billing</html>');
  const dataDir = mkdtempSync(path.join(tmpdir(), 'TK 支付数据 ')); const backend = await startServer({ rootDir: root, dataDir, commercialMode: true });
  try {
    const headers = { 'Content-Type': 'application/json' };
    const registeredResponse = await fetch(backend.url + '/api/account/register', { method: 'POST', headers, body: JSON.stringify({ email: 'billing@example.com', password: 'strong-pass-123' }) });
    const registered = await registeredResponse.json();
    const auth = { ...headers, Authorization: `Bearer ${registered.token}` };
    const createdResponse = await fetch(backend.url + '/api/billing/orders', { method: 'POST', headers: auth, body: JSON.stringify({ provider: 'mock', packageId: 'creator' }) });
    const created = await createdResponse.json(); assert.equal(createdResponse.status, 201); assert.equal(created.order.status, 'pending');
    const paidResponse = await fetch(backend.url + `/api/billing/orders/${created.order.id}/mock-pay`, { method: 'POST', headers: auth });
    const paid = await paidResponse.json(); assert.equal(paid.user.credits, 600);
    const paidAgain = await (await fetch(backend.url + `/api/billing/orders/${created.order.id}/mock-pay`, { method: 'POST', headers: auth })).json(); assert.equal(paidAgain.user.credits, 600);
    const ledger = await (await fetch(backend.url + '/api/account/ledger', { headers: auth })).json(); assert.equal(ledger.entries.filter((entry: any) => entry.type === 'recharge').length, 1);
  } finally { await backend.close(); rmSync(root, { recursive: true }); rmSync(dataDir, { recursive: true }); }
});
test('wechat native order reports missing server configuration without exposing secrets', async () => {
  const previous = { app: process.env.WECHAT_APP_ID, mch: process.env.WECHAT_MCH_ID, serial: process.env.WECHAT_SERIAL_NO, key: process.env.WECHAT_API_V3_KEY, privateKey: process.env.WECHAT_PRIVATE_KEY_PATH, notify: process.env.WECHAT_NOTIFY_URL };
  for (const key of ['WECHAT_APP_ID', 'WECHAT_MCH_ID', 'WECHAT_SERIAL_NO', 'WECHAT_API_V3_KEY', 'WECHAT_PRIVATE_KEY_PATH', 'WECHAT_NOTIFY_URL']) delete process.env[key];
  const root = mkdtempSync(path.join(tmpdir(), 'TK 微信支付配置 ')); mkdirSync(path.join(root, 'dist')); writeFileSync(path.join(root, 'dist/index.html'), '<html>wechat</html>');
  const dataDir = mkdtempSync(path.join(tmpdir(), 'TK 微信支付数据 ')); const backend = await startServer({ rootDir: root, dataDir, commercialMode: true });
  try {
    const headers = { 'Content-Type': 'application/json' };
    const registered = await (await fetch(backend.url + '/api/account/register', { method: 'POST', headers, body: JSON.stringify({ email: 'wechat@example.com', password: 'strong-pass-123' }) })).json();
    const auth = { ...headers, Authorization: `Bearer ${registered.token}` };
    const created = await (await fetch(backend.url + '/api/billing/orders', { method: 'POST', headers: auth, body: JSON.stringify({ provider: 'wechat', packageId: 'starter' }) })).json();
    const response = await fetch(backend.url + `/api/billing/orders/${created.order.id}/wechat/native`, { method: 'POST', headers: auth });
    const result = await response.json();
    assert.equal(response.status, 503); assert.equal(result.code, 'WECHAT_CONFIG_MISSING'); assert.doesNotMatch(JSON.stringify(result), /strong-pass|BEGIN RSA|api-secret-value/i);
  } finally { await backend.close(); rmSync(root, { recursive: true }); rmSync(dataDir, { recursive: true }); for (const [key, value] of Object.entries({ WECHAT_APP_ID: previous.app, WECHAT_MCH_ID: previous.mch, WECHAT_SERIAL_NO: previous.serial, WECHAT_API_V3_KEY: previous.key, WECHAT_PRIVATE_KEY_PATH: previous.privateKey, WECHAT_NOTIFY_URL: previous.notify })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test('commercial generation consumes credits on success and refunds them on model failure', async () => {
  let fail = false;
  const provider = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/show') return res.end(JSON.stringify({ capabilities: ['completion'] }));
    if (fail) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'mock provider failure' })); }
    const script = { title: '商业测试', style: 'UGC', hook: '开场', script: [{ timestamp: '0-3s', visual: '展示产品', audio: '开始' }, { timestamp: '3-8s', visual: '演示卖点', audio: '继续' }, { timestamp: '8-10s', visual: '引导购买', audio: '购买' }], cta: '购买' };
    return res.end(JSON.stringify({ message: { content: JSON.stringify(script) } }));
  });
  await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
  const address = provider.address() as any; const oldProvider = process.env.TK_COMMERCIAL_PROVIDER; const oldBase = process.env.TK_COMMERCIAL_BASE_URL;
  process.env.TK_COMMERCIAL_PROVIDER = 'ollama'; process.env.TK_COMMERCIAL_BASE_URL = `http://127.0.0.1:${address.port}`; process.env.TK_COMMERCIAL_MODEL = 'mock-model';
  const root = mkdtempSync(path.join(tmpdir(), 'TK 扣费退款 ')); mkdirSync(path.join(root, 'dist')); writeFileSync(path.join(root, 'dist/index.html'), '<html>billing</html>'); const dataDir = mkdtempSync(path.join(tmpdir(), 'TK 扣费数据 ')); const backend = await startServer({ rootDir: root, dataDir, commercialMode: true });
  try {
    const headers = { 'Content-Type': 'application/json' }; const registered = await (await fetch(backend.url + '/api/account/register', { method: 'POST', headers, body: JSON.stringify({ email: 'charge@example.com', password: 'strong-pass-123' }) })).json(); const auth = { ...headers, Authorization: `Bearer ${registered.token}` };
    const request = { product: '杯子', targetAudience: '成人', features: '便携', duration: '10秒', index: 1, billingRef: 'success-1', modelConfig: { provider: 'openai', model: 'client-value', apiKey: 'client-key' } };
    assert.equal((await fetch(backend.url + '/api/generate-one', { method: 'POST', headers: auth, body: JSON.stringify(request) })).status, 200);
    let me = await (await fetch(backend.url + '/api/account/me', { headers: auth })).json(); assert.equal(me.user.credits, 98);
    fail = true; const failed = await fetch(backend.url + '/api/generate-one', { method: 'POST', headers: auth, body: JSON.stringify({ ...request, billingRef: 'failure-1' }) }); assert.equal(failed.status, 500);
    me = await (await fetch(backend.url + '/api/account/me', { headers: auth })).json(); assert.equal(me.user.credits, 98);
  } finally { await backend.close(); rmSync(root, { recursive: true }); rmSync(dataDir, { recursive: true }); await new Promise<void>(resolve => provider.close(() => resolve())); if (oldProvider === undefined) delete process.env.TK_COMMERCIAL_PROVIDER; else process.env.TK_COMMERCIAL_PROVIDER = oldProvider; if (oldBase === undefined) delete process.env.TK_COMMERCIAL_BASE_URL; else process.env.TK_COMMERCIAL_BASE_URL = oldBase; delete process.env.TK_COMMERCIAL_MODEL; }
});
test('settings survive restart and API keys are encrypted on disk', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'TK 配置 空格 '));
  const encryption = { isEncryptionAvailable: () => true, encryptString: (value: string) => Buffer.from(value.split('').reverse().join('')), decryptString: (value: Buffer) => value.toString().split('').reverse().join('') };
  const value = { modelConfig: { model: 'script', baseUrl: 'http://localhost', apiKey: 'secret-script' }, visionModelConfig: { model: 'vision', baseUrl: 'https://example.com', apiKey: 'secret-vision' }, useSameModelForVision: false };
  try {
    createSettingsStore(root, encryption).save(value);
    assert.doesNotMatch(readFileSync(path.join(root, 'settings.json'), 'utf8'), /secret-script|secret-vision/);
    assert.deepEqual(createSettingsStore(root, encryption).load(), value);
    assert.throws(() => createSettingsStore(root, { ...encryption, isEncryptionAvailable: () => false }).save(value), /加密不可用/);
    assert.deepEqual(createSettingsStore(root, encryption).load(), value);
  } finally { rmSync(root, { recursive: true }); }
});
test('cloud vision and Ollama script models preserve visualFacts without forwarding image to script model', async () => {
  const facts = { productType: '瓶子', packageType: '瓶', primaryColor: '橙色', secondaryColors: [], material: '未确认', visibleText: [], visibleFeatures: ['黑色瓶盖'], usageClues: [], uncertain: ['材质'] };
  const script = { title: '测试', style: 'UGC', hook: '看这里', script: ['0-3s','3-8s','8-13s','13-15s'].map(timestamp => ({ timestamp, visual: '橙色瓶子', audio: '测试配音' })), cta: '了解更多' };
  const calls: any[] = [];
  const provider = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const input = body ? JSON.parse(body) : {};
    calls.push({ url: req.url, input });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/chat/completions') res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(facts) } }] }));
    else if (req.url === '/api/show') res.end(JSON.stringify({ capabilities: ['completion'] }));
    else if (req.url === '/api/chat') res.end(JSON.stringify({ message: { content: JSON.stringify([script]) } }));
    else { res.statusCode = 404; res.end('{}'); }
  });
  await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const root = mkdtempSync(path.join(tmpdir(), 'TK mock '));
  mkdirSync(path.join(root, 'dist'));
  writeFileSync(path.join(root, 'dist/index.html'), '<html>test</html>');
  const backend = await startServer({ rootDir: root });
  const post = async (route: string, body: any) => {
    const response = await fetch(backend.url + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    return result;
  };
  try {
    const image = 'data:image/png;base64,aGVsbG8=';
    const analyzed = await post('/api/analyze-product-image', { product: '瓶子', image, modelConfig: { provider: 'openai', cloudProviderId: 'custom', model: 'vision-model', apiKey: 'test-only', inputMode: 'multimodal', baseUrl } });
    assert.deepEqual(analyzed.visualFacts, facts);
    const generated = await post('/api/generate-one', { region: '美区 (United States)', product: '瓶子', targetAudience: '成人', features: '便携', duration: '15秒', image, visualFacts: analyzed.visualFacts, modelConfig: { provider: 'ollama', model: 'script-model', inputMode: 'text', baseUrl } });
    assert.equal(generated.script.title, '测试');
    assert.equal(calls[0].input.model, 'vision-model');
    const generation = calls.find(call => call.url === '/api/chat').input;
    assert.equal(generation.model, 'script-model');
    assert.equal(generation.messages[0].images, undefined);
    assert.match(generation.messages[0].content, /橙色/);
    assert.match(generation.messages[0].content, /黑色瓶盖/);
  } finally {
    await backend.close();
    rmSync(root, { recursive: true });
    await new Promise<void>(resolve => { provider.close(() => resolve()); provider.closeAllConnections(); });
  }
});
