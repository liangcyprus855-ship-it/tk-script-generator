"use client";

import type { GenerationStatus } from "./types";

interface GenerateFooterProps {
  amountYuan: string;
  balanceYuan: string;
  loggedIn: boolean;
  status: GenerationStatus;
  elapsed: number;
  queuePosition?: number;
  onGenerate: () => void;
  onOpenRecharge: () => void;
}

// 原 ActionFooter（Estimated Load + begin generation. + 说明）→ 商业版生成入口
// 余额不足 / 未登录 / 生成中 三种禁用态；防重复提交
export function GenerateFooter({
  amountYuan,
  balanceYuan,
  loggedIn,
  status,
  elapsed,
  queuePosition = 0,
  onGenerate,
  onOpenRecharge,
}: GenerateFooterProps) {
  const balance = Number(balanceYuan);
  const amount = Number(amountYuan);
  const insufficient = loggedIn && balance < amount;
  const generating = status === "generating";

  const buttonLabel = !loggedIn
    ? "请先登录账户"
    : generating
      ? queuePosition > 0
        ? `排队中… 前面 ${Math.max(0, queuePosition - 1)} 个任务`
        : `服务器正在生成… ${elapsed}s`
      : insufficient
        ? "余额不足，请先充值"
        : "智能生成 3 款剧本";

  const disabled = !loggedIn || insufficient || generating;

  return (
    <div className="action-footer">
      <div className="load-row">
        <span className="load-label">
          本次消耗 ¥{amountYuan} · 余额{" "}
          <span className={insufficient ? "load-value insufficient" : ""}>
            ¥{balanceYuan}
          </span>
        </span>
        {insufficient ? (
          <span className="load-value insufficient">余额不足</span>
        ) : loggedIn ? (
          <span className="load-value">余额充足</span>
        ) : (
          <span className="load-value">未登录</span>
        )}
      </div>

      <button className="btn-start" onClick={onGenerate} disabled={disabled}>
        {!generating && <div className="play-icon" />}
        {buttonLabel}
      </button>

      {insufficient ? (
        <button className="btn-soft" onClick={onOpenRecharge}>
          去充值
        </button>
      ) : (
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--text-light)",
            textAlign: "center",
          }}
        >
          {generating
            ? queuePosition > 0
              ? "已进入服务器队列 · 按提交时间依次处理 · 请勿重复提交"
              : "生成结果会自动保存 · 网络中断后自动恢复查询 · 请勿重复提交"
            : "失败自动退款 · 参数保留 · 结果自动保存"}
        </p>
      )}
    </div>
  );
}
