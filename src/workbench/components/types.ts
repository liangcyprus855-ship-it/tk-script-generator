// 页面级类型（与参考实现 src/types.ts 保持字段一致）

export interface ProductVisualFacts {
  productType: string;
  packageType: string;
  primaryColor: string;
  secondaryColors: string[];
  material: string;
  visibleText: string[];
  visibleFeatures: string[];
  usageClues: string[];
  uncertain: string[];
}

export interface ScriptScene {
  timestamp: string;
  visual: string;
  audio: string;
}

export interface ScriptOption {
  title: string;
  style: string;
  hook: string;
  script: ScriptScene[];
  cta: string;
}

export type GenerationStatus = "idle" | "generating" | "failed" | "success";

export interface GenerationRecord {
  id: string;
  time: string;
  duration: string;
  amountYuan: string;
  status: "success" | "failed";
  region: string;
  product: string;
  scripts?: ScriptOption[];
  failReason?: string;
}

export interface UploadedImage {
  name: string;
  dataUrl: string;
  sizeKb: number;
}
