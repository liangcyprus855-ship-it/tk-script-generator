"use client";

import { useState } from "react";

import { Modal } from "./Modal";
import type { GenerationRecord } from "./types";
import { CheckIcon, CopyIcon } from "../shared/icons";

interface HistoryModalProps {
  records: GenerationRecord[];
  onClose: () => void;
}

// 生成历史：记录列表 + 展开详情（方案标题 / Hook / 分镜时间轴 / 画面 / 配音 / CTA）
export function HistoryModal({ records, onClose }: HistoryModalProps) {
  const [expanded, setExpanded] = useState<string | null>(
    records[0]?.id ?? null
  );
  const [copied, setCopied] = useState<string | null>(null);

  async function copyRecord(r: GenerationRecord) {
    if (!r.scripts) return;
    const text = r.scripts
      .map(
        (s) =>
          `【${s.title}】(${s.style})\nHook：${s.hook}\n` +
          s.script
            .map((sc) => `${sc.timestamp}\n  画面：${sc.visual}\n  配音：${sc.audio}`)
            .join("\n") +
          `\nCTA：${s.cta}`
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(r.id);
    window.setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Modal title="生成历史" onClose={onClose} wide>
      {records.length === 0 ? (
        <div className="empty-history">暂无生成记录</div>
      ) : (
        records.map((r) => {
          const open = expanded === r.id;
          return (
            <div className="record-item" key={r.id} onClick={() => setExpanded(open ? null : r.id)}>
              <div className="record-row">
                <span className="record-time">{r.time}</span>
                <span className={`record-status ${r.status === "success" ? "ok" : "fail"}`}>
                  {r.status === "success" ? "生成成功" : "生成失败 · 已退款"}
                </span>
              </div>
              <div className="record-row">
                <span style={{ fontSize: "0.78rem" }}>
                  {r.duration.split(" · ")[0]} · {r.region.split(" ")[0]} ·{" "}
                  {r.product.split(" (")[0]}
                </span>
                <span className={`record-amount${r.status === "failed" ? " refund" : ""}`}>
                  {r.status === "failed" ? `已退回 ¥${r.amountYuan}` : `-¥${r.amountYuan}`}
                </span>
              </div>

              {open && (
                <div className="record-detail" onClick={(e) => e.stopPropagation()}>
                  {r.status === "failed" ? (
                    <div className="refund-note">{r.failReason}</div>
                  ) : (
                    <>
                      {r.scripts?.map((s, i) => (
                        <div className="script-card" key={i}>
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
                        </div>
                      ))}
                      <button
                        className={`copy-btn${copied === r.id ? " copied" : ""}`}
                        onClick={() => copyRecord(r)}
                      >
                        {copied === r.id ? (
                          <>
                            <CheckIcon size={12} /> 已复制
                          </>
                        ) : (
                          <>
                            <CopyIcon /> 一键复制整套脚本
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </Modal>
  );
}
