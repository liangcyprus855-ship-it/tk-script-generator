"use client";

import { ReactNode } from "react";

import { CloseIcon } from "../shared/icons";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

// 弹窗壳：沿用 dashboard 的设计语言（白面板 / 24px 圆角 / 面板阴影 / 毛玻璃遮罩）
export function Modal({ title, onClose, children, wide }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-panel${wide ? " wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="icon-btn" onClick={onClose} title="关闭">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
