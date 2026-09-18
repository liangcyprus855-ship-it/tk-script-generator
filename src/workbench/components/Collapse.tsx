"use client";

import { ReactNode, useState } from "react";

import { ChevronDownIcon } from "../shared/icons";

interface CollapseProps {
  title: string;
  /** 折叠头上常驻显示的「当前已选」摘要，信息在折叠态不丢失 */
  summary?: ReactNode;
  /** 米色底变体（沿用原设计 template-library 的 --panel-soft 视觉锚点） */
  beige?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

// 折叠面板壳：沿用原设计语言（panel 外框 / section-title 排版 / 0.2s 原版缓动）
// 展开动画用 grid-template-rows 0fr→1fr，高度自适应内容
export function Collapse({ title, summary, beige, defaultOpen = false, children }: CollapseProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`collapse-panel${open ? " open" : ""}${beige ? " beige" : ""}`}>
      <button
        type="button"
        className="collapse-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="collapse-title">{title}</span>
        {summary != null && <span className="collapse-summary">{summary}</span>}
        <span className="collapse-edit">{open ? "收起" : "编辑"}</span><span className="collapse-chevron">
          <ChevronDownIcon />
        </span>
      </button>
      <div className="collapse-body">
        <div className="collapse-body-inner">{children}</div>
      </div>
    </div>
  );
}
