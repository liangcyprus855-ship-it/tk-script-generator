import express from 'express';
import pg from 'pg';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { mountGeneration, quoteDuration } from './generation.mjs';
import { generateScripts } from './engine.cjs';
import { mountWorkbench } from './workbench.mjs';

const { Pool } = pg;
const app = express();
app.use(express.json({ limit: '8mb' }));
app.use((req, res, next) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type,authorization,x-admin-token');
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const env = process.env;
// Only server-owned generation transactions may debit/refund or create history.
app.use((req, res, next) => {
  if (req.method === 'POST' && (['/api/billing/consume', '/api/billing/refund', '/api/generations', '/api/model/generate'].includes(req.path) || req.path.endsWith('/mock-pay'))) {
    return res.status(410).json({ error: '请更新应用后使用服务器生成服务', code: 'CLIENT_UPGRADE_REQUIRED' });
  }
  next();
});
const pool = new Pool({
  host: env.PGHOST || '127.0.0.1',
  port: Number(env.PGPORT || 55432),
  database: env.PGDATABASE || 'tk_platform',
  user: env.PGUSER || 'tk_platform_app',
  password: env.PGPASSWORD,
  max: 8,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const text = (v) => String(v ?? '').trim();
const now = () => new Date().toISOString();
const json = (res, data, status = 200) => res.status(status).json(data);
const alreadyRegistered = (res) => json(res, { error: '该邮箱已注册，请直接登录', code: 'ACCOUNT_ALREADY_REGISTERED' }, 409);
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const publicUser = (row) => {
  const balanceFen = Number(row?.balance_fen ?? Number(row?.credits || 0) * 10);
  return { id: row.id, email: row.email, balanceFen, balanceYuan: (balanceFen / 100).toFixed(2) };
};
const verificationTransport = env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
  ? nodemailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465), secure: String(env.SMTP_SECURE || 'true') !== 'false', auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } })
  : null;
const verificationCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const verificationTtlMs = 15 * 60_000;
const maskEmail = (email) => { const [name, domain] = String(email || '').split('@'); return domain ? `${name.slice(0, 2)}***@${domain}` : '***'; };
async function sendVerificationMail(email, code) {
  const message = {
    from: env.SMTP_FROM || env.SMTP_USER,
    to: email,
    envelope: { from: env.SMTP_USER, to: email },
    subject: 'TK 脚本生成器邮箱验证码',
    text: `你的注册验证码是 ${code}，15 分钟内有效。如非本人操作请忽略。`,
  };
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const info = await verificationTransport.sendMail(message);
      const accepted = Array.isArray(info.accepted) && info.accepted.some((value) => String(value).toLowerCase() === email);
      const rejected = Array.isArray(info.rejected) && info.rejected.length > 0;
      if (!accepted || rejected) throw Object.assign(new Error('SMTP 未接受验证码收件地址'), { code: 'SMTP_RECIPIENT_REJECTED', responseCode: info.response });
      console.log(JSON.stringify({ event: 'verification_mail_accepted', email: maskEmail(email), messageId: info.messageId || '', response: info.response || '' }));
      return info;
    } catch (error) {
      lastError = error;
      if (!['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET', 'ETLS'].includes(error?.code)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  console.error(JSON.stringify({ event: 'verification_mail_failed', email: maskEmail(email), code: lastError?.code || 'UNKNOWN', responseCode: lastError?.responseCode || '', command: lastError?.command || '' }));
  throw lastError || new Error('SMTP 发信失败');
}
const authToken = (req) => text(req.get('authorization')).replace(/^Bearer\s+/i, '');

function checkPassword(password, stored) {
  const [salt, expected] = text(stored).split(':');
  if (!salt || !expected) return false;
  for (const iterations of [100000, 120000]) {
    const actual = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
    if (actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return true;
  }
  return false;
}

async function userFrom(req) {
  const token = authToken(req);
  if (!token) return null;
  const result = await pool.query('SELECT a.* FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>$2', [sha256(token), now()]);
  return result.rows[0] || null;
}
async function requireUser(req, res) {
  const user = await userFrom(req);
  if (!user) { json(res, { error: '请先登录' }, 401); return null; }
  return user;
}
async function isAdmin(req) {
  const user = await userFrom(req);
  return Boolean(user && env.ADMIN_EMAIL && user.email === env.ADMIN_EMAIL.toLowerCase());
}
function packages(id) { return ({ starter: [990, 100], creator: [3990, 500], studio: [9990, 1500] })[id] || null; }

mountWorkbench(app,pool,userFrom);
app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); return json(res, { ok: true, version: '1.0.17-server', generation: 'server-jobs', model: 'mimo-v2.5' }); }
  catch (error) { return json(res, { ok: false, error: error.message }, 503); }
});

