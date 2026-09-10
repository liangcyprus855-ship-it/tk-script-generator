const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,authorization,wechatpay-signature,wechatpay-timestamp,wechatpay-nonce,wechatpay-serial", "access-control-allow-methods": "GET,POST,OPTIONS" } });
const text = (value) => String(value ?? "").trim();
const now = () => new Date().toISOString();
const encoder = new TextEncoder();
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function sha256(value) { return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
async function passwordHash(password, salt = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: 120000, hash: "SHA-256" }, key, 256);
  return `${salt}:${hex(bits)}`;
}
async function checkPassword(password, stored) {
  const [salt, expected] = text(stored).split(":");
  if (!salt || !expected) return false;
  const actual = await passwordHash(password, salt);
  return actual === `${salt}:${expected}`;
}
function authToken(request) { return text(request.headers.get("authorization")).replace(/^Bearer\s+/i, ""); }
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

export default { async fetch(request, env) {
  if (request.method === "OPTIONS") return json({ ok: true });
  const url = new URL(request.url); const route = url.pathname;
  try {
    if (route === "/api/health") return json({ ok: true, version: "1.0.3-sites" });
    if (route === "/api/account/register" && request.method === "POST") {
      const body = await request.json(); const email = text(body.email).toLowerCase(); const password = text(body.password);
      if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return json({ error: "请输入有效邮箱和至少 8 位密码" }, 400);
      const exists = await env.DB.prepare("SELECT id FROM accounts WHERE email=?").bind(email).first(); if (exists) return json({ error: "该账号已存在" }, 409);
      const id = crypto.randomUUID(); const stored = await passwordHash(password); await env.DB.batch([env.DB.prepare("INSERT INTO accounts(id,email,password_hash,credits,created_at) VALUES(?,?,?,?,?)").bind(id, email, stored, 100, now()), env.DB.prepare("INSERT INTO ledger(id,account_id,type,amount,balance,description,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), id, "grant", 100, 100, "新用户体验积分", now())]);
      const token = crypto.randomUUID(); await env.DB.prepare("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)").bind(await sha256(token), id, new Date(Date.now() + 30 * 86400000).toISOString()).run(); return json({ token, user: { id, email, credits: 100 } });
    }
    if (route === "/api/account/login" && request.method === "POST") { const body = await request.json(); const account = await env.DB.prepare("SELECT * FROM accounts WHERE email=?").bind(text(body.email).toLowerCase()).first(); if (!account || !(await checkPassword(text(body.password), account.password_hash))) return json({ error: "账号或密码不正确" }, 401); const token = crypto.randomUUID(); await env.DB.prepare("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)").bind(await sha256(token), account.id, new Date(Date.now() + 30 * 86400000).toISOString()).run(); return json({ token, user: { id: account.id, email: account.email, credits: account.credits } }); }
    if (route === "/api/account/me" && request.method === "GET") { const user = await requireUser(request, env); return user ? json({ user }) : json({ error: "请先登录" }, 401); }
    if (route === "/api/billing/quote" && request.method === "POST") { const duration = text((await request.json()).duration); const seconds = Number(duration.match(/^\d+/)?.[0] || 0); if (![10, 15, 30, 45, 60].includes(seconds)) return json({ error: "请选择有效的脚本时长" }, 400); return json({ duration, credits: Math.ceil(seconds / 5) * 2 }); }
    if (route === "/api/billing/orders" && request.method === "POST") { const user = await requireUser(request, env); if (!user) return json({ error: "请先登录" }, 401); const body = await request.json(); const pack = packages(text(body.packageId)); const provider = text(body.provider); if (!pack || !["wechat", "alipay_personal", "mock"].includes(provider)) return json({ error: "充值参数无效" }, 400); const id = `RC${Date.now()}${crypto.randomUUID().slice(0, 8)}`; await env.DB.prepare("INSERT INTO orders(id,account_id,provider,package_id,amount_fen,credits,status,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(id, user.id, provider, text(body.packageId), pack[0], pack[1], "pending", now()).run(); const order = { id, userId: user.id, provider, packageId: text(body.packageId), amountFen: pack[0], credits: pack[1], status: "pending" }; return json({ order, payment: provider === "wechat" ? { mode: "wechat_native_pending", action: `/api/billing/orders/${id}/wechat/native` } : provider === "alipay_personal" ? { mode: "manual", message: "个人收款码需人工审核" } : { mode: "mock" } }, 201); }
    const native = route.match(/^\/api\/billing\/orders\/([^/]+)\/wechat\/native$/); if (native && request.method === "POST") { const user = await requireUser(request, env); if (!user) return json({ error: "请先登录" }, 401); const order = await env.DB.prepare("SELECT * FROM orders WHERE id=? AND account_id=?").bind(native[1], user.id).first(); if (!order || order.provider !== "wechat") return json({ error: "充值订单不存在" }, 404); const codeUrl = await wechatNative(env, order); return json({ order, payment: { mode: "wechat_native", codeUrl } }); }
    if (route === "/api/billing/webhook/wechat" && request.method === "POST") { const raw = await request.text(); const body = JSON.parse(raw); if (!env.WECHAT_API_V3_KEY || !body.resource) return json({ code: "FAIL", message: "回调配置不完整" }, 400); if (!(await verifyWechat(request, raw, env))) return json({ code: "FAIL", message: "回调验签失败" }, 401); const result = await decryptWechat(body.resource, env.WECHAT_API_V3_KEY); if (result.trade_state !== "SUCCESS") return json({ code: "SUCCESS", message: "成功" }); const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(result.out_trade_no).first(); if (!order || order.provider !== "wechat" || Number(result.amount?.total) !== Number(order.amount_fen)) return json({ code: "FAIL", message: "订单校验失败" }, 400); if (order.status !== "paid") { await env.DB.batch([env.DB.prepare("UPDATE orders SET status='paid',paid_at=? WHERE id=? AND status='pending'").bind(now(), order.id), env.DB.prepare("UPDATE accounts SET credits=credits+? WHERE id=?").bind(order.credits, order.account_id)]); } return json({ code: "SUCCESS", message: "成功" }); }
    return json({ error: "Not found" }, 404);
  } catch (error) { return json({ error: error?.message || "服务器错误" }, error?.status || 500); }
} };
