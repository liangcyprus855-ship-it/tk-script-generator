"use client";

import { useRef, useState } from "react";

import {
  AUDIENCE_BY_REGION,
  FEATURES_BY_REGION,
  PRODUCT_CATEGORIES,
} from "../data/tk-options";
import type { ProductVisualFacts, UploadedImage } from "./types";
import { Collapse } from "./Collapse";
import { TrashIcon, UploadIcon } from "../shared/icons";

const MAX_MB = 5;
const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

interface ProductFormProps {
  region: string;
  mainCategory: string;
  subCategory: string;
  product: string;
  isCustomProduct: boolean;
  customProduct: string;
  targetAudience: string;
  features: string;
  image: UploadedImage | null;
  facts: ProductVisualFacts | null;
  onChange: (patch: Record<string, string | boolean>) => void;
  onImageChange: (img: UploadedImage | null) => void;
  onFactsChange: (facts: ProductVisualFacts | null) => void;
}

// 交互模型：表单（沿用原 .field input/select 设计语言）
// 产品三级分类 + 受众/卖点（随区域联动）+ 产品参考图上传（PNG/JPG/WEBP ≤5MB）
export function ProductForm({
  region,
  mainCategory,
  subCategory,
  product,
  isCustomProduct,
  customProduct,
  targetAudience,
  features,
  image,
  facts,
  onChange,
  onImageChange,
  onFactsChange,
}: ProductFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);
  const [imageError, setImageError] = useState("");

  const subCategories = Object.keys(PRODUCT_CATEGORIES[mainCategory] || {});
  const products = (PRODUCT_CATEGORIES[mainCategory] || {})[subCategory] || [];
  const audiences = AUDIENCE_BY_REGION[region] || [];
  const featureOptions = FEATURES_BY_REGION[region] || [];

  function readFile(file: File) {
    setImageError("");
    if (!ACCEPT.includes(file.type)) {
      setImageError("仅支持 PNG、JPG、WEBP 格式");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setImageError(`图片不能超过 ${MAX_MB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onImageChange({
        name: file.name,
        dataUrl: String(reader.result),
        sizeKb: Math.round(file.size / 1024),
      });
      onFactsChange(null);
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    onImageChange(null);
    onFactsChange(null);
    setImageError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const productName = (isCustomProduct ? customProduct : product).split(" (")[0];

  return (
    <Collapse
      title="产品信息与策略"
      summary={
        <>
          <b>{productName || "未选择产品"}</b>
          {" · "}
          {targetAudience.split(" (")[0]}
          {image ? " · 已上传参考图" : ""}
        </>
      }
    >
      <div className="input-group">
        {/* 产品参考图（可选） */}
        <div className="field">
          <label>产品参考图（可选）</label>
          {image ? (
            <div className="upload-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.dataUrl} alt={image.name} />
              <div className="preview-info">
                <div className="preview-name">{image.name}</div>
                <div>{image.sizeKb} KB · {facts ? "识别完成" : "生成时由服务器识别"}</div>
              </div>
              <button className="icon-btn" onClick={clearImage} title="删除图片并清除识别结果">
                <TrashIcon />
              </button>
            </div>
          ) : (
            <div
              className={`upload-zone${dragover ? " dragover" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragover(true);
              }}
              onDragLeave={() => setDragover(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragover(false);
                const f = e.dataTransfer.files?.[0];
                if (f) readFile(f);
              }}
            >
              <UploadIcon />
              <div className="upload-hint">点击或拖拽上传产品图</div>
              <div className="upload-sub">PNG / JPG / WEBP · 最大 5MB</div>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT.join(",")}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFile(f);
            }}
          />
          {imageError && <span className="error-text">{imageError}</span>}

          {facts && (
            <div className="facts-box">
              <div className="facts-title">
                <span className="dot-green" />
                图片视觉事实已锁定
              </div>
              <div style={{ marginBottom: 6 }}>这些事实会作为脚本生成依据：</div>
              <div className="facts-line"><b>产品类型：</b>{facts.productType}</div>
              <div className="facts-line"><b>包装：</b>{facts.packageType}</div>
              <div className="facts-line"><b>主体颜色：</b>{facts.primaryColor}（辅色 {facts.secondaryColors.join("、")}）</div>
              <div className="facts-line"><b>材质：</b>{facts.material}</div>
              <div className="facts-line"><b>可见文字：</b>{facts.visibleText.join("；")}</div>
              <div className="facts-line"><b>外观特征：</b>{facts.visibleFeatures.join("；")}</div>
              <div className="facts-line"><b>使用线索：</b>{facts.usageClues.join("；")}</div>
              <div className="facts-line"><b>无法确认：</b>{facts.uncertain.join("；")}</div>
            </div>
          )}
        </div>

        {/* 产品分类：三级 */}
        <div className="field">
          <label htmlFor="main-category">产品大类</label>
          <select
            id="main-category"
            value={mainCategory}
            onChange={(e) => {
              const nextMain = e.target.value;
              const nextSub = Object.keys(PRODUCT_CATEGORIES[nextMain])[0];
              onChange({
                mainCategory: nextMain,
                subCategory: nextSub,
                product: PRODUCT_CATEGORIES[nextMain][nextSub][0],
                isCustomProduct: false,
              });
            }}
          >
            {Object.keys(PRODUCT_CATEGORIES).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="sub-category">产品小类</label>
          <select
            id="sub-category"
            value={subCategory}
            onChange={(e) => {
              const nextSub = e.target.value;
              onChange({
                subCategory: nextSub,
                product: PRODUCT_CATEGORIES[mainCategory][nextSub][0],
                isCustomProduct: false,
              });
            }}
          >
            {subCategories.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="product">具体产品</label>
          {isCustomProduct ? (
            <input
              id="product"
              type="text"
              autoFocus
              placeholder="请输入你的产品名称"
              value={customProduct}
              onChange={(e) => onChange({ customProduct: e.target.value })}
            />
          ) : (
            <select
              id="product"
              value={product}
              onChange={(e) => onChange({ product: e.target.value })}
            >
              {products.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          {isCustomProduct ? (
            <span
              className="field-note"
              style={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={() => onChange({ isCustomProduct: false })}
            >
              返回预设产品列表
            </span>
          ) : (
            <span
              className="field-note"
              style={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={() => onChange({ isCustomProduct: true, customProduct: "" })}
            >
              找不到？点此自定义输入
            </span>
          )}
        </div>

        {/* 受众与卖点：随区域动态变化 */}
        <div className="field">
          <label htmlFor="audience">目标受众</label>
          <select
            id="audience"
            value={targetAudience}
            onChange={(e) => onChange({ targetAudience: e.target.value })}
          >
            {audiences.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="features">核心卖点 / 优惠 / 痛点策略</label>
          <select
            id="features"
            value={features}
            onChange={(e) => onChange({ features: e.target.value })}
          >
            {featureOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Collapse>
  );
}