app.post('/api/account/send-code', async (req, res) => {
  const email = text(req.body?.email).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return json(res, { error: '请输入有效的邮箱地址' }, 400);
  const existing = await pool.query('SELECT id FROM accounts WHERE email=$1', [email]);
  if (existing.rows[0]) return alreadyRegistered(res);
  if (!verificationTransport) return json(res, { error: '邮箱验证服务尚未配置，请联系管理员' }, 503);
  await pool.query('CREATE TABLE IF NOT EXISTS email_verification_codes (email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, sent_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, previous_code_hash TEXT, previous_expires_at TIMESTAMPTZ)');
  await pool.query('ALTER TABLE email_verification_codes ADD COLUMN IF NOT EXISTS previous_code_hash TEXT, ADD COLUMN IF NOT EXISTS previous_expires_at TIMESTAMPTZ');
  const previous = await pool.query('SELECT sent_at FROM email_verification_codes WHERE email=$1', [email]);
  if (previous.rows[0] && Date.now() - new Date(previous.rows[0].sent_at).getTime() < 60_000) return json(res, { error: '验证码已发送，请 60 秒后再试' }, 429);
  const code = verificationCode();
  const sentAt = now();
  const expiresAt = new Date(Date.now() + verificationTtlMs).toISOString();
  await pool.query('INSERT INTO email_verification_codes(email,code_hash,expires_at,sent_at,attempts,previous_code_hash,previous_expires_at) VALUES($1,$2,$3,$4,0,NULL,NULL) ON CONFLICT(email) DO UPDATE SET previous_code_hash=email_verification_codes.code_hash,previous_expires_at=email_verification_codes.expires_at,code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,sent_at=EXCLUDED.sent_at,attempts=0', [email, sha256(code), expiresAt, sentAt]);
  try { await sendVerificationMail(email, code); }
  catch (error) { await pool.query('DELETE FROM email_verification_codes WHERE email=$1', [email]); return json(res, { error: '验证码邮件发送失败，请稍后重试' }, 502); }
  return json(res, { message: '验证码已发送，请查收邮箱' });
});

