"use client";

import { useEffect, useState } from "react";

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

  const [active, setActive] = useState(0);
  useEffect(() => { setActive(0); setCopiedIndex(null); }, [scripts]);
  const selected = scripts[active] || scripts[0];

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

      {status === "success" && selected && (
        <>
          <div className="script-tabs" role="tablist" aria-label="选择脚本">
            {scripts.map((_, i) => <button key={i} id={'script-tab-'+i} role="tab" aria-selected={active===i} aria-controls="script-reading" tabIndex={active===i?0:-1} onClick={()=>setActive(i)} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=(active+(e.key==='ArrowRight'?1:-1)+scripts.length)%scripts.length;setActive(next);document.getElementById('script-tab-'+next)?.focus();}}}>脚本 {String(i+1).padStart(2,'0')}</button>)}
          </div>
          <article key={active} id="script-reading" className="script-reading" role="tabpanel" aria-labelledby={'script-tab-'+active} tabIndex={0}>
            <div className="reader-meta"><span>{selected.style}</span><span>{duration.split(' · ')[0]} · 本次生成费用 ¥{amountYuan}</span></div>
            <h2 className="reader-title">{selected.title}</h2>
            <div className="reader-hook"><span>HOOK · 黄金前三秒</span><p>{selected.hook}</p></div>
            <ol className="reader-timeline">
              {selected.script.map((scene,i)=><li key={i}>
                <span className="reader-time">{scene.timestamp}</span>
                <div className="reader-scene"><div className="reader-label">镜头 {String(i+1).padStart(2,'0')}</div><p>{scene.visual}</p><div className="reader-audio"><span>旁白 / 文案</span><p>{scene.audio}</p></div></div>
              </li>)}
            </ol>
            <div className="reader-cta"><span>CTA · 行动引导</span><p>{selected.cta}</p></div>
            <button className="copy-btn" onClick={()=>copyOne(selected,active)}>{copiedIndex===active?<><CheckIcon size={12}/> 已复制</>:<><CopyIcon/> 复制当前脚本</>}</button>
          </article>
        </>
      )}
    </div>
  );
}
