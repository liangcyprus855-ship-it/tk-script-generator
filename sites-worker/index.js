const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,authorization,wechatpay-signature,wechatpay-timestamp,wechatpay-nonce,wechatpay-serial", "access-control-allow-methods": "GET,POST,OPTIONS" } });
const text = (value) => String(value ?? "").trim();
const now = () => new Date().toISOString();
const encoder = new TextEncoder();
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function sha256(value) { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
async function passwordHash(password, salt = crypto.randomUUID(), iterations = 100000) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations, hash: "SHA-256" }, key, 256);
  return `${salt}:${hex(bits)}`;
}
async function checkPassword(password, stored) {
  const [salt, expected] = text(stored).split(":");
  if (!salt || !expected) return false;
  for (const iterations of [100000, 120000]) {
    try {
      const actual = await passwordHash(password, salt, iterations);
      if (actual === `${salt}:${expected}`) return true;
    } catch {}
  }
  return false;
}
function authToken(request) { return text(request.headers.get("authorization")).replace(/^Bearer\s+/i, ""); }
async function isAdmin(request, env) { const supplied = text(request.headers.get("x-admin-token") || authToken(request)); if (text(env.ADMIN_TOKEN) && supplied === text(env.ADMIN_TOKEN)) return true; const user = await userFrom(request, env); return Boolean(user && text(env.ADMIN_EMAIL) && user.email === text(env.ADMIN_EMAIL).toLowerCase()); }
async function userFrom(request, env) {
  const token = await sha256(authToken(request));
  if (!token) return null;
  return env.DB.prepare("SELECT a.id, a.email, a.credits FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?").bind(token, now()).first();
}
async function requireUser(request, env) { return userFrom(request, env); }
function packages(id) { return ({ starter: [990, 100], creator: [3990, 500], studio: [9990, 1500] })[id] || null; }
function pemToBytes(pem) { return fromB64(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")); }
async function rsaKey(pem, usage) { return crypto.subtle.importKey("pkcs8", pemToBytes(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, usage); }
async function rsaPublicKey(pem) { return crypto.subtle.importKey("spki", pemToBytes(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]); }
async function verifyWechat(request, rawBody, env) {
  const signature = text(request.headers.get("wechatpay-signature")); const timestamp = text(request.headers.get("wechatpay-timestamp")); const nonce = text(request.headers.get("wechatpay-nonce"));
  if (!signature || !timestamp || !nonce || !text(env.WECHAT_PLATFORM_PUBLIC_KEY)) return false;
  const key = await rsaPublicKey(env.WECHAT_PLATFORM_PUBLIC_KEY);
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64(signature), encoder.encode(`${timestamp}\n${nonce}\n${rawBody}\n`));
}
async function wechatNative(env, order) {
  const required = ["WECHAT_APP_ID", "WECHAT_MCH_ID", "WECHAT_SERIAL_NO", "WECHAT_API_V3_KEY", "WECHAT_PRIVATE_KEY", "WECHAT_NOTIFY_URL"];
  const missing = required.filter((key) => !text(env[key]));
  if (missing.length) throw Object.assign(new Error(`微信支付配置不完整：${missing.join("、")}`), { status: 503 });
  if (new TextEncoder().encode(env.WECHAT_API_V3_KEY).length !== 32) throw Object.assign(new Error("WECHAT_API_V3_KEY 必须为 32 字节"), { status: 503 });
  const path = "/v3/pay/transactions/native";
  const body = JSON.stringify({ appid: env.WECHAT_APP_ID, mchid: env.WECHAT_MCH_ID, description: `TK脚本生成器-${order.package_id}`, out_trade_no: order.id, notify_url: env.WECHAT_NOTIFY_URL, amount: { total: order.amount_fen, currency: "CNY" } });
  const timestamp = String(Math.floor(Date.now() / 1000)); const nonce = crypto.randomUUID().replaceAll("-", "");
  const key = await rsaKey(env.WECHAT_PRIVATE_KEY, ["sign"]);
  const signature = b64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(`POST\n${path}\n${timestamp}\n${nonce}\n${body}\n`)));
  const response = await fetch(`${env.WECHAT_API_BASE_URL || "https://api.mch.weixin.qq.com"}${path}`, { method: "POST", headers: { "content-type": "application/json", authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${env.WECHAT_MCH_ID}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${env.WECHAT_SERIAL_NO}",signature="${signature}"` }, body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.code_url) throw Object.assign(new Error(`微信统一下单失败：${text(result.message) || response.status}`), { status: 502 });
  return result.code_url;
}
async function decryptWechat(resource, key) {
  const encrypted = fromB64(resource.ciphertext); const data = encrypted.slice(0, -16); const tag = encrypted.slice(-16);
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: encoder.encode(resource.nonce), additionalData: encoder.encode(resource.associated_data || "",) }, cryptoKey, new Uint8Array([...data, ...tag]));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function ensureProofTable(env) { await env.DB.prepare("CREATE TABLE IF NOT EXISTS payment_proofs (order_id TEXT PRIMARY KEY, note TEXT NOT NULL, created_at TEXT NOT NULL)").run(); }
const adminPage = `<!doctype html><meta charset="utf-8"><title>TK脚本生成器后台</title><style>body{font-family:system-ui;margin:32px;background:#f6f7fb;color:#172033}button,input{padding:8px 12px;margin:4px}table{border-collapse:collapse;background:white;width:100%}td,th{padding:10px;border:1px solid #ddd;text-align:left}.hidden{display:none}.error{color:#c92a2a}</style><h1>TK脚本生成器 · 充值审核</h1><section id="loginBox"><p>管理员邮箱：<input id="email" type="email" value="253874384@qq.com"></p><p>管理员密码：<input id="password" type="password"><button id="loginButton" onclick="login()">登录后台</button></p><div id="loginMsg" class="error"></div></section><section id="panel" class="hidden"><button onclick="load()">刷新待审核订单</button><button onclick="logout()">退出</button><div id="msg"></div><table><thead><tr><th>订单</th><th>账户</th><th>金额</th><th>订单积分</th><th>备注</th><th>本次发放</th><th>操作</th></tr></thead><tbody id="rows"></tbody></table></section><script>let auth='';const el=id=>document.getElementById(id);async function login(){const button=el('loginButton');const loginMsg=el('loginMsg');button.disabled=true;loginMsg.textContent='登录中…';try{const r=await fetch('/api/account/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:el('email').value.trim(),password:el('password').value})});const d=await r.json().catch(()=>({}));if(!r.ok){loginMsg.textContent=d.error||('登录失败（HTTP '+r.status+'）');return}auth=d.token;el('loginBox').classList.add('hidden');el('panel').classList.remove('hidden');await load()}catch(e){loginMsg.textContent='网络错误：'+e.message}finally{button.disabled=false}}async function load(){const r=await fetch('/api/admin/orders',{headers:{authorization:'Bearer '+auth}});const d=await r.json().catch(()=>({}));if(!r.ok){el('msg').textContent=d.error||'加载失败';return}el('rows').innerHTML=d.orders.map(o=>'<tr><td>'+o.id+'</td><td>'+o.email+'</td><td>'+(o.amount_fen/100).toFixed(2)+' 元</td><td>'+o.credits+'</td><td>'+((o.note||'')+'').replaceAll('<','&lt;')+'</td><td><input id="credits-'+o.id+'" type="number" min="1" value="'+o.credits+'" style="width:90px"></td><td><button data-id="'+o.id+'" data-action="approve">发放积分</button><button data-id="'+o.id+'" data-action="reject">驳回</button></td></tr>').join('');el('rows').querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>act(b.dataset.id,b.dataset.action))}async function act(id,a){const body=a==='approve'?JSON.stringify({credits:Number(el('credits-'+id).value)}):'{}';const r=await fetch('/api/admin/orders/'+id+'/'+a,{method:'POST',headers:{authorization:'Bearer '+auth,'content-type':'application/json'},body});const d=await r.json();el('msg').textContent=d.error||d.message||'完成';load()}function logout(){auth='';el('panel').classList.add('hidden');el('loginBox').classList.remove('hidden')}</script>`;

export default { async fetch(request, env) {
  if (request.method === "OPTIONS") return json({ ok: true });
  const url = new URL(request.url); const route = url.pathname;
  try {
    if (route === "/api/health") return json({ ok: true, version: "1.0.3-sites" });
    if (route === "/admin" && request.method === "GET") return new Response(adminPage, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (route === "/api/account/register" && request.method === "POST") {
      const body = await request.json(); const email = text(body.email).toLowerCase(); const password = text(body.password);
      if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return json({ error: "请输入有效邮箱和至少 8 位密码" }, 400);
      const exists = await env.DB.prepare("SELECT id FROM accounts WHERE email=?").bind(email).first(); if (exists) return json({ error: "该账号已存在" }, 409);
      const id = crypto.randomUUID(); const stored = await passwordHash(password); await env.DB.batch([env.DB.prepare("INSERT INTO accounts(id,email,password_hash,credits,created_at) VALUES(?,?,?,?,?)").bind(id, email, stored, 100, now()), env.DB.prepare("INSERT INTO ledger(id,account_id,type,amount,balance,description,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), id, "grant", 100, 100, "新用户体验积分", now())]);
      const token = crypto.randomUUID(); await env.DB.prepare("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)").bind(await sha256(token), id, new Date(Date.now() + 30 * 86400000).toISOString()).run(); return json({ token, user: { id, email, credits: 100 } });
    }
    if (route === "/api/account/login" && request.method === "POST") { const body = await request.json(); const account = await env.DB.prepare("SELECT * FROM accounts WHERE email=?").bind(text(body.email).toLowerCase()).first(); if (!account || !(await checkPassword(text(body.password), account.password_hash))) return json({ error: "账号或密码不正确" }, 401); const token = crypto.randomUUID(); await env.DB.prepare("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)").bind(await sha256(token), account.id, new Date(Date.now() + 30 * 86400000).toISOString()).run(); return json({ token, user: { id: account.id, email: account.email, credits: account.credits } }); }
    if (route === "/api/account/me" && request.method === "GET") { const user = await requireUser(request, env); return user ? json({ user }) : json({ error: "请先登录" }, 401); }
    if (route === "/api/billing/quote" && request.method === "POST") { const duration = text((await request.json()).duration); const seconds = Number(duration.match(/^\d+/)?.[0] || 0); if (![10, 15, 30, 45, 60].includes(seconds)) return json({ error: "请选择有效的脚本时长" }, 400); return json({ duration, credits: Math.ceil(seconds / 5) }); }
    if (route === "/api/billing/orders" && request.method === "POST") { const user = await requireUser(request, env); if (!user) return json({ error: "请先登录" }, 401); const body = await request.json(); const pack = packages(text(body.packageId)); const provider = text(body.provider); if (!pack || !["wechat", "alipay_personal", "mock"].includes(provider)) return json({ error: "充值参数无效" }, 400); const id = `RC${Date.now()}${crypto.randomUUID().slice(0, 8)}`; await env.DB.prepare("INSERT INTO orders(id,account_id,provider,package_id,amount_fen,credits,status,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(id, user.id, provider, text(body.packageId), pack[0], pack[1], "pending", now()).run(); const order = { id, userId: user.id, provider, packageId: text(body.packageId), amountFen: pack[0], credits: pack[1], status: "pending" }; return json({ order, payment: provider === "wechat" ? { mode: "wechat_native_pending", action: `/api/billing/orders/${id}/wechat/native` } : provider === "alipay_personal" ? { mode: "manual", message: "个人收款码需人工审核" } : { mode: "mock" } }, 201); }
    const native = route.match(/^\/api\/billing\/orders\/([^/]+)\/wechat\/native$/); if (native && request.method === "POST") { const user = await requireUser(request, env); if (!user) return json({ error: "请先登录" }, 401); const order = await env.DB.prepare("SELECT * FROM orders WHERE id=? AND account_id=?").bind(native[1], user.id).first(); if (!order || order.provider !== "wechat") return json({ error: "充值订单不存在" }, 404); const codeUrl = await wechatNative(env, order); return json({ order, payment: { mode: "wechat_native", codeUrl } }); }
    const mock = route.match(/^\/api\/billing\/orders\/([^/]+)\/mock-pay$/); if (mock && request.method === "POST") { const user = await requireUser(request, env); if (!user) return json({ error: "请先登录" }, 401); const order = await env.DB.prepare("SELECT * FROM orders WHERE id=? AND account_id=?").bind(mock[1], user.id).first(); if (!order || order.provider !== "mock") return json({ error: "充值订单不存在" }, 404); if (order.status !== "paid") { await env.DB.batch([env.DB.prepare("UPDATE orders SET status='paid',paid_at=? WHERE id=? AND status='pending'").bind(now(), order.id), env.DB.prepare("UPDATE accounts SET credits=credits+? WHERE id=?").bind(order.credits, user.id)]); } const updated = await env.DB.prepare("SELECT id,email,credits FROM accounts WHERE id=?").bind(user.id).first(); return json({ user: updated }); }
    const proof = route.match(/^\/api\/billing\/orders\/([^/]+)\/submit-proof$/); if (proof && request.method === "POST") { const user = await requireUser(request, env); if (!user) return json({ error: "请先登录" }, 401); const body = await request.json().catch(() => ({})); const order = await env.DB.prepare("SELECT * FROM orders WHERE id=? AND account_id=?").bind(proof[1], user.id).first(); if (!order || order.provider !== "alipay_personal") return json({ error: "充值订单不存在" }, 404); await ensureProofTable(env); await env.DB.batch([env.DB.prepare("INSERT OR REPLACE INTO payment_proofs(order_id,note,created_at) VALUES(?,?,?)").bind(order.id, text(body.note), now()), env.DB.prepare("UPDATE orders SET status='proof_submitted' WHERE id=? AND status='pending'").bind(order.id)]); return json({ ok: true, message: "付款备注已提交，管理员确认后会增加积分" }); }
    if (route === "/api/admin/orders" && request.method === "GET") { if (!(await isAdmin(request, env))) return json({ error: "管理员账户无权限" }, 403); await ensureProofTable(env); const rows = await env.DB.prepare("SELECT o.*, a.email, p.note FROM orders o JOIN accounts a ON a.id=o.account_id LEFT JOIN payment_proofs p ON p.order_id=o.id WHERE o.status='proof_submitted' ORDER BY o.created_at ASC").all(); return json({ orders: rows.results || [] }); }
    const adminAction = route.match(/^\/api\/admin\/orders\/([^/]+)\/(approve|reject)$/); if (adminAction && request.method === "POST") { if (!(await isAdmin(request, env))) return json({ error: "管理员账户无权限" }, 403); const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(adminAction[1]).first(); if (!order || order.status !== "proof_submitted") return json({ error: "订单不存在或已处理" }, 404); if (adminAction[2] === "reject") { await env.DB.prepare("UPDATE orders SET status='rejected' WHERE id=?").bind(order.id).run(); return json({ message: "订单已驳回" }); } const body = await request.json().catch(() => ({})); const amount = Math.floor(Number(body.credits ?? order.credits)); if (!Number.isFinite(amount) || amount < 1 || amount > 100000) return json({ error: "发放积分必须是 1 到 100000 的整数" }, 400); const account = await env.DB.prepare("SELECT credits FROM accounts WHERE id=?").bind(order.account_id).first(); const balance = Number(account?.credits || 0) + amount; await env.DB.batch([env.DB.prepare("UPDATE orders SET status='paid',paid_at=? WHERE id=? AND status='proof_submitted'").bind(now(), order.id), env.DB.prepare("UPDATE accounts SET credits=? WHERE id=?").bind(balance, order.account_id), env.DB.prepare("INSERT INTO ledger(id,account_id,type,amount,balance,description,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), order.account_id, "recharge", amount, balance, `人工审核到账：${order.package_id}`, now())]); return json({ message: `已发放 ${amount} 积分`, balance }); }
    if (route === "/api/billing/webhook/wechat" && request.method === "POST") { const raw = await request.text(); const body = JSON.parse(raw); if (!env.WECHAT_API_V3_KEY || !body.resource) return json({ code: "FAIL", message: "回调配置不完整" }, 400); if (!(await verifyWechat(request, raw, env))) return json({ code: "FAIL", message: "回调验签失败" }, 401); const result = await decryptWechat(body.resource, env.WECHAT_API_V3_KEY); if (result.trade_state !== "SUCCESS") return json({ code: "SUCCESS", message: "成功" }); const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(result.out_trade_no).first(); if (!order || order.provider !== "wechat" || Number(result.amount?.total) !== Number(order.amount_fen)) return json({ code: "FAIL", message: "订单校验失败" }, 400); if (order.status !== "paid") { await env.DB.batch([env.DB.prepare("UPDATE orders SET status='paid',paid_at=? WHERE id=? AND status='pending'").bind(now(), order.id), env.DB.prepare("UPDATE accounts SET credits=credits+? WHERE id=?").bind(order.credits, order.account_id)]); } return json({ code: "SUCCESS", message: "成功" }); }
    return json({ error: "Not found" }, 404);
  } catch (error) { return json({ error: error?.message || "服务器错误" }, error?.status || 500); }
} };
