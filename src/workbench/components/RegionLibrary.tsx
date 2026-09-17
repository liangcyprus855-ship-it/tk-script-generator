"use client";

import { REGION_OPTIONS } from "../data/tk-options";
import { Collapse } from "./Collapse";

const REGION_CODES: Record<string, string> = {
  "美区 (United States)": "EN",
  "日区 (Japan)": "JP",
  "泰区 (Thailand)": "TH",
  "马来西亚区 (Malaysia)": "MS",
  "印尼区 (Indonesia)": "ID",
};

const REGION_SHORT: Record<string, string> = {
  "美区 (United States)": "美区",
  "日区 (Japan)": "日区",
  "泰区 (Thailand)": "泰区",
  "马来西亚区 (Malaysia)": "马来西亚区",
  "印尼区 (Indonesia)": "印尼区",
};

interface RegionLibraryProps {
  value: string;
  onChange: (region: string) => void;
}

// 折叠面板 · 摘要行常驻显示当前区域 + 特色文案（用户拍板：选中行显示）
// 展开后为横排 5 张小卡（语言码 + 区域名），点击单选沿用 .active 黑描边
export function RegionLibrary({ value, onChange }: RegionLibraryProps) {
  const current = REGION_OPTIONS.find((r) => r.id === value);

  return (
    <Collapse
      title="销售区域"
      beige
      summary={
        current ? (
          <>
            <b>{REGION_SHORT[current.id]}</b>
            {" · "}
            {current.badge}
          </>
        ) : undefined
      }
    >
      <div className="region-row">
        {REGION_OPTIONS.map((r) => (
          <div
            key={r.id}
            className={`region-card${r.id === value ? " active" : ""}`}
            onClick={() => onChange(r.id)}
          >
            <div className="card-icon">{REGION_CODES[r.id]}</div>
            <div className="region-name">{r.name.replace(/ \(.*\)/, "")}</div>
          </div>
        ))}
      </div>
    </Collapse>
  );
}
