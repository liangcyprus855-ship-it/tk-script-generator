export function durationPlan(value: string) {
  const match = String(value).match(/^(10|15|20-30|45|60)秒(?:\s*\(.*\))?$/);
  if (!match) throw Object.assign(new Error('请选择有效的脚本时长'), { status: 400 });
  const seconds = match[1] === '20-30' ? 30 : Number(match[1]);
  const slots: string[] = [];
  for (let start = 0; start < seconds;) {
    const end = Math.min(seconds, start + (start === 0 ? 3 : 5));
    slots.push(start + '-' + end + 's'); start = end;
  }
  return { seconds, slots, tokens: Math.max(2200, slots.length * 450) };
}
export function durationInstruction(value: string) {
  const p = durationPlan(value);
  return '【时长硬性要求】目标总时长：' + p.seconds + '秒。必须生成至少' + p.slots.length + '个有实质内容的镜头。建议时间轴：' + p.slots.join('、') + '。从0秒开始，连续无重叠无空档，最后结束于' + p.seconds + '秒。每镜头不超过5秒。按时间展开动作、使用演示、卖点证据与配音；禁止只拉长时间标签、重复镜头或用空白凑时长。配音需能在对应镜头内自然说完。';
}
export function validateDuration(scripts: any[], value: string) {
  const p = durationPlan(value);
  if (!scripts.length) throw new Error('没有生成脚本');
  for (const script of scripts) {
    let end = 0;
    if (script.script.length < p.slots.length) throw new Error('镜头数量不足以支撑' + p.seconds + '秒');
    for (const scene of script.script) {
      const m = String(scene.timestamp).trim().match(/^(\d+(?:\.\d+)?)\s*(?:s|秒)?\s*[-–—~～至]\s*(\d+(?:\.\d+)?)\s*(?:s|秒)?$/i);
      if (!m) throw new Error('分镜缺少有效的起止时间');
      const start = Number(m[1]), next = Number(m[2]);
      if (Math.abs(start-end) > 0.01 || next <= start || next-start > 5.01) throw new Error('分镜时间不连续或单镜头超过5秒');
      end = next;
    }
    if (Math.abs(end-p.seconds) > 0.01) throw new Error('实际脚本仅' + end + '秒，目标为' + p.seconds + '秒');
  }
}
export async function generateTimed(value: string, generate: (correction: string) => Promise<any[]>) {
  let correction = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const scripts = await generate(correction);
    try { validateDuration(scripts, value); return scripts; }
    catch (error: any) {
      if (attempt === 1) throw new Error('模型重写后仍未满足所选时长：' + error.message + '。请重试或更换模型。');
      correction = '\n【重写纠正】上次输出不合格：' + error.message + '。请重新创作完整内容。' + durationInstruction(value);
    }
  }
  throw new Error('时长校验失败');
}
