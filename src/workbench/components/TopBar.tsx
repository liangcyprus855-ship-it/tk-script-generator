"use client";

import {
  ChevronDownIcon,
  GearIcon,
  HistoryIcon,
  UserIcon,
} from "../shared/icons";

export type UpdateState =
  | "idle"
  | "available"
  | "checking"
  | "downloading"
  | "downloaded"
  | "failed";

interface TopBarProps {
  version: string;
  latestVersion: string;
  updateState: UpdateState;
  onUpdate: () => void;
  account: { email: string; balanceYuan: string } | null;
  onOpenAccount: () => void;
  onOpenHistory: () => void;
}

// 顶栏：品牌 + 版本号/OTA 更新 + 生成历史 + 账户（余额）
export function TopBar({
  version,
  latestVersion,
  updateState,
  onUpdate,
  account,
  onOpenAccount,
  onOpenHistory,
}: TopBarProps) {
  const updateLabel: Record<UpdateState, string> = {
    idle: "",
    available: `发现新版本 ${latestVersion} · 立即更新`,
    checking: "正在检查更新",
    downloading: "下载中",
    downloaded: "正在安装，应用即将重启",
    failed: "更新操作失败，可重试",
  };

  return (
    <header className="top-bar">
      <div className="brand-time">
        <div className="version-display">{version}</div>
        <div className="logo">
          <div className="logo-icon" />
          TK跨境带货视频
        </div>
      </div>

      <div className="top-controls">
        {updateState !== "idle" && (
          <div
            className={`pill-tag ota${updateState === "checking" ? " checking" : ""}`}
            onClick={updateState === "checking" ? undefined : onUpdate}
          >
            {updateLabel[updateState]}
          </div>
        )}

        <button className="pill-tag" onClick={onOpenHistory}>
          <HistoryIcon />
          生成历史
        </button>

        <button className="pill-tag" onClick={onOpenAccount}>
          <UserIcon />
          {account ? `${account.email} · ¥${account.balanceYuan}` : "登录 / 注册"}
          <ChevronDownIcon />
        </button>

        <button className="circle-btn" aria-label="账户设置" onClick={onOpenAccount}>
          <GearIcon />
        </button>
      </div>
    </header>
  );
}
