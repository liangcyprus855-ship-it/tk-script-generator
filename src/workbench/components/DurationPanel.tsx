"use client";

import { DURATION_OPTIONS } from "../data/tk-options";
import { durationPriceYuan } from "../data/tk-business";
import { Collapse } from "./Collapse";

interface DurationPanelProps {
  value: string;
  onChange: (duration: string) => void;
}

// 折叠面板 · 摘要行显示当前档位与价格
// 展开后为横排 5 档小卡（时长上 / 说明与价格下），选中黑描边 + 价格反白
export function DurationPanel({ value, onChange }: DurationPanelProps) {
  const current = DURATION_OPTIONS.find((o) => o === value);

  return (
    <Collapse
      title="脚本目标时长"
      summary={
        current ? (
          <>
            <b>{current.split(" · ")[0]}</b>
            {" · ¥"}
            {durationPriceYuan(current)}
            {" · "}
            {current.split("(")[1]?.replace(")", "") ?? ""}
          </>
        ) : undefined
      }
    >
      <div className="duration-row">
        {DURATION_OPTIONS.map((opt) => {
          const label = opt.split(" · ")[0];
          const note = opt.split("(")[1]?.replace(")", "") ?? "";
          const selected = opt === value;
          return (
            <div
              key={opt}
              className={`duration-card${selected ? " active" : ""}`}
              onClick={() => onChange(opt)}
            >
              <div className="duration-label">{label}</div>
              <div className="duration-note">{note}</div>
              <div className="env-price">¥{durationPriceYuan(opt)}</div>
            </div>
          );
        })}
      </div>
    </Collapse>
  );
}
