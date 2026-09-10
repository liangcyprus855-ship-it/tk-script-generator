import { createDecipheriv, createPrivateKey, createSign, createVerify, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

export type WechatPayConfig = {
  appId: string;
  mchId: string;
  serialNo: string;
  apiV3Key: string;
  privateKeyPath: string;
  notifyUrl: string;
  apiBaseUrl?: string;
};

export function getWechatPayConfig(env: NodeJS.ProcessEnv = process.env): WechatPayConfig {
  return {
    appId: String(env.WECHAT_APP_ID || "").trim(),
    mchId: String(env.WECHAT_MCH_ID || "").trim(),
    serialNo: String(env.WECHAT_SERIAL_NO || "").trim(),
    apiV3Key: String(env.WECHAT_API_V3_KEY || ""),
    privateKeyPath: String(env.WECHAT_PRIVATE_KEY_PATH || "").trim(),
    notifyUrl: String(env.WECHAT_NOTIFY_URL || "").trim(),
    apiBaseUrl: String(env.WECHAT_API_BASE_URL || "https://api.mch.weixin.qq.com").replace(/\/+$/, ""),
  };
}

export function validateWechatPayConfig(config: WechatPayConfig) {
  const missing: string[] = [];
  if (!config.appId) missing.push("WECHAT_APP_ID");
  if (!config.mchId) missing.push("WECHAT_MCH_ID");
  if (!config.serialNo) missing.push("WECHAT_SERIAL_NO");
  if (!config.apiV3Key || Buffer.byteLength(config.apiV3Key, "utf8") !== 32) missing.push("WECHAT_API_V3_KEY(32字节)");
  if (!config.privateKeyPath) missing.push("WECHAT_PRIVATE_KEY_PATH");
  if (!config.notifyUrl || !/^https:\/\//i.test(config.notifyUrl)) missing.push("WECHAT_NOTIFY_URL(HTTPS)");
  if (missing.length) throw Object.assign(new Error(`微信支付配置不完整：${missing.join("、")}`), { status: 503, code: "WECHAT_CONFIG_MISSING" });
  try { readFileSync(config.privateKeyPath); }
  catch { throw Object.assign(new Error("微信商户私钥文件不存在或无法读取，请检查 WECHAT_PRIVATE_KEY_PATH"), { status: 503, code: "WECHAT_PRIVATE_KEY_UNREADABLE" }); }
}

function buildAuthorization(config: WechatPayConfig, method: string, urlPath: string, body: string, timestamp: string, nonce: string) {
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  const signature = signer.sign(createPrivateKey(readFileSync(config.privateKeyPath)), "base64");
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`;
}

export async function createWechatNativeOrder(config: WechatPayConfig, order: { id: string; amountFen: number; packageId: string }) {
  validateWechatPayConfig(config);
  const path = "/v3/pay/transactions/native";
  const body = JSON.stringify({
    appid: config.appId,
    mchid: config.mchId,
    description: `TK脚本生成器-${order.packageId}`,
    out_trade_no: order.id,
    notify_url: config.notifyUrl,
    amount: { total: order.amountFen, currency: "CNY" },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: buildAuthorization(config, "POST", path, body, timestamp, nonce),
    },
    body,
  });
  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok || !payload?.code_url) {
    const detail = String(payload?.message || text || `HTTP ${response.status}`).slice(0, 300);
    throw Object.assign(new Error(`微信统一下单失败：${detail}`), { status: 502, code: "WECHAT_NATIVE_ORDER_FAILED" });
  }
  return { codeUrl: String(payload.code_url), transactionId: payload.prepay_id ? String(payload.prepay_id) : undefined };
}

export function decryptWechatNotification(resource: { ciphertext: string; nonce: string; associated_data: string }, apiV3Key: string) {
  if (Buffer.byteLength(apiV3Key, "utf8") !== 32) throw new Error("微信 APIv3 密钥必须为 32 字节");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(apiV3Key, "utf8"), Buffer.from(resource.nonce, "utf8"));
  decipher.setAAD(Buffer.from(resource.associated_data || "", "utf8"));
  const encrypted = Buffer.from(resource.ciphertext, "base64");
  const tag = encrypted.subarray(encrypted.length - 16);
  const data = encrypted.subarray(0, encrypted.length - 16);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function verifyWechatCallbackSignature(args: { signature: string; timestamp: string; nonce: string; body: string; platformPublicKeyPem: string }) {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${args.timestamp}\n${args.nonce}\n${args.body}\n`);
  verifier.end();
  return verifier.verify(args.platformPublicKeyPem, args.signature, "base64");
}
