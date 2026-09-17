import crypto from 'node:crypto';
import { quoteDuration } from './pricing.mjs';
export { quoteDuration } from './pricing.mjs';

export function generationService(pool, generate) {
  const tx = async fn => {
    const c = await pool.connect();
    try { await c.query('BEGIN'); const result = await fn(c); await c.query('COMMIT'); return result; }
    catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  };
  const userView = row => ({ id: row.id, email: row.email, balanceFen: Number(row.balance_fen), balanceYuan: (Number(row.balance_fen) / 100).toFixed(2) });
  async function init() {
    await pool.query(`CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), request_id TEXT NOT NULL,
      input_hash TEXT NOT NULL, status TEXT NOT NULL, duration TEXT NOT NULL, amount_fen INTEGER NOT NULL,
      result_json JSONB, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
      UNIQUE(account_id,request_id))`);
    await pool.query("ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT ''");
  }
  async function get(userId, id) {
    const row = (await pool.query('SELECT * FROM generation_jobs WHERE id=$1 AND account_id=$2', [id, userId])).rows[0];
    if (!row) throw Object.assign(new Error('生成记录不存在'), { status: 404 });
    const account = (await pool.query('SELECT id,email,balance_fen FROM accounts WHERE id=$1', [userId])).rows[0];
    return { jobId: row.id, requestId: row.request_id, duration: row.duration, createdAt: row.created_at, region: row.region, product: row.product, status: row.status, amountFen: row.amount_fen, error: row.error,
      ...(row.result_json || {}), user: userView(account) };
  }
  async function finish(id, result, error) {
    return tx(async c => {
      const row = (await c.query('SELECT * FROM generation_jobs WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!row || row.status !== 'running') return;
      if (error) {
        const account = (await c.query('UPDATE accounts SET balance_fen=balance_fen+$1 WHERE id=$2 RETURNING balance_fen', [row.amount_fen, row.account_id])).rows[0];
        await c.query('INSERT INTO ledger(id,account_id,type,amount,balance,description,created_at,reference) VALUES($1,$2,$3,$4,$5,$6,now(),$7)',
          [crypto.randomUUID(), row.account_id, 'refund', row.amount_fen, account.balance_fen, '生成失败，费用已退回', `refund:${id}`]);
      } else {
        await c.query('INSERT INTO generation_records(id,account_id,reference,duration,amount_fen,content_json,created_at) VALUES($1,$2,$3,$4,$5,$6,now())',
          [crypto.randomUUID(), row.account_id, id, row.duration, row.amount_fen, JSON.stringify(result.scripts)]);
      }
      await c.query('UPDATE generation_jobs SET status=$2,result_json=$3,error=$4,finished_at=now() WHERE id=$1',
        [id, error ? 'failed' : 'succeeded', result ? JSON.stringify(result) : null, error || null]);
    });
  }
  async function execute(id, input) {
    try {
      const result = await generate(input, AbortSignal.timeout(180000));
      await finish(id, result, null);
      console.log(JSON.stringify({ event: 'generation_succeeded', jobId: id }));
    } catch (error) {
      const message = error.name === 'TimeoutError' || error.name === 'AbortError' ? '生成超时，费用已退回' : '生成失败，费用已退回，请重试或联系管理员';
      console.error(JSON.stringify({ event: 'generation_failed', jobId: id, code: error.code || error.name || 'UNKNOWN' }));
      try { await finish(id, null, message); }
      catch { console.error(JSON.stringify({ event: 'refund_pending', jobId: id })); }
    }
  }
  async function recover(all = false) {
    const rows = await pool.query(`SELECT id FROM generation_jobs WHERE status='running' ${all ? '' : "AND created_at < now() - interval '5 minutes'"}`);
    for (const row of rows.rows) await finish(row.id, null, '生成任务中断，费用已退回，请重新生成');
  }
  async function submit(userId, body) {
    const requestId = String(body.requestId || '');
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw Object.assign(new Error('缺少有效请求编号'), { status: 400 });
    const quote = quoteDuration(body.duration);
    const input = { duration: quote.duration };
    for (const key of ['product', 'targetAudience', 'features', 'region']) {
      if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 4000) throw Object.assign(new Error('请填写完整有效的产品信息'), { status: 400 });
      input[key] = body[key].trim();
    }
    if (body.image) {
      if (typeof body.image !== 'string' || body.image.length > 7_000_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.image)) throw Object.assign(new Error('图片格式不正确或超过5MB'), { status: 400 });
      input.image = body.image;
    }
    const hash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const reserved = await tx(async c => {
      await c.query('SELECT pg_advisory_xact_lock(794136)');
      // Same account is serialized before both idempotency and balance checks.
      const account = (await c.query('SELECT * FROM accounts WHERE id=$1 FOR UPDATE', [userId])).rows[0];
      if (!account) throw Object.assign(new Error('请重新登录'), { status: 401 });
      const old = (await c.query('SELECT id,input_hash FROM generation_jobs WHERE account_id=$1 AND request_id=$2', [userId, requestId])).rows[0];
      if (old) {
        if (old.input_hash !== hash) throw Object.assign(new Error('请求编号已用于其他参数'), { status: 409 });
        return { id: old.id, start: false };
      }
      const count = (await c.query("SELECT count(*)::int AS count FROM generation_jobs WHERE status='running'")).rows[0].count;
      if (count >= 4) throw Object.assign(new Error('服务器正在处理其他任务，请稍后再试，本次未扣费'), { status: 429 });
      const running = await c.query("SELECT id FROM generation_jobs WHERE account_id=$1 AND status='running' LIMIT 1", [userId]);
      if (running.rows[0]) throw Object.assign(new Error('已有任务正在生成，请等待完成'), { status: 409 });
      if (Number(account.balance_fen) < quote.amountFen) throw Object.assign(new Error(`余额不足，本次需要 ¥${(quote.amountFen/100).toFixed(2)}，请先充值`), { status: 402 });
      const id = crypto.randomUUID(), balance = Number(account.balance_fen) - quote.amountFen;
      await c.query('UPDATE accounts SET balance_fen=$1 WHERE id=$2', [balance, userId]);
      await c.query("INSERT INTO generation_jobs(id,account_id,request_id,input_hash,status,duration,amount_fen) VALUES($1,$2,$3,$4,'running',$5,$6)", [id, userId, requestId, hash, input.duration, quote.amountFen]);
      await c.query('UPDATE generation_jobs SET region=$2,product=$3 WHERE id=$1', [id,input.region,input.product]);
      await c.query('INSERT INTO ledger(id,account_id,type,amount,balance,description,created_at,reference) VALUES($1,$2,$3,$4,$5,$6,now(),$7)', [crypto.randomUUID(), userId, 'consume', -quote.amountFen, balance, `生成${input.duration}三款脚本（失败自动退回）`, id]);
      return { id, start: true };
    });
    if (reserved.start) void execute(reserved.id, input);
    return get(userId, reserved.id);
  }
  return { init, get, submit, recover, finish };
}

