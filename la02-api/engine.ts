import { buildPrompt, parseJsonScripts, buildVisualAnalysisPrompt, parseProductVisualFacts } from '../server';
import { generateTimed } from '../duration';
import type { ScriptRequest } from '../src/types';

export async function generateScripts(input: ScriptRequest, signal: AbortSignal) {
  const apiKey = String(process.env.MIMO_API_KEY || '').trim();
  if (!apiKey) throw Object.assign(new Error('模型服务尚未配置，请联系管理员'), { code: 'PROVIDER_CONFIG' });
  const calls: any[] = [];
  async function complete(prompt: string, image?: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      signal.throwIfAborted();
      const response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'mimo-v2.5', thinking: { type: 'disabled' }, max_completion_tokens: 12000, stream: false,
          messages: [{ role: 'user', content: image ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] : prompt }] })
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        if ([429, 502, 503, 504].includes(response.status) && attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); continue;
        }
        // Provider bodies can echo credentials or user input; persist only status and provider request id.
        throw Object.assign(new Error(`MiMo 服务请求失败（HTTP ${response.status}），本次费用将退回`), { code: `PROVIDER_${response.status}` });
      }
      calls.push({ id: data.id, model: data.model, usage: data.usage || {} });
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('模型没有返回有效内容');
      return content;
    }
    throw new Error('模型服务暂时繁忙');
  }
  const visualFacts = input.image ? parseProductVisualFacts(await complete(buildVisualAnalysisPrompt(input.product), input.image)) : undefined;
  const prompt = buildPrompt({ ...input, image: undefined, visualFacts });
  const scripts = await generateTimed(input.duration, async correction => {
    const raw = await complete(prompt + correction);
    const result = parseJsonScripts(raw);
    if (result.length !== 3) throw new Error('模型未返回完整的三款脚本');
    return result;
  });
  return { scripts, visualFacts, model: 'mimo-v2.5', calls };
}
