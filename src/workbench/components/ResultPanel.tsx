"use client";

import { useState } from "react";

import type { GenerationStatus, ScriptOption } from "./types";
import {
  CheckIcon,
  CopyIcon,
  RefreshIcon,
  SparkIcon,
} from "../shared/icons";

interface ResultPanelProps {
  status: GenerationStatus;
  scripts: ScriptOption[];
  elapsed: number;
  failReason: string;
  offline: boolean;
  duration: string;
  amountYuan: string;
  onRetry: () => void;
  refunded?: boolean;
}

function scriptToText(s: ScriptOption, duration: string, amountYuan: string): string {
  const lines = [
    `【方案标题】${s.title}`,
    `【创作者风格】${s.style}`,
    `【黄金前三秒 Hook】${s.hook}`,
    "",
    "【分镜时间轴】",
    ...s.script.map(
      (sc) => `${sc.timestamp}\n  画面：${sc.visual}\n  配音：${sc.audio}`
    ),
    "",
    `【最终 CTA】${s.cta}`,
    "",
    `【生成时长】${duration.split(" · ")[0]}`,
    `【消耗金额】¥${amountYuan}`,
  ];
  return lines.join("\n");
}

// 右侧生成结果区：空 / 生成中 / 失败 / 成功 四态
export function ResultPanel({
  status,
  scripts,
  elapsed,
  failReason,
  offline,
  duration,
  amountYuan,
  onRetry,
  refunded = false,
}: ResultPanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function copyOne(s: ScriptOption, i: number) {
    const text = scriptToText(s, duration, amountYuan);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedIndex(i);
    window.setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="result-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="group-label" style={{ marginBottom: 0 }}>
          生成结果
        </span>
        {offline && status === "generating" && (
          <span className="error-text">连接暂时中断，正在恢复</span>
        )}
        {status === "success" && (
          <span className="ok-text">3 套脚本已生成</span>
        )}
      </div>

      {status === "idle" && (
        <div className="result-empty">
          <div className="empty-icon">
            <SparkIcon size={24} />
          </div>
          <div className="empty-title">等待智能生成</div>
          <div className="empty-sub">
            请在左侧填写产品信息。服务器将根据销售区域、受众与产品信息生成 3 套脚本。
          </div>
        </div>
      )}

      {status === "generating" && (
        <div className="result-generating">
          <div className="spinner" />
          <div className="gen-title">正在生成</div>
          <div className="gen-timer">已等待 {elapsed} 秒</div>
          <div className="gen-sub">
            正在生成 3 套脚本，请勿重复提交。
            <br />
            生成结果会自动保存，网络中断后会自动恢复查询。
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="result-failed">
          <div className="failed-badge">生成失败</div>
          <div className="failed-title">本次生成未成功</div>
          <div className="failed-reason">{failReason}</div>
          <div className="refund-note">
            {refunded ? '费用已退回账户 · ' : ''}你填写的参数仍然保留
          </div>
          <button className="btn-soft" onClick={onRetry}>
            <RefreshIcon /> 重新生成
          </button>
        </div>
      )}

      {status === "success" && (
        <div className="script-cards">
          {scripts.map((s, i) => (
            <div key={s.title + i} className="script-card">
              <div className="card-meta">
                <div className="card-icon">0{i + 1}</div>
                <div className="style-pill">{s.style}</div>
              </div>
              <div className="card-name">{s.title}</div>

              <div className="hook-line">
                <span className="hook-tag">黄金前三秒 HOOK</span>
                {s.hook}
              </div>

              <div className="scene-list">
                {s.script.map((sc) => (
                  <div className="scene-item" key={sc.timestamp}>
                    <div className="scene-time">{sc.timestamp.split(" ")[0]}</div>
                    <div>
                      <div className="scene-visual">{sc.visual}</div>
                      <span className="scene-audio">配音：{sc.audio}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cta-line">
                <span className="cta-tag">CTA</span>
                {s.cta}
              </div>

              <button
                className={`copy-btn${copiedIndex === i ? " copied" : ""}`}
                onClick={() => copyOne(s, i)}
              >
                {copiedIndex === i ? (
                  <>
                    <CheckIcon size={12} /> 已复制
                  </>
                ) : (
                  <>
                    <CopyIcon /> 一键复制脚本
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
