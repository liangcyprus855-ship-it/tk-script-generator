"use client";

import { useState } from "react";

import { Modal } from "./Modal";
import type { GenerationRecord } from "./types";

interface AccountModalProps {
  account: { email: string; balanceYuan: string } | null;
  records: GenerationRecord[];
  onLogin: (email: string, password: string) => Promise<string | null>;
  onRegister: (email: string, password: string, code: string) => Promise<string | null>;
  onSendCode: (email: string) => Promise<void>;
  onLogout: () => void;
  onOpenRecharge: () => void;
  onOpenHistory: () => void;
  onClose: () => void;
}

// 账户中心：未登录（登录 / 注册 + 验证码）· 已登录（余额 / 最近记录 / 充值入口 / 退出）
export function AccountModal({
  account,
  records,
  onLogin,
  onRegister,
  onSendCode,
  onLogout,
  onOpenRecharge,
  onOpenHistory,
  onClose,
}: AccountModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<"idle" | "sending" | "sent">("idle");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    if (!email) return;
    setCodeState("sending");
    setError("");
    try { await onSendCode(email); setCodeState('sent'); }
    catch (e: any) { setError(e.message); setCodeState('idle'); }
  }

  async function submit() {
    if (processing) return;
    setError("");
    if (mode === "register" && !email) {
      setError("请先填写邮箱");
      return;
    }
    setProcessing(true);
    try {
      const err = await (mode === "login" ? onLogin(email, password) : onRegister(email, password, code));
      if (err) setError(err);
      else onClose();
    } catch (e: any) { setError(e.message); } finally { setProcessing(false); }
  }

  if (account) {
    const recent = records.slice(0, 3);
    return (
      <Modal title="账户中心" onClose={onClose}>
        <div className="balance-card">
          <div>
            <div className="balance-label">当前余额</div>
            <div className="balance-value">¥{account.balanceYuan}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="balance-label">{account.email}</div>
            <div className="auto-refresh-note">余额自动刷新中</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="group-label" style={{ marginBottom: 0 }}>
            最近生成记录
          </span>
          {recent.length === 0 ? (
            <div className="empty-history" style={{ padding: "16px 0" }}>
              暂无生成记录
            </div>
          ) : (
            recent.map((r) => (
              <div className="record-item" key={r.id}>
                <div className="record-row">
                  <span className="record-time">{r.time}</span>
                  <span className={`record-status ${r.status === "success" ? "ok" : "fail"}`}>
                    {r.status === "success" ? "已生成" : "失败已退款"}
                  </span>
                </div>
                <div className="record-row">
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {r.duration.split(" · ")[0]} · {r.product.split(" (")[0]}
                  </span>
                  <span className={`record-amount${r.status === "failed" ? " refund" : ""}`}>
                    {r.status === "failed" ? "已退回" : `-¥${r.amountYuan}`}
                  </span>
                </div>
              </div>
            ))
          )}
          <button className="btn-soft" onClick={onOpenHistory}>
            查看全部生成历史
          </button>
        </div>

        <div className="field">
          <label>充值</label>
          <button className="btn-dark" onClick={onOpenRecharge}>
            微信 / 支付宝充值
          </button>
        </div>

        <button className="btn-soft" onClick={onLogout}>
          退出登录
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="账户中心" onClose={onClose}>
      <div className="tab-switch">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          登录账户
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          注册账户
        </button>
      </div>

      <div className="field">
        <label htmlFor="acc-email">邮箱</label>
        <input
          id="acc-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="acc-pwd">密码</label>
        <input
          id="acc-pwd"
          type="password"
          placeholder="至少 8 位"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {mode === "register" && (
        <div className="field">
          <label htmlFor="acc-code">邮箱验证码</label>
          <div className="code-row">
            <input
              id="acc-code"
              type="text"
              maxLength={6}
              placeholder="6 位验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="btn-soft" disabled={!email || codeState === "sending"} onClick={sendCode}>
              {codeState === "sending"
                ? "发送中…"
                : codeState === "sent"
                  ? "重新发送"
                  : "获取验证码"}
            </button>
          </div>
          <span className="field-note">
            {codeState === "sent" ? "验证码已发送，有效期 10 分钟" : "验证码 10 分钟内有效"}
          </span>
        </div>
      )}

      {error && <span className="error-text">{error}</span>}

      <button className="btn-dark" disabled={processing} onClick={submit}>
        {mode === "login"
          ? processing
            ? "处理中…"
            : "登录"
          : processing
            ? "处理中…"
            : "注册并领取 ¥0.50 余额"}
      </button>
    </Modal>
  );
}