app.post('/api/account/register', async (req, res) => {
  const email = text(req.body?.email).toLowerCase(); const password = text(req.body?.password);
  if (!email || password.length < 8) return json(res, { error: '请输入有效邮箱和至少 8 位密码' }, 400);
  const exists = await pool.query('SELECT id FROM accounts WHERE email=$1', [email]);
  if (exists.rows[0]) return alreadyRegistered(res);
  const code = text(req.body?.verificationCode);
  if (!/^\d{6}$/.test(code)) return json(res, { error: '请输入 6 位邮箱验证码' }, 400);
  await pool.query('CREATE TABLE IF NOT EXISTS email_verification_codes (email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, sent_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, previous_code_hash TEXT, previous_expires_at TIMESTAMPTZ)');
  await pool.query('ALTER TABLE email_verification_codes ADD COLUMN IF NOT EXISTS previous_code_hash TEXT, ADD COLUMN IF NOT EXISTS previous_expires_at TIMESTAMPTZ');
  const verification = await pool.query('SELECT * FROM email_verification_codes WHERE email=$1', [email]);
  const record = verification.rows[0];
  if (!record || (new Date(record.expires_at).getTime() < Date.now() && (!record.previous_expires_at || new Date(record.previous_expires_at).getTime() < Date.now()))) return json(res, { error: '验证码无效或已过期，请重新获取' }, 400);
  if (Number(record.attempts) >= 5) return json(res, { error: '验证码尝试次数过多，请重新获取' }, 429);
  const currentValid = record.code_hash === sha256(code) && new Date(record.expires_at).getTime() >= Date.now();
  const previousValid = record.previous_code_hash === sha256(code) && record.previous_expires_at && new Date(record.previous_expires_at).getTime() >= Date.now();
  if (!currentValid && !previousValid) { await pool.query('UPDATE email_verification_codes SET attempts=attempts+1 WHERE email=$1', [email]); return json(res, { error: '验证码不正确，请使用最近一次收到的验证码' }, 400); }
  const id = crypto.randomUUID(); const salt = crypto.randomUUID();
  const hash = `${salt}:${crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')}`;
  const created = now();
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    await client.query('INSERT INTO accounts(id,email,password_hash,credits,balance_fen,created_at,membership) VALUES($1,$2,$3,0,50,$4,$5)', [id, email, hash, created, '普通用户']);
    await client.query('INSERT INTO ledger(id,account_id,type,amount,balance,description,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [crypto.randomUUID(), id, 'grant', 50, 50, '新用户注册赠送', created]);
    await client.query('DELETE FROM email_verification_codes WHERE email=$1', [email]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') return alreadyRegistered(res);
    return json(res, { error: '注册未完成，请重试' }, 500);
  }
  finally { client.release(); }
  return json(res, { user: publicUser({ id, email, balance_fen: 50 }) }, 201);
});

app.post('/api/account/login', async (req, res) => {
  const email = text(req.body?.email).toLowerCase(); const password = text(req.body?.password);
  const result = await pool.query('SELECT * FROM accounts WHERE email=$1', [email]); const account = result.rows[0];
  if (!account || !checkPassword(password, account.password_hash)) return json(res, { error: '账号或密码不正确' }, 401);
  const token = crypto.randomUUID();
  await pool.query('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES($1,$2,$3)', [sha256(token), account.id, new Date(Date.now() + 30 * 86400000).toISOString()]);
  return json(res, { token, user: publicUser(account) });
});

app.get('/api/account/me', async (req, res) => { const user = await requireUser(req, res); return user ? json(res, { user: publicUser(user) }) : undefined; });
app.get('/api/account/ledger', async (req, res) => { const user = await requireUser(req, res); if (!user) return; const rows = await pool.query('SELECT * FROM ledger WHERE account_id=$1 ORDER BY created_at DESC LIMIT 200', [user.id]); return json(res, { ledger: rows.rows }); });

app.post('/api/billing/quote', (req, res) => { try { const q = quoteDuration(req.body?.duration); return json(res, { ...q, amountYuan: (q.amountFen/100).toFixed(2) }); } catch (e) { return json(res, { error: e.message }, 400); } });

app.post('/api/billing/consume', async (req, res) => billingChange(req, res, false));
app.post('/api/billing/refund', async (req, res) => billingChange(req, res, true));
async function billingChange(req, res, refund) {
  const user = await requireUser(req, res); if (!user) return;
  const amountFen = Math.floor(Number(req.body?.amountFen ?? Number(req.body?.amount || 0) * 10)); const reference = text(req.body?.reference);
  if (!Number.isFinite(amountFen) || amountFen < 1 || !reference) return json(res, { error: '余额参数无效' }, 400);
  const ledgerReference = refund ? `refund:${reference}` : reference; const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const old = await client.query('SELECT balance FROM ledger WHERE account_id=$1 AND reference=$2 LIMIT 1', [user.id, ledgerReference]);
    if (old.rows[0]) { const current = await client.query('SELECT * FROM accounts WHERE id=$1', [user.id]); await client.query('COMMIT'); return json(res, { user: publicUser(current.rows[0]), idempotent: true }); }
    const locked = await client.query('SELECT * FROM accounts WHERE id=$1 FOR UPDATE', [user.id]); const account = locked.rows[0]; const currentFen = Number(account?.balance_fen || 0);
    if (!refund && currentFen < amountFen) { await client.query('ROLLBACK'); return json(res, { error: '余额不足，请先充值' }, 402); }
    const balanceFen = refund ? currentFen + amountFen : currentFen - amountFen;
    await client.query('UPDATE accounts SET balance_fen=$1 WHERE id=$2', [balanceFen, user.id]);
    await client.query('INSERT INTO ledger(id,account_id,type,amount,balance,description,created_at,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [crypto.randomUUID(), user.id, refund ? 'refund' : 'consume', refund ? amountFen : -amountFen, balanceFen, text(req.body?.description) || (refund ? '生成失败退款' : '生成脚本'), now(), ledgerReference]);
    await client.query('COMMIT'); return json(res, { user: publicUser({ ...account, balance_fen: balanceFen }) });
  } catch (error) { await client.query('ROLLBACK'); return json(res, { error: error.message }, 500); } finally { client.release(); }
}

app.post('/api/generations', async (req, res) => { const user = await requireUser(req, res); if (!user) return; const reference = text(req.body?.reference); if (!reference) return json(res, { error: '缺少生成记录编号' }, 400); await pool.query('INSERT INTO generation_records(id,account_id,reference,duration,amount_fen,content_json,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(reference) DO NOTHING', [crypto.randomUUID(), user.id, reference, text(req.body?.duration), Math.floor(Number(req.body?.amountFen || 0)), JSON.stringify(req.body?.content ?? null), now()]); return json(res, { ok: true }); });
app.get('/api/generations', async (req, res) => { const user = await requireUser(req, res); if (!user) return; const rows = await pool.query('SELECT id,reference,duration,amount_fen,content_json,created_at FROM generation_records WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100', [user.id]); return json(res, { records: rows.rows.map((r) => ({ ...r, amountYuan: (Number(r.amount_fen)/100).toFixed(2), content: JSON.parse(r.content_json || 'null') })) }); });


app.post('/api/billing/orders', async (req, res) => { const user = await requireUser(req, res); if (!user) return; const provider = text(req.body?.provider); let pack = packages(text(req.body?.packageId)); const requested = Number(req.body?.amountFen); if (provider === 'alipay_personal' && Number.isInteger(requested) && requested >= 200) pack = [requested, Math.floor(requested / 10)]; if (!pack || !['wechat','alipay_personal','mock'].includes(provider)) return json(res, { error: '充值参数无效' }, 400); const packageId = provider === 'alipay_personal' && Number.isInteger(requested) && requested >= 200 ? 'custom' : text(req.body?.packageId); const id = `RC${Date.now()}${crypto.randomUUID().slice(0,8)}`; await pool.query('INSERT INTO orders(id,account_id,provider,package_id,amount_fen,credits,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id,user.id,provider,packageId,pack[0],pack[1],'pending',now()]); return json(res, { order:{id,userId:user.id,provider,packageId,amountFen:pack[0],credits:pack[1],status:'pending'}, payment: provider==='alipay_personal'?{mode:'manual',message:'个人收款码需人工审核'}:provider==='wechat'?{mode:'wechat_native_pending'}:{mode:'mock'} }, 201); });
app.get('/api/billing/orders', async (req, res) => { const user = await requireUser(req, res); if (!user) return; const rows = await pool.query('SELECT * FROM orders WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100', [user.id]); return json(res, { orders: rows.rows }); });
app.post('/api/billing/orders/:id/submit-proof', async (req, res) => { const user = await requireUser(req, res); if (!user) return; const order = await pool.query('SELECT * FROM orders WHERE id=$1 AND account_id=$2', [req.params.id,user.id]); if (!order.rows[0]) return json(res,{error:'订单不存在'},404); await pool.query('INSERT INTO payment_proofs(order_id,note,created_at) VALUES($1,$2,$3) ON CONFLICT(order_id) DO UPDATE SET note=EXCLUDED.note,created_at=EXCLUDED.created_at',[req.params.id,text(req.body?.note),now()]); await pool.query('UPDATE orders SET status=$1 WHERE id=$2 AND status=$3',['proof_submitted',req.params.id,'pending']); return json(res,{message:'已提交审核'}); });
app.post('/api/billing/orders/:id/mock-pay', async (req, res) => { const user = await requireUser(req, res); if (!user) return; const client=await pool.connect(); try { await client.query('BEGIN'); const o=(await client.query('SELECT * FROM orders WHERE id=$1 AND account_id=$2 FOR UPDATE',[req.params.id,user.id])).rows[0]; if(!o||o.provider!=='mock') { await client.query('ROLLBACK'); return json(res,{error:'订单不存在'},404); } if(o.status!=='paid'){const a=(await client.query('SELECT balance_fen FROM accounts WHERE id=$1 FOR UPDATE',[user.id])).rows[0];const b=Number(a.balance_fen||0)+Number(o.amount_fen);await client.query('UPDATE orders SET status=$1,paid_at=$2 WHERE id=$3',['paid',now(),o.id]);await client.query('UPDATE accounts SET balance_fen=$1 WHERE id=$2',[b,user.id]);await client.query('INSERT INTO ledger(id,account_id,type,amount,balance,description,created_at,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[crypto.randomUUID(),user.id,'recharge',o.amount_fen,b,'测试充值',now(),o.id]);} await client.query('COMMIT'); const a=(await pool.query('SELECT * FROM accounts WHERE id=$1',[user.id])).rows[0]; return json(res,{user:publicUser(a)}); } catch(e){await client.query('ROLLBACK');return json(res,{error:e.message},500)} finally{client.release()} });

app.get('/api/admin/users', async (req,res)=>{if(!(await isAdmin(req)))return json(res,{error:'管理员账户无权限'},403);const rows=await pool.query('SELECT a.id,a.email,a.balance_fen,a.created_at,a.admin_note,a.membership,COUNT(g.id)::int AS generation_count FROM accounts a LEFT JOIN generation_records g ON g.account_id=a.id GROUP BY a.id ORDER BY a.created_at DESC LIMIT 500');return json(res,{users:rows.rows.map(r=>({...r,balance_yuan:(Number(r.balance_fen||0)/100).toFixed(2)}))});});
app.patch('/api/admin/users/:id', async(req,res)=>{if(!(await isAdmin(req)))return json(res,{error:'管理员账户无权限'},403);await pool.query('UPDATE accounts SET admin_note=$1,membership=$2 WHERE id=$3',[text(req.body?.note),text(req.body?.membership)||'普通用户',req.params.id]);return json(res,{ok:true});});
app.post('/api/admin/users/:id/recharge', async(req,res)=>{if(!(await isAdmin(req)))return json(res,{error:'管理员账户无权限'},403);const amount=Math.floor(Number(req.body?.amountFen));if(!Number.isFinite(amount)||amount<1)return json(res,{error:'充值金额必须大于 0'},400);const c=await pool.connect();try{await c.query('BEGIN');const a=(await c.query('SELECT balance_fen FROM accounts WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!a){await c.query('ROLLBACK');return json(res,{error:'用户不存在'},404)}const b=Number(a.balance_fen||0)+amount;const ref='admin:'+crypto.randomUUID();await c.query('UPDATE accounts SET balance_fen=$1 WHERE id=$2',[b,req.params.id]);await c.query('INSERT INTO ledger(id,account_id,type,amount,balance,description,created_at,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[crypto.randomUUID(),req.params.id,'recharge',amount,b,'管理员手工充值',now(),ref]);await c.query('COMMIT');return json(res,{message:`已为用户充值 ¥${(amount/100).toFixed(2)}`});}catch(e){await c.query('ROLLBACK');return json(res,{error:e.message},500)}finally{c.release()}});
app.get('/api/admin/orders', async(req,res)=>{if(!(await isAdmin(req)))return json(res,{error:'管理员账户无权限'},403);const rows=await pool.query("SELECT o.*,a.email,p.note FROM orders o JOIN accounts a ON a.id=o.account_id LEFT JOIN payment_proofs p ON p.order_id=o.id WHERE o.status='proof_submitted' ORDER BY o.created_at ASC");return json(res,{orders:rows.rows});});
app.get('/api/admin/orders/history', async(req,res)=>{if(!(await isAdmin(req)))return json(res,{error:'管理员账户无权限'},403);const rows=await pool.query('SELECT o.id,o.account_id,o.provider,o.amount_fen,o.status,o.created_at,o.paid_at,a.email,p.note,NULL::text AS description FROM orders o JOIN accounts a ON a.id=o.account_id LEFT JOIN payment_proofs p ON p.order_id=o.id ORDER BY o.created_at DESC LIMIT 500');const manual=await pool.query("SELECT l.id,l.account_id,'admin' AS provider,l.amount AS amount_fen,'manual' AS status,l.created_at,NULL::timestamptz AS paid_at,a.email,NULL::text AS note,l.description FROM ledger l JOIN accounts a ON a.id=l.account_id WHERE l.type='recharge' AND l.description='管理员手工充值' ORDER BY l.created_at DESC LIMIT 500");return json(res,{orders:[...rows.rows,...manual.rows].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))});});
app.post('/api/admin/orders/:id/:action', async(req,res)=>{if(!(await isAdmin(req)))return json(res,{error:'管理员账户无权限'},403);const action=req.params.action;const o=(await pool.query('SELECT * FROM orders WHERE id=$1',[req.params.id])).rows[0];if(!o||o.status!=='proof_submitted')return json(res,{error:'订单不存在或已处理'},404);if(action==='reject'){await pool.query('UPDATE orders SET status=$1 WHERE id=$2',['rejected',o.id]);return json(res,{message:'订单已驳回'});}const amount=Math.floor(Number(req.body?.amountFen??o.amount_fen));const c=await pool.connect();try{await c.query('BEGIN');const a=(await c.query('SELECT balance_fen FROM accounts WHERE id=$1 FOR UPDATE',[o.account_id])).rows[0];const b=Number(a.balance_fen||0)+amount;await c.query('UPDATE orders SET status=$1,paid_at=$2 WHERE id=$3',['paid',now(),o.id]);await c.query('UPDATE accounts SET balance_fen=$1 WHERE id=$2',[b,o.account_id]);await c.query('INSERT INTO ledger(id,account_id,type,amount,balance,description,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),o.account_id,'recharge',amount,b,`人工审核到账：${o.package_id}`,now()]);await c.query('COMMIT');return json(res,{message:`已到账 ¥${(amount/100).toFixed(2)}`,balanceFen:b});}catch(e){await c.query('ROLLBACK');return json(res,{error:e.message},500)}finally{c.release()}});

await mountGeneration(app, pool, userFrom, generateScripts);
const port = Number(env.PORT || 38127); app.listen(port, '127.0.0.1', () => console.log(`tk-platform-api listening on 127.0.0.1:${port}`));
