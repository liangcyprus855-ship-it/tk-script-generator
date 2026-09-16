export function quoteDuration(duration) {
  const m = String(duration || '').match(/^(10|15|20-30|30|45|60)秒(?:\s*(?:·.*|\(.*\)))?$/);
  if (!m) throw Object.assign(new Error('请选择有效的脚本时长'), { status: 400 });
  const seconds = m[1] === '20-30' ? 30 : Number(m[1]);
  return { duration: seconds === 30 ? '20-30秒' : `${seconds}秒`, amountFen: seconds * 2 };
}
