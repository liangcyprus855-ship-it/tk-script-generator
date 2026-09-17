"use client";

import { Modal } from "./Modal";
import type { UpdateState } from "./TopBar";
import { CheckIcon, RefreshIcon } from "../shared/icons";

interface UpdateModalProps {
  version: string;
  latestVersion: string;
  updateLog: string;
  state: UpdateState;
  onUpdate: () => void;
  onClose: () => void;
}

// OTA 更新提示：发现新版本 / 更新版本号 / 更新日志 / 立即更新（含全部按钮状态）
export function UpdateModal({
  version,
  latestVersion,
  updateLog,
  state,
  onUpdate,
  onClose,
}: UpdateModalProps) {
  const labels: Record<UpdateState, string> = {
    idle: "已是最新版本",
    available: "立即更新",
    checking: "正在检查更新",
    downloading: "下载中",
    downloaded: "安装更新并重启",
    failed: "更新操作失败，可重试",
  };

  return (
    <Modal title="发现新版本" onClose={onClose}>
      <div className="balance-card">
        <div>
          <div className="balance-label">当前版本</div>
          <div className="balance-value" style={{ fontSize: "1.15rem" }}>
            {version}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="balance-label">更新版本</div>
          <div className="balance-value" style={{ fontSize: "1.15rem", color: "#34a853" }}>
            {latestVersion}
          </div>
        </div>
      </div>

      <div className="field">
        <label>更新日志</label>
        <div className="facts-box">{updateLog}</div>
      </div>

      {state === "failed" && <span className="error-text">更新操作失败，可重试</span>}

      <button
        className="btn-dark"
        disabled={state === "checking" || state === "downloading" || state === "idle"}
        onClick={onUpdate}
      >
        {state === "failed" && <RefreshIcon />} {labels[state]}
      </button>

      {state === "idle" && (
        <div className="ok-text" style={{ textAlign: "center" }}>
          <CheckIcon size={12} /> 更新完成，当前已是最新版本
        </div>
      )}
    </Modal>
  );
}
