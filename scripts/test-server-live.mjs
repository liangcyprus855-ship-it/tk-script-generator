// Run on LA-02 with --env-file=.env. Uses a paid MiMo request, no member account.
import { generateScripts } from '/opt/tk-platform-api/engine.cjs';
const started = Date.now();
try {
  const result = await generateScripts({ product: '深层清洁绿茶泥膜', region: '美区 (United States)', targetAudience: '居家办公成年人', features: '清洁护理，展示使用方法，不虚构功效', duration: '10秒' }, AbortSignal.timeout(180000));
  console.log(JSON.stringify({ ok: true, seconds: (Date.now()-started)/1000, model: result.model, scripts: result.scripts.length, timelines: result.scripts.map(s => s.script.map(x => x.timestamp)), calls: result.calls }));
} catch (e) { console.log(JSON.stringify({ ok: false, code: e.code || e.name, message: e.message, seconds: (Date.now()-started)/1000 })); process.exitCode = 1; }