export async function mountGeneration(app, pool, userFrom, generate) {
  const jobs = generationService(pool, generate);
  await jobs.init(); await jobs.recover(true);
  setInterval(() => jobs.recover().catch(() => console.error('Generation recovery pending')), 60000).unref();
  const route = fn => async (req, res) => {
    try {
      const user = await userFrom(req);
      if (!user) return res.status(401).json({ error: '登录已过期，请重新登录', code: 'SESSION_EXPIRED' });
      return await fn(req, res, user);
    } catch (e) { return res.status(e.status || 503).json({ error: e.status ? e.message : '服务器暂时不可用，请稍后重试', code: e.status === 402 ? 'INSUFFICIENT_BALANCE' : 'GENERATION_REQUEST_FAILED' }); }
  };
  app.post('/api/generate', route(async (req,res,user) => res.status(202).json(await jobs.submit(user.id, req.body))));
  app.get('/api/generation-jobs/latest', route(async (_req,res,user) => {
    const row = (await pool.query('SELECT id FROM generation_jobs WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1', [user.id])).rows[0];
    return res.json(row ? await jobs.get(user.id, row.id) : { status: 'none' });
  }));
  app.get('/api/generation-jobs/:id', route(async (req,res,user) => res.json(await jobs.get(user.id, req.params.id))));
  return jobs;
}
