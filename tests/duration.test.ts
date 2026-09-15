import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durationPlan, validateDuration, generateTimed } from '../duration';
const scripts = (duration: string) => [{ script: durationPlan(duration).slots.map(timestamp => ({ timestamp, visual: '演示', audio: '台词' })) }];
test('all UI durations have complete distinct timelines; reject short, missing and discontinuous results', () => {
  for (const d of ['10秒 · 2积分 (极限短平快/极速促单)', '15秒 · 3积分 (极速引流/强视觉)', '20-30秒 · 6积分 (标准爆款展示)', '45秒 · 9积分 (深度痛点解析)', '60秒 · 12积分 (完整沉浸式评测)']) {
    validateDuration(scripts(d), d);
    assert.throws(() => validateDuration([{ script: [{ timestamp: '' }] }], d));
    if (!d.startsWith('10秒')) assert.throws(() => validateDuration(scripts('10秒'), d));
  }
  const broken = scripts('60秒'); broken[0].script[1].timestamp = '4-8s';
  assert.throws(() => validateDuration(broken, '60秒'));
  assert.throws(() => durationPlan('任意文字'));
});
test('short result is rewritten once; persistent short result is never returned as success', async () => {
  let calls = 0;
  const result = await generateTimed('60秒', async correction => {
    calls++; if (calls === 1) return scripts('10秒');
    assert.match(correction, /60秒/); return scripts('60秒');
  });
  validateDuration(result, '60秒'); assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(generateTimed('45秒', async () => { calls++; return scripts('10秒'); }), /重写后仍未满足/);
  assert.equal(calls, 2);
});
import { createServer } from 'node:http';
import { startServer } from '../server';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
test('HTTP local and cloud routes retry short scripts and validate every returned variant', async () => {
  let calls = 0;
  let persistShort = false;
  const provider = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const input = raw ? JSON.parse(raw) : {};
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/show') { res.end('{}'); return; }
    calls++;
    const correction = input.messages[0].content.includes('重写纠正');
    const duration = correction && !persistShort ? '60秒' : '10秒';
    const script = { title:'样例', style:'UGC', hook:'开场', cta:'了解更多', ...scripts(duration)[0] };
    const output = req.url === '/api/chat' ? script : [script, script, script];
    res.end(JSON.stringify(req.url === '/api/chat' ? {message:{content:JSON.stringify(output)}} : {choices:[{message:{content:JSON.stringify(output)}}]}));
  });
  await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
  const address = provider.address() as any;
  const root = mkdtempSync(path.join(tmpdir(),'TK duration '));
  mkdirSync(path.join(root,'dist')); writeFileSync(path.join(root,'dist/index.html'),'test');
  const backend = await startServer({rootDir:root});
  try {
    for (const type of ['ollama', 'openai']) {
      for (persistShort of [false,true]) {
        calls = 0;
        const response = await fetch(backend.url + (type === 'ollama' ? '/api/generate-one' : '/api/generate'), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product:'杯子',features:'便携',targetAudience:'成人',duration:'60秒',modelConfig:{provider:type,model:'test',apiKey:'test',baseUrl:'http://127.0.0.1:'+address.port}})});
        const result = await response.json();
        assert.equal(calls,2);
        if (persistShort) { assert.notEqual(response.status,200); assert.match(result.error,/时长/); }
        else { assert.equal(response.status,200); validateDuration(result.scripts || [result.script],'60秒'); }
      }
    }
  } finally { await backend.close(); await new Promise<void>(resolve=>{provider.close(()=>resolve());provider.closeAllConnections();});rmSync(root,{recursive:true}); }
});
