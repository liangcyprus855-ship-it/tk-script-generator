import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export type LedgerEntry = {
  id: string;
  type: "grant" | "consume" | "refund" | "recharge";
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
  reference?: string;
};

type Account = { id: string; email: string; passwordHash: string; credits: number; createdAt: string };
type StoreData = { accounts: Account[]; tokens: Record<string, string>; ledger: Record<string, LedgerEntry[]> };

const EMPTY: StoreData = { accounts: [], tokens: {}, ledger: {} };

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function verifyPassword(password: string, encoded: string) {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 32);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

export class AccountStore {
  private data: StoreData;
  private readonly file: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, "commercial-accounts.json");
    this.data = existsSync(this.file) ? JSON.parse(readFileSync(this.file, "utf8")) : { ...EMPTY };
  }

  private persist() {
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify(this.data, null, 2), "utf8");
    renameSync(temp, this.file);
  }

  register(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) throw Object.assign(new Error("请输入有效的邮箱地址"), { status: 400 });
    if (password.length < 8) throw Object.assign(new Error("密码至少需要 8 位"), { status: 400 });
    if (this.data.accounts.some((account) => account.email === normalized)) throw Object.assign(new Error("该账号已存在"), { status: 409 });
    const account: Account = { id: randomUUID(), email: normalized, passwordHash: hashPassword(password), credits: 100, createdAt: new Date().toISOString() };
    this.data.accounts.push(account);
    this.data.ledger[account.id] = [{ id: randomUUID(), type: "grant", amount: 100, balance: 100, description: "新用户体验积分", createdAt: new Date().toISOString() }];
    this.persist();
    return this.issue(account);
  }

  login(email: string, password: string) {
    const account = this.data.accounts.find((item) => item.email === email.trim().toLowerCase());
    if (!account || !verifyPassword(password, account.passwordHash)) throw Object.assign(new Error("账号或密码不正确"), { status: 401 });
    return this.issue(account);
  }

  private issue(account: Account) {
    const token = randomBytes(32).toString("base64url");
    this.data.tokens[createHash("sha256").update(token).digest("hex")] = account.id;
    this.persist();
    return { token, user: { id: account.id, email: account.email, credits: account.credits } };
  }

  authenticate(token: string | undefined) {
    if (!token) return null;
    const id = this.data.tokens[createHash("sha256").update(token).digest("hex")];
    const account = this.data.accounts.find((item) => item.id === id);
    return account ? { id: account.id, email: account.email, credits: account.credits } : null;
  }

  ledger(userId: string) { return this.data.ledger[userId] || []; }

  quote(duration: string) {
    const seconds = duration.startsWith("20-30") ? 30 : Number(duration.match(/^(\d+)/)?.[1] || 0);
    if (![10, 15, 30, 45, 60].includes(seconds)) throw Object.assign(new Error("请选择有效的脚本时长"), { status: 400 });
    return { duration, credits: Math.ceil(seconds / 5) * 2 };
  }

  consume(userId: string, amount: number, description: string, reference: string) {
    const account = this.data.accounts.find((item) => item.id === userId);
    if (!account) throw Object.assign(new Error("账号不存在"), { status: 401 });
    if (account.credits < amount) throw Object.assign(new Error("积分余额不足，请先充值"), { status: 402 });
    account.credits -= amount;
    this.data.ledger[userId] ??= [];
    this.data.ledger[userId].push({ id: randomUUID(), type: "consume", amount: -amount, balance: account.credits, description, reference, createdAt: new Date().toISOString() });
    this.persist();
    return account.credits;
  }

  refund(userId: string, amount: number, description: string, reference: string) {
    const account = this.data.accounts.find((item) => item.id === userId);
    if (!account) return;
    account.credits += amount;
    this.data.ledger[userId] ??= [];
    this.data.ledger[userId].push({ id: randomUUID(), type: "refund", amount, balance: account.credits, description, reference, createdAt: new Date().toISOString() });
    this.persist();
  }
}
