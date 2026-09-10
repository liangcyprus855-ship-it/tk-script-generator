import "dotenv/config";
import express from "express";
import path from "path";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { GoogleGenAI, Type } from "@google/genai";
import { ModelConfig, ScriptRequest, OllamaModelInfo, CloudModelInfo, ProductVisualFacts } from "./src/types";
import { getCloudProviderPreset } from "./src/cloudProviders";
import { AccountStore } from "./commercial/accountStore";

import { durationPlan, durationInstruction, generateTimed } from "./duration";

interface RegionConfig {
  name: string;
  languageName: string;
  culturalProfile: string;
  voiceoverInstruction: string;
}

const REGION_CONFIGS: Record<string, RegionConfig> = {
  "美区 (United States)": {
    name: "美国 (United States)",
    languageName: "美式英语 (English)",
    culturalProfile: `
- 核心文化与网感：追求真实、快节奏、直接直观、注重个性与即时满足感。TikTok热梗如 "TikTok made me buy it", "Run don't walk", "Obsessed with this", "Game changer", "Dupe", "Literally so good"。
- 生活/消费习惯：独居、通勤自驾、周末户外聚会、极看重无理由退款(30-day money-back guarantee)与快速本土物流(US local fast shipping)。
- 视频风格：强视觉冲击的痛点反差、快节奏快剪(1-2秒一切换)、真实生活感(UGC/POV)。`,
    voiceoverInstruction: "配音台词必须使用地道【美式英语 (English)】，并在台词后括号内附上【中文对照翻译】。"
  },
  "日区 (Japan)": {
    name: "日本 (Japan)", languageName: "日语 (日本語 / Japanese)",
    culturalProfile: `- 注重礼貌、隐私、品质、细节、真实口碑与省时高效。视频偏手部特写、POV、干净生活感。`,
    voiceoverInstruction: "配音台词必须使用地道【日语 (日本語 / Japanese)】，并在台词后括号内附上【中文对照翻译】。"
  },
  "泰区 (Thailand)": {
    name: "泰国 (Thailand)", languageName: "泰语 (ภาษาไทย / Thai)",
    culturalProfile: `- 热爱幽默、反转、高能量表达；重视防水防汗、全泰包邮与COD。`,
    voiceoverInstruction: "配音台词必须使用地道【泰语 (ภาษาไทย / Thai)】，并在台词后括号内附上【中文对照翻译】。"
  },
  "马来西亚区 (Malaysia)": {
    name: "马来西亚 (Malaysia)", languageName: "马来语/当地日常英语 (Bahasa Melayu & Manglish)",
    culturalProfile: `- 多元文化、真实开箱、亲和分享、强调性价比、包邮与COD。`,
    voiceoverInstruction: "配音台词使用地道【马来语或 Manglish】，并在台词后括号内附上【中文对照翻译】。"
  },
  "印尼区 (Indonesia)": {
    name: "印尼 (Indonesia)", languageName: "印尼语 (Bahasa Indonesia)",
    culturalProfile: `- 年轻、跟风、强种草文化；强调高性价比、Gratis Ongkir 与 COD。`,
    voiceoverInstruction: "配音台词必须使用地道【印尼语 (Bahasa Indonesia)】，并在台词后括号内附上【中文对照翻译】。"
  }
};

function getRegionConfig(regionStr: string): RegionConfig {
  for (const key of Object.keys(REGION_CONFIGS)) {
    if (regionStr?.includes(key) || key.includes(regionStr || "")) return REGION_CONFIGS[key];
  }
  return REGION_CONFIGS["美区 (United States)"];
}

function normalizeBaseUrl(url: string, fallback: string) {
  return (url || fallback).trim().replace(/\/+$/, "");
}

function extractImage(image?: string) {
  if (!image) return null;
  const match = image.match(/^data:(image\/[^;]+);base64,(.+)$/);
  return match ? { mimeType: match[1], data: match[2] } : null;
}

const PRODUCT_VISUAL_FACTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    productType: { type: "string" },
    packageType: { type: "string" },
    primaryColor: { type: "string" },
    secondaryColors: { type: "array", items: { type: "string" } },
    material: { type: "string" },
    visibleText: { type: "array", items: { type: "string" } },
    visibleFeatures: { type: "array", items: { type: "string" } },
    usageClues: { type: "array", items: { type: "string" } },
    uncertain: { type: "array", items: { type: "string" } },
  },
  required: ["productType", "packageType", "primaryColor", "secondaryColors", "material", "visibleText", "visibleFeatures", "usageClues", "uncertain"]
};

function buildVisualAnalysisPrompt(product: string) {
  return `你现在只做产品图片事实识别，不生成广告，不写脚本。\n用户给产品的文字名称是：【${product || "未填写"}】。文字名称只能帮助理解类别，绝对不能覆盖图片中真实可见的外观。\n\n【最高优先级规则】\n1. 只描述图片中能够直接观察到的事实。\n2. 不允许根据常识、产品类别、品牌经验脑补颜色、材质、包装结构、成分、功效或使用方法。\n3. 图片中看不清、被遮挡、无法确定的属性，写“未确认”或放入 uncertain。\n4. 如果文字名称与图片冲突，以图片视觉事实为准。\n5. primaryColor 必须填写主体包装/瓶身最明显的颜色，例如黑色、白色、透明、橙色；无法确认则写“未确认”。\n6. visibleText 只记录图片上真正看得到的文字，模糊看不清不要猜。\n\n只返回严格 JSON 对象，不要 Markdown，不要解释：\n{\n  "productType": "图片可确认的产品类型；不确定则未确认",\n  "packageType": "瓶/盒/袋/罐/管等；不确定则未确认",\n  "primaryColor": "主体包装最明显颜色",\n  "secondaryColors": ["其它明确可见颜色"],\n  "material": "玻璃/塑料/金属等；不确定则未确认",\n  "visibleText": ["图片上可辨认文字"],\n  "visibleFeatures": ["只写可见外观特征，如橙蓝标签、黑色瓶盖"],\n  "usageClues": ["只写图片直接展示出来的使用线索"],\n  "uncertain": ["无法确认、容易误判的项目"]\n}`;
}

function normalizeStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 20);
}

function parseProductVisualFacts(raw: string): ProductVisualFacts {
  if (!String(raw || "").trim()) throw new Error("图像识别模型没有返回内容");
  let lastError: any = null;
  for (const candidate of buildJsonCandidates(raw)) {
    try {
      const parsed: any = JSON.parse(candidate);
      const obj = parsed?.visualFacts || parsed?.facts || parsed;
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) continue;
      return {
        productType: textValue(obj.productType ?? obj.product_type, "未确认"),
        packageType: textValue(obj.packageType ?? obj.package_type, "未确认"),
        primaryColor: textValue(obj.primaryColor ?? obj.primary_color ?? obj.color, "未确认"),
        secondaryColors: normalizeStringArray(obj.secondaryColors ?? obj.secondary_colors ?? obj.colors),
        material: textValue(obj.material, "未确认"),
        visibleText: normalizeStringArray(obj.visibleText ?? obj.visible_text ?? obj.text),
        visibleFeatures: normalizeStringArray(obj.visibleFeatures ?? obj.visible_features ?? obj.features),
        usageClues: normalizeStringArray(obj.usageClues ?? obj.usage_clues ?? obj.usage),
        uncertain: normalizeStringArray(obj.uncertain ?? obj.unknown ?? obj.uncertainties),
      };
    } catch (error) { lastError = error; }
  }
  throw new Error(`产品图片识别结果不是合法 JSON${lastError ? `：${String(lastError.message || lastError).slice(0, 160)}` : ""}`);
}

function extractVisualFactsFromObservation(observation: string, product: string): ProductVisualFacts {
  const raw = String(observation || "").trim();
  if (!raw) throw new Error("图像识别模型没有返回可用视觉观察");
  const normalized = raw.replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  const colorMap: Array<[RegExp, string]> = [
    [/(黑色|黑瓶|black)/i, "黑色"],
    [/(白色|white)/i, "白色"],
    [/(橙色|orange)/i, "橙色"],
    [/(蓝色|blue)/i, "蓝色"],
    [/(红色|red)/i, "红色"],
    [/(绿色|green)/i, "绿色"],
    [/(黄色|yellow)/i, "黄色"],
    [/(紫色|purple)/i, "紫色"],
    [/(粉色|pink)/i, "粉色"],
    [/(灰色|gray|grey)/i, "灰色"],
    [/(棕色|brown)/i, "棕色"],
    [/(透明|transparent|clear bottle)/i, "透明"],
    [/(银色|silver)/i, "银色"],
    [/(金色|gold|golden)/i, "金色"],
  ];

  const detectedColors: string[] = [];
  for (const [re, zh] of colorMap) {
    if (re.test(normalized) && !detectedColors.includes(zh)) detectedColors.push(zh);
  }

  // Prefer a color explicitly mentioned near bottle/package/body wording.
  let primaryColor = "未确认";
  const sentences = normalized.split(/[。！？!?;；\n]+/).map((s) => s.trim()).filter(Boolean);
  const packageSentences = sentences.filter((s) => /(瓶身|瓶子|瓶|包装|主体|bottle|package|container|body)/i.test(s));
  for (const sentence of packageSentences) {
    for (const [re, zh] of colorMap) {
      if (re.test(sentence)) { primaryColor = zh; break; }
    }
    if (primaryColor !== "未确认") break;
  }
  if (primaryColor === "未确认" && detectedColors.length) primaryColor = detectedColors[0];

  let packageType = "未确认";
  if (/(瓶|bottle)/i.test(normalized)) packageType = "瓶";
  else if (/(罐|jar|canister)/i.test(normalized)) packageType = "罐";
  else if (/(盒|box|carton)/i.test(normalized)) packageType = "盒";
  else if (/(袋|pouch|bag)/i.test(normalized)) packageType = "袋";
  else if (/(管|tube)/i.test(normalized)) packageType = "管";

  let material = "未确认";
  if (/(玻璃|glass)/i.test(normalized)) material = "玻璃";
  else if (/(塑料|plastic)/i.test(normalized)) material = "塑料";
  else if (/(金属|metal|aluminum|aluminium)/i.test(normalized)) material = "金属";

  // Extract short quoted or uppercase label fragments when present.
  const visibleText: string[] = [];
  const quoted = [...normalized.matchAll(/[“"']([^“”"']{2,60})[”"']/g)].map((m) => m[1].trim());
  for (const q of quoted) if (q && !visibleText.includes(q)) visibleText.push(q);
  const uppercase = normalized.match(/\b[A-Z][A-Z0-9+&-]{2,}(?:\s+[A-Z0-9+&-]{2,}){0,4}\b/g) || [];
  for (const q of uppercase) if (!visibleText.includes(q)) visibleText.push(q);

  const visibleFeatures = sentences
    .filter((s) => /(瓶|包装|标签|颜色|瓶盖|logo|label|bottle|package|color|cap|text|文字)/i.test(s))
    .slice(0, 8);
  if (!visibleFeatures.length) visibleFeatures.push(normalized.slice(0, 260));

  const uncertain: string[] = [];
  if (material === "未确认") uncertain.push("材质未确认");
  if (primaryColor === "未确认") uncertain.push("主体颜色未确认");
  if (!visibleText.length) uncertain.push("标签文字未可靠提取");

  return {
    productType: product || "未确认",
    packageType,
    primaryColor,
    secondaryColors: detectedColors.filter((c) => c !== primaryColor).slice(0, 8),
    material,
    visibleText: visibleText.slice(0, 12),
    visibleFeatures,
    usageClues: [],
    uncertain,
  };
}

function formatVisualFactsForPrompt(facts?: ProductVisualFacts) {
  if (!facts) return "";
  const line = (label: string, value: string | string[]) => {
    const v = Array.isArray(value) ? (value.length ? value.join("、") : "未确认") : (value || "未确认");
    return `- ${label}：${v}`;
  };
  return [
    "【产品图片视觉事实｜最高优先级硬约束】",
    line("图片确认的产品类型", facts.productType),
    line("包装类型", facts.packageType),
    line("主体/瓶身主色", facts.primaryColor),
    line("其它可见颜色", facts.secondaryColors),
    line("可确认材质", facts.material),
    line("图片可辨认文字", facts.visibleText),
    line("可见外观特征", facts.visibleFeatures),
    line("可见使用线索", facts.usageClues),
    line("未确认项目", facts.uncertain),
    "强制规则：所有脚本镜头中涉及产品颜色、材质、包装、标签、形态的描述都必须与以上事实一致。以上没有确认的信息禁止自行补全；宁可不写，也不能脑补。"
  ].join("\\n");
}

function textValue(value: any, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => textValue(v)).filter(Boolean).join("\n");
  if (typeof value === "object") {
    // Common local-model shapes such as { en, zh } / { english, chinese }.
    const preferred = ["text", "content", "en", "english", "zh", "chinese", "translation"];
    const parts = preferred.map((k) => textValue(value[k])).filter(Boolean);
    if (parts.length) return parts.join("（") + (parts.length > 1 ? "）" : "");
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return fallback;
}

function looksLikeScriptObject(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Boolean(
    value.title || value.style || value.creatorStyle || value.hook || value.hookAnalysis ||
    value.script || value.scenes || value.shots || value.cta || value.CTA || value.callToAction
  );
}

function discoverScriptList(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== "object") return [];

  // Standard wrapper shapes.
  for (const key of ["scripts", "options", "results", "data", "items", "plans", "variants"]) {
    if (Array.isArray(input[key])) return input[key];
    if (looksLikeScriptObject(input[key])) return [input[key]];
  }

  // A local model often returns a single script object even when asked for an array.
  if (looksLikeScriptObject(input)) return [input];

  // Some models return { "方案1": {...}, "方案2": {...} }.
  const objectValues = Object.values(input).filter(looksLikeScriptObject);
  if (objectValues.length) return objectValues;

  // Search one level deeper for a usable array/object wrapper.
  for (const value of Object.values(input)) {
    if (value && typeof value === "object") {
      const nested = discoverScriptList(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

function normalizeScripts(input: any) {
  const list = discoverScriptList(input);
  if (!list.length) throw new Error("模型返回内容缺少可识别的脚本结构");

  const normalized = list.slice(0, 3).map((item: any, index: number) => {
    const rawScenes = Array.isArray(item?.script)
      ? item.script
      : Array.isArray(item?.scenes)
        ? item.scenes
        : Array.isArray(item?.shots)
          ? item.shots
          : Array.isArray(item?.timeline)
            ? item.timeline
            : [];

    const scenes = rawScenes.map((scene: any) => ({
      timestamp: textValue(scene?.timestamp ?? scene?.time ?? scene?.duration ?? scene?.timeRange, ""),
      visual: textValue(scene?.visual ?? scene?.scene ?? scene?.shot ?? scene?.description ?? scene?.visualDescription, "画面描述缺失"),
      audio: textValue(scene?.audio ?? scene?.voiceover ?? scene?.voice ?? scene?.dialogue ?? scene?.audioText, "配音内容缺失"),
    })).filter((scene: any) => scene.visual || scene.audio);

    if (!scenes.length) return null;

    return {
      title: textValue(item?.title ?? item?.name, `方案 ${index + 1}`),
      style: textValue(item?.style ?? item?.creatorStyle ?? item?.format, `创作者风格 ${index + 1}`),
      hook: textValue(item?.hook ?? item?.hookAnalysis ?? item?.goldenHook, "前三秒快速展示核心痛点与产品价值。"),
      script: scenes,
      cta: textValue(item?.cta ?? item?.CTA ?? item?.callToAction ?? item?.call_to_action, "点击 TikTok Shop 查看当前优惠。"),
    };
  }).filter(Boolean);

  if (!normalized.length) throw new Error("模型返回了内容，但没有可显示的有效分镜。请重试或更换模型。");
  return normalized;
}

function stripMarkdownJsonFences(raw: string) {
  return String(raw || "")
    .trim()
    .replace(/^```(?:json|javascript|js)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

// Repairs the most common JSON mistakes produced by LLMs without changing the
// actual script wording: trailing commas, smart quotes, literal newlines inside
// strings, and accidentally unescaped quote characters inside string values.
function repairCommonJsonMistakes(raw: string) {
  let text = stripMarkdownJsonFences(raw)
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    // Missing comma between a completed value and the next known property.
    .replace(/"\s*(?="(?:title|style|hook|script|timestamp|visual|audio|cta)"\s*:)/g, '",')
    .replace(/}\s*(?="(?:title|style|hook|script|timestamp|visual|audio|cta)"\s*:)/g, '},')
    .replace(/]\s*(?="(?:title|style|hook|script|timestamp|visual|audio|cta)"\s*:)/g, '],')
    // Missing comma between adjacent objects in an array.
    .replace(/}\s*(?={)/g, '},');

  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }

    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\t") {
      out += "\\t";
      continue;
    }

    if (ch === '"') {
      // A real closing JSON quote must be followed by JSON punctuation. When
      // the next non-space character is ordinary text, this quote is almost
      // certainly part of the model's prose and should have been escaped.
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const next = text[j] || "";
      if (next && ![",", "}", "]", ":"].includes(next)) {
        out += '\\"';
        continue;
      }
      inString = false;
      out += ch;
      continue;
    }

    out += ch;
  }

  return out.replace(/,\s*([}\]])/g, "$1");
}

function buildJsonCandidates(raw: string) {
  const text = stripMarkdownJsonFences(raw);
  const repaired = repairCommonJsonMistakes(text);
  const candidates: string[] = [];
  const push = (value: string) => {
    const v = String(value || "").trim();
    if (v && !candidates.includes(v)) candidates.push(v);
  };

  push(text);
  push(repaired);

  for (const source of [text, repaired]) {
    const firstArray = source.indexOf("[");
    const lastArray = source.lastIndexOf("]");
    if (firstArray >= 0 && lastArray > firstArray) push(source.slice(firstArray, lastArray + 1));

    const firstObject = source.indexOf("{");
    const lastObject = source.lastIndexOf("}");
    if (firstObject >= 0 && lastObject > firstObject) push(source.slice(firstObject, lastObject + 1));
  }

  return candidates;
}

function tryParseJsonScripts(raw: string) {
  if (!String(raw || "").trim()) return { scripts: null as any, error: new Error("模型没有返回内容") };
  let lastError: any = null;
  for (const candidate of buildJsonCandidates(raw)) {
    try {
      return { scripts: normalizeScripts(JSON.parse(candidate)), error: null };
    } catch (error) {
      lastError = error;
    }
  }
  return { scripts: null as any, error: lastError };
}

function parseJsonScripts(raw: string) {
  const result = tryParseJsonScripts(raw);
  if (result.scripts) return result.scripts;
  const detail = result.error ? String(result.error.message || result.error).slice(0, 180) : "未知 JSON 错误";
  throw new Error(`模型返回的脚本 JSON 格式有误，自动修复仍未成功：${detail}`);
}

function buildPrompt(req: ScriptRequest) {
  const { region = "美区 (United States)", product, targetAudience, features, image, duration, visualFacts } = req;
  const targetRegion = getRegionConfig(region);
  return `你是一个顶级的 TikTok 跨境电商短视频脚本编剧和爆款策略专家。
当前目标销售区域国家：【${targetRegion.name}】
目标视频时长：【${duration}】

产品及用户输入信息：
- 目标国家区域：${region}
- 产品名称/描述：${product}
- 目标受众画像：${targetAudience}
- 核心卖点/营销策略：${features}
${visualFacts ? `- 产品参考图：已完成独立视觉识别。脚本阶段必须服从下面的视觉事实，不再根据产品类别猜测外观。` : image ? "- 产品参考图：用户已上传图片，但尚未提供视觉事实；不得脑补图片细节。" : ""}
${formatVisualFactsForPrompt(visualFacts)}

市场定制要求：
${targetRegion.culturalProfile}

创作规则：
1. 黄金前三秒 Hook 必须立刻制造停留理由。
2. 所有场景分析、镜头、运镜描述必须使用中文。
3. 画面描述中绝对不能出现字幕、标题、屏幕文字、贴纸或弹窗，只写纯画面、人物动作、表情、场景与运镜。
4. 总时长严格控制在【${duration}】左右，每镜头最多5秒，按下方时间轴展开内容。
5. 配音：${targetRegion.voiceoverInstruction}
6. CTA 使用当地语言并附中文翻译，促成 TikTok Shop 点击购买。
7. EXACTLY 生成 3 款差异明显的创作者风格方案。
8. ${durationInstruction(duration)}
9. 如果存在“产品图片视觉事实”，它高于产品名称、类别常识和你自己的先验知识。任何外观描述必须严格匹配视觉事实；未确认的外观细节禁止出现。
10. JSON 必须严格合法：字符串内部如果出现英文双引号，必须转义为 \"；禁止尾随逗号；禁止把说明文字写在 JSON 外部。

只返回 JSON 数组，不要 Markdown，不要解释。结构必须严格为：
[
  {
    "title": "中文短标题",
    "style": "创作者风格",
    "hook": "中文解析前三秒钩子",
    "script": [
      { "timestamp": "0-2s", "visual": "中文纯画面描述", "audio": "当地语言台词（中文翻译）" }
    ],
    "cta": "当地语言 CTA（中文翻译）"
  }
]`;
}

const OLLAMA_SINGLE_SCRIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    style: { type: "string" },
    hook: { type: "string" },
    script: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          timestamp: { type: "string" },
          visual: { type: "string" },
          audio: { type: "string" }
        },
        required: ["timestamp", "visual", "audio"]
      }
    },
    cta: { type: "string" }
  },
  required: ["title", "style", "hook", "script", "cta"]
};

const OLLAMA_THREE_SCRIPTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    scripts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: OLLAMA_SINGLE_SCRIPT_SCHEMA
    }
  },
  required: ["scripts"]
};


function classifyOllamaModel(name: string, capabilities: string[] = []): OllamaModelInfo {
  const lower = name.toLowerCase();
  const caps = capabilities.map((c) => String(c).toLowerCase());
  const vision = caps.includes("vision") || /(?:^|[-_:])vl(?:[-_:]|$)/i.test(lower);
  const thinking = caps.includes("thinking") || lower.includes("thinking");
  // Ollama's bare qwen3-vl size aliases currently point at the dedicated thinking checkpoints.
  const qwen3VlBareThinkingAlias = /^qwen3-vl:(?:2b|4b|8b|30b|30b-a3b)$/i.test(name);
  const dedicatedThinking = lower.includes("thinking") || qwen3VlBareThinkingAlias;
  const instruct = lower.includes("instruct");
  const recommended = instruct || !dedicatedThinking;
  let recommendation = "";
  if (dedicatedThinking) {
    const m = name.match(/^qwen3-vl:(2b|4b|8b|30b|30b-a3b)$/i);
    recommendation = m
      ? `脚本结构化生成建议改用 qwen3-vl:${m[1]}-instruct`
      : "这是 Thinking 模型，脚本结构化生成更建议使用对应 Instruct 版本";
  } else if (instruct) {
    recommendation = "适合直接指令与结构化脚本生成";
  }
  return { name, capabilities, vision, thinking, dedicatedThinking, instruct, recommended, recommendation };
}

async function getOllamaModelInfo(baseUrl: string, name: string): Promise<OllamaModelInfo> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${baseUrl}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model: name, verbose: false })
    });
    clearTimeout(timeout);
    if (!response.ok) return classifyOllamaModel(name, []);
    const data: any = await response.json();
    return classifyOllamaModel(name, Array.isArray(data?.capabilities) ? data.capabilities : []);
  } catch {
    return classifyOllamaModel(name, []);
  }
}


function compareVersion(a: string, b: string) {
  const pa = String(a || "0").split(/[.+-]/).slice(0, 3).map((x) => Number.parseInt(x, 10) || 0);
  const pb = String(b || "0").split(/[.+-]/).slice(0, 3).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function assertOllamaVisionVersion(baseUrl: string, model: string, hasImage: boolean) {
  if (!hasImage || !/^qwen3-vl(?:[-:.]|$)/i.test(model)) return;
  try {
    const r = await fetch(`${baseUrl}/api/version`);
    if (!r.ok) return;
    const data: any = await r.json();
    const version = String(data?.version || "").trim();
    if (version && compareVersion(version, "0.12.7") < 0) {
      const err: any = new Error(`当前 Ollama 版本 ${version} 过旧。Qwen3-VL 图片输入要求 Ollama 0.12.7 或更高版本。请先更新 Ollama，再重新启动本程序。`);
      err.status = 400;
      throw err;
    }
  } catch (error: any) {
    if (/版本 .*过旧|0\.12\.7/.test(String(error?.message || ""))) throw error;
    // Version endpoint failure should not block normal calls on older Ollama builds.
  }
}

function buildOpenAICompatibleResponseFormat(format: any) {
  if (!format) return undefined;
  if (format === "json") return { type: "json_object" };
  if (typeof format === "object") {
    return {
      type: "json_schema",
      json_schema: {
        name: "structured_output",
        strict: true,
        schema: format,
      },
    };
  }
  return undefined;
}

async function callOllamaOpenAICompatFallback(
  baseUrl: string,
  config: ModelConfig,
  prompt: string,
  img: { mimeType: string; data: string } | null,
  format: any,
  timeoutMs: number,
  numPredict: number,
) {
  const content: any = img
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } },
      ]
    : prompt;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer ollama" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content }],
        stream: false,
        temperature: 0,
        top_p: 0.8,
        max_tokens: numPredict,
        reasoning_effort: "none",
        response_format: buildOpenAICompatibleResponseFormat(format),
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama OpenAI 兼容接口失败 (${response.status})：${body.slice(0, 500)}`);
    }
    const data: any = await response.json();
    const contentValue = data?.choices?.[0]?.message?.content;
    if (typeof contentValue === "string") return contentValue.trim();
    if (Array.isArray(contentValue)) {
      return contentValue.map((part: any) => typeof part === "string" ? part : (part?.text || part?.content || "")).filter(Boolean).join("\n").trim();
    }
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function callOllamaRaw(
  config: ModelConfig,
  prompt: string,
  image?: string,
  format: any = "json",
  timeoutMs = 4 * 60 * 1000,
  numPredict = 5000,
  acceptThinkingAsObservation = false
) {
  const baseUrl = normalizeBaseUrl(config.baseUrl, "http://127.0.0.1:11434");
  if (!config.model) throw new Error("请先选择 Ollama 模型");
  const img = extractImage(image);
  await assertOllamaVisionVersion(baseUrl, config.model, Boolean(img));

  const isQwen3 = /^qwen3(?:[-:.]|$)/i.test(config.model);
  const message: any = { role: "user", content: prompt };
  if (img) message.images = [img.data];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [message],
        stream: false,
        think: false,
        format,
        keep_alive: "10m",
        options: {
          temperature: 0,
          top_p: isQwen3 ? 0.8 : 0.9,
          top_k: 20,
          num_ctx: 8192,
          num_predict: numPredict
        }
      })
    });
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("本地模型本次生成超时。建议先选择 10 秒或 15 秒测试，或换更快的模型。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    const err: any = new Error(`Ollama 调用失败 (${response.status})：${body.slice(0, 500)}`);
    err.status = response.status;
    throw err;
  }

  const data: any = await response.json();
  const raw = String(data?.message?.content || data?.response || "").trim();
  if (raw) return raw;

  const thinking = String(data?.message?.thinking || data?.thinking || "").trim();
  const reason = String(data?.done_reason || data?.message?.done_reason || "").trim();

  // Vision analysis is a special case. Some dedicated Qwen3-VL Thinking
  // checkpoints place the actual image observation entirely in `thinking`
  // and finish with an empty `content`. For image-fact extraction we can use
  // that observation as source material; script generation remains strict.
  if (acceptThinkingAsObservation && thinking) {
    console.log(`[Ollama Vision] content 为空，接受 thinking 作为视觉观察（${thinking.length} 字符）。`);
    return thinking;
  }

  // Qwen3-VL Thinking checkpoints can occasionally ignore think:false on the
  // native endpoint and put everything in `thinking`. Retry through Ollama's
  // OpenAI-compatible API, which exposes explicit reasoning_effort="none" and
  // supports both Vision and response_format structured outputs.
  if (thinking || /^qwen3-vl(?:[-:.]|$)/i.test(config.model)) {
    try {
      const fallback = await callOllamaOpenAICompatFallback(
        baseUrl, config, prompt, img, format, Math.min(timeoutMs, 120000), numPredict
      );
      if (fallback) return fallback;
    } catch (fallbackError: any) {
      if (thinking) {
        throw new Error(`模型只生成了思考内容，没有生成最终答案（thinking ${thinking.length} 字符${reason ? `，done_reason=${reason}` : ""}）。已自动尝试第二条 Ollama 视觉兼容通道，但仍失败：${String(fallbackError?.message || fallbackError).slice(0, 240)}`);
      }
      throw fallbackError;
    }
  }

  if (thinking) {
    throw new Error(`模型只生成了思考内容，没有生成最终答案（thinking ${thinking.length} 字符${reason ? `，done_reason=${reason}` : ""}）。`);
  }
  throw new Error(`Ollama 返回了空内容${reason ? `（done_reason=${reason}）` : ""}`);
}

function buildOllamaSinglePrompt(basePrompt: string, index: number, style: string, duration: string) {
  return `${basePrompt}

【Ollama 本地模型专用覆盖指令】
忽略上面“生成 3 款”和“返回 JSON 数组”的要求。本次只生成【1 套】脚本，这是总共 3 套中的第 ${index} 套。
本套指定创作者方向：【${style}】。必须与其他方向明显不同。
只返回一个 JSON 对象，不要数组、不要 Markdown、不要解释、不要前后缀文字。
严格使用以下键名：title, style, hook, script, cta。
script 必须是分镜数组，每个元素只能包含 timestamp, visual, audio。
完整 JSON 模板（逐镜头填写真实内容，保留时间轴）：
${JSON.stringify({ title: "中文短标题", style, hook: "中文解析前三秒钩子", script: durationPlan(duration).slots.map(timestamp => ({ timestamp, visual: "填写本镜头的独立动作与演示", audio: "填写适合本镜头时长的台词及中文翻译" })), cta: "当地语言 CTA（中文翻译）" })}
${durationInstruction(duration)}`;
}

async function generateOneWithOllama(config: ModelConfig, prompt: string, image: string | undefined, index: number, style: string, duration = "15秒") {
  const baseUrl = normalizeBaseUrl(config.baseUrl, "http://127.0.0.1:11434");
  const info = await getOllamaModelInfo(baseUrl, config.model);
  const singlePrompt = buildOllamaSinglePrompt(prompt, index, style, duration);
  const plan = durationPlan(duration);
  const schema = { ...OLLAMA_SINGLE_SCRIPT_SCHEMA, properties: { ...OLLAMA_SINGLE_SCRIPT_SCHEMA.properties, script: { ...OLLAMA_SINGLE_SCRIPT_SCHEMA.properties.script, minItems: plan.slots.length, maxItems: plan.slots.length } } };
  try {
    const raw = await callOllamaRaw(config, singlePrompt, image, schema, 4 * 60 * 1000, durationPlan(duration).tokens);
    const parsed = parseJsonScripts(raw);
    if (!parsed[0]) throw new Error("未解析出脚本对象");
    return { ...parsed[0], style: parsed[0].style || style };
  } catch (error: any) {
    const msg = String(error?.message || error);
    if (info.dedicatedThinking && (msg.includes("空内容") || msg.includes("思考内容"))) {
      throw new Error(`${msg}\n当前模型 ${config.model} 属于 Thinking 版本，不适合此类严格结构化脚本输出。建议安装并选择：${info.recommendation?.replace("脚本结构化生成建议改用 ", "") || "对应 Instruct 版本"}`);
    }
    throw error;
  }
}

async function generateWithOllama(config: ModelConfig, prompt: string, image?: string, duration = "15秒") {
  // Local models are intentionally generated one script at a time.
  // This avoids wasting minutes on one oversized 3-script completion and is
  // substantially more reliable on 4B/8B consumer-GPU models.
  const styles = ["UGC 真实评测", "POV 第一视角", "Viral Demo 强视觉演示"];
  const collected: any[] = [];
  for (let i = 0; i < 3; i++) {
    const script = await generateOneWithOllama(config, prompt, image, i + 1, styles[i], duration);
    collected.push(script);
  }
  return collected;
}


function isProbablyScriptCapableModel(id: string) {
  const lower = String(id || "").toLowerCase();
  const excluded = [
    "embedding", "embed-", "whisper", "transcribe", "tts", "speech", "moderation",
    "image", "imagen", "video", "veo", "lyria", "rerank", "guard", "safeguard",
    "ocr", "realtime", "live-translate"
  ];
  return Boolean(id) && !excluded.some((term) => lower.includes(term));
}

function normalizeCloudModel(item: any): CloudModelInfo | null {
  const id = String(item?.id ?? item?.name ?? item?.model ?? "").trim().replace(/^models\//, "");
  if (!id || !isProbablyScriptCapableModel(id)) return null;
  const displayName = String(item?.displayName ?? item?.name ?? id);
  const lower = `${id} ${displayName}`.toLowerCase();
  const inputModalities = [
    ...(Array.isArray(item?.input_modalities) ? item.input_modalities : []),
    ...(Array.isArray(item?.architecture?.input_modalities) ? item.architecture.input_modalities : []),
  ].map((x: any) => String(x).toLowerCase());
  const explicitVision = typeof item?.capabilities?.vision === "boolean" ? item.capabilities.vision : undefined;
  let vision = explicitVision ?? (inputModalities.length ? inputModalities.includes("image") : undefined);

  if (vision === undefined) {
    const textOnlyPatterns = [
      /embedding/, /embed-/, /rerank/, /whisper/, /transcribe/, /tts/, /speech/, /moderation/, /reasoner/,
    ];
    const visionPatterns = [
      /(?:^|[-_])vl(?:[-_]|$)/, /vision/, /multimodal/, /omni/, /gpt-4o/, /gpt-4\.1/, /gemini/, /claude/,
      /glm-4v/, /glm-4\.5v/, /qwen-vl/, /internvl/, /llava/, /grok.*vision/, /yi-vision/,
      /doubao.*vision/, /deepseek.*vision/
    ];
    if (textOnlyPatterns.some((re) => re.test(lower))) vision = false;
    else if (visionPatterns.some((re) => re.test(lower))) vision = true;
  }

  const contextLength = Number(item?.context_length ?? item?.max_context_length ?? item?.contextWindow ?? 0) || undefined;
  return {
    id,
    name: displayName,
    provider: String(item?.owned_by ?? item?.provider ?? ""),
    vision,
    contextLength,
  };
}

async function listCloudModels(config: ModelConfig, strict = false): Promise<CloudModelInfo[]> {
  const preset = getCloudProviderPreset(config.cloudProviderId);
  const apiKey = config.apiKey || (config.provider === "gemini" ? process.env.GEMINI_API_KEY : undefined);
  const fallback = (preset.fallbackModels || []).map((id) => ({ id, name: id } as CloudModelInfo));
  if (!preset.supportsModelList) return fallback;

  if (config.provider === "gemini") {
    if (!apiKey) return fallback;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(apiKey)}`);
      if (!r.ok) throw new Error(`Gemini models API ${r.status}`);
      const data: any = await r.json();
      const models = (data?.models || [])
        .filter((m: any) => Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods.includes("generateContent") : true)
        .map((m: any) => normalizeCloudModel({ ...m, id: String(m?.name || "").replace(/^models\//, "") }))
        .filter(Boolean) as CloudModelInfo[];
      return models.length ? models.sort((a, b) => a.id.localeCompare(b.id)) : fallback;
    } catch (error) {
      if (strict || apiKey) throw error;
      return fallback;
    }
  }

  if (config.provider === "anthropic") {
    if (!apiKey) return fallback;
    const base = normalizeBaseUrl(config.baseUrl, "https://api.anthropic.com");
    try {
      const r = await fetch(`${base}/v1/models?limit=1000`, {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
      if (!r.ok) throw new Error(`Anthropic models API ${r.status}`);
      const data: any = await r.json();
      const models = (data?.data || data?.models || []).map(normalizeCloudModel).filter(Boolean) as CloudModelInfo[];
      return models.length ? models.sort((a, b) => a.id.localeCompare(b.id)) : fallback;
    } catch (error) {
      if (strict || apiKey) throw error;
      return fallback;
    }
  }

  const base = normalizeBaseUrl(config.baseUrl, preset.baseUrl || "https://api.openai.com/v1");
  if (!base) return fallback;
  // Most OpenAI-compatible providers expose GET /models. If a provider does not,
  // keep the preset fallback/manual model entry instead of treating it as fatal.
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const r = await fetch(`${base}/models`, { headers });
    if (!r.ok) throw new Error(`models endpoint ${r.status}`);
    const data: any = await r.json();
    const raw = Array.isArray(data) ? data : (data?.data || data?.models || []);
    const models = raw.map(normalizeCloudModel).filter(Boolean) as CloudModelInfo[];
    const byId = new Map<string, CloudModelInfo>();
    for (const m of [...fallback, ...models]) byId.set(m.id, m);
    return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    if (strict || apiKey) throw error;
    return fallback;
  }
}

async function analyzeWithOllama(config: ModelConfig, product: string, image: string) {
  const prompt = buildVisualAnalysisPrompt(product);
  const raw = await callOllamaRaw(
    config,
    prompt,
    image,
    PRODUCT_VISUAL_FACTS_SCHEMA,
    90 * 1000,
    1400,
    true
  );

  // Best case: instruct-style models return the requested JSON directly.
  try {
    return parseProductVisualFacts(raw);
  } catch (jsonError: any) {
    // Dedicated Thinking checkpoints often return prose observations in the
    // thinking field. Convert those observations into conservative facts
    // locally instead of failing the whole request or hallucinating details.
    console.log(`[Ollama Vision] 视觉观察不是标准 JSON，启用本地事实提取：${String(jsonError?.message || jsonError).slice(0, 180)}`);
    return extractVisualFactsFromObservation(raw, product);
  }
}

async function analyzeWithOpenAINative(config: ModelConfig, product: string, image: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl, "https://api.openai.com/v1");
  if (!config.apiKey) throw new Error("请输入 OpenAI API Key");
  const img = extractImage(image);
  if (!img) throw new Error("没有收到有效图片");
  const content: any[] = [
    { type: "input_text", text: buildVisualAnalysisPrompt(product) },
    { type: "input_image", image_url: `data:${img.mimeType};base64,${img.data}` }
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90 * 1000);
  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, input: [{ role: "user", content }] })
    });
    if (!response.ok) {
      const body = await response.text(); const err: any = new Error(`OpenAI 图片识别失败 (${response.status})：${body.slice(0, 500)}`); err.status = response.status; throw err;
    }
    const data: any = await response.json();
    const text = data?.output_text || (Array.isArray(data?.output) ? data.output.flatMap((o: any) => o?.content || []).map((c: any) => c?.text || "").join("\\n") : "");
    return parseProductVisualFacts(text);
  } finally { clearTimeout(timeout); }
}

async function analyzeWithOpenAICompatible(config: ModelConfig, product: string, image: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl, "https://api.openai.com/v1");
  if (!config.apiKey) throw new Error("请输入云端 API Key");
  const img = extractImage(image); if (!img) throw new Error("没有收到有效图片");
  const content: any[] = [
    { type: "text", text: buildVisualAnalysisPrompt(product) },
    { type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } }
  ];
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 90 * 1000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, temperature: 0, messages: [{ role: "user", content }] })
    });
    if (!response.ok) { const body = await response.text(); const err: any = new Error(`云端模型图片识别失败 (${response.status})：${body.slice(0, 500)}`); err.status = response.status; throw err; }
    const data: any = await response.json();
    return parseProductVisualFacts(extractOpenAIText(data) || "");
  } finally { clearTimeout(timeout); }
}

async function analyzeWithAnthropic(config: ModelConfig, product: string, image: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl, "https://api.anthropic.com");
  if (!config.apiKey) throw new Error("请输入 Anthropic API Key");
  const img = extractImage(image); if (!img) throw new Error("没有收到有效图片");
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 90 * 1000);
  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: config.model, max_tokens: 1400, temperature: 0, messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: img.mimeType, data: img.data } },
        { type: "text", text: buildVisualAnalysisPrompt(product) }
      ] }] })
    });
    if (!response.ok) { const body = await response.text(); const err: any = new Error(`Claude 图片识别失败 (${response.status})：${body.slice(0, 500)}`); err.status = response.status; throw err; }
    const data: any = await response.json();
    const text = (data?.content || []).filter((b: any) => b?.type === "text").map((b: any) => b?.text || "").join("\\n");
    return parseProductVisualFacts(text);
  } finally { clearTimeout(timeout); }
}

async function analyzeWithGemini(config: ModelConfig, product: string, image: string) {
  const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("请输入 Gemini API Key");
  const img = extractImage(image); if (!img) throw new Error("没有收到有效图片");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: config.model || "gemini-2.5-flash",
    contents: [{ text: buildVisualAnalysisPrompt(product) }, { inlineData: { mimeType: img.mimeType, data: img.data } }],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productType: { type: Type.STRING }, packageType: { type: Type.STRING }, primaryColor: { type: Type.STRING },
          secondaryColors: { type: Type.ARRAY, items: { type: Type.STRING } }, material: { type: Type.STRING },
          visibleText: { type: Type.ARRAY, items: { type: Type.STRING } }, visibleFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
          usageClues: { type: Type.ARRAY, items: { type: Type.STRING } }, uncertain: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["productType", "packageType", "primaryColor", "secondaryColors", "material", "visibleText", "visibleFeatures", "usageClues", "uncertain"]
      }
    }
  });
  return parseProductVisualFacts(response.text || "");
}

async function analyzeProductImage(config: ModelConfig, product: string, image: string) {
  if (!image) throw new Error("请先上传产品图片");
  if (config.inputMode !== "multimodal") throw new Error("当前模型被设置为纯文本模式，无法识别图片。请先选择“多模态 / 支持图片”。");
  if (config.provider === "ollama") return analyzeWithOllama(config, product, image);
  if (config.provider === "gemini") return analyzeWithGemini(config, product, image);
  if (config.provider === "anthropic") return analyzeWithAnthropic(config, product, image);
  if (config.provider === "openai" && config.cloudProviderId === "openai") return analyzeWithOpenAINative(config, product, image);
  if (config.provider === "openai") return analyzeWithOpenAICompatible(config, product, image);
  throw new Error("当前模型提供方暂不支持图片识别");
}

async function generateWithOpenAINative(config: ModelConfig, prompt: string, image?: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl, "https://api.openai.com/v1");
  if (!config.apiKey) throw new Error("请输入 OpenAI API Key");
  if (!config.model) throw new Error("请选择 OpenAI 模型");
  const img = extractImage(image);
  const content: any[] = [{ type: "input_text", text: prompt }];
  if (img) content.push({ type: "input_image", image_url: `data:${img.mimeType};base64,${img.data}` });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2 * 60 * 1000);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        input: [{ role: "user", content }],
      }),
    });
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("OpenAI 请求超过 2 分钟，已停止本次请求。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const body = await response.text();
    const err: any = new Error(`OpenAI API 调用失败 (${response.status})：${body.slice(0, 500)}`);
    err.status = response.status;
    throw err;
  }
  const data: any = await response.json();
  const outputText = data?.output_text || (Array.isArray(data?.output)
    ? data.output.flatMap((o: any) => o?.content || []).filter((c: any) => c?.type === "output_text" || c?.text).map((c: any) => c?.text || "").join("\n")
    : "");
  return parseJsonScripts(outputText || "[]");
}

async function generateWithAnthropic(config: ModelConfig, prompt: string, image?: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl, "https://api.anthropic.com");
  if (!config.apiKey) throw new Error("请输入 Anthropic API Key");
  if (!config.model) throw new Error("请选择 Claude 模型");
  const img = extractImage(image);
  const content: any[] = [];
  if (img) content.push({ type: "image", source: { type: "base64", media_type: img.mimeType, data: img.data } });
  content.push({ type: "text", text: prompt });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2 * 60 * 1000);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: config.model, max_tokens: 12000, messages: [{ role: "user", content }] }),
    });
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Claude 请求超过 2 分钟，已停止本次请求。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const body = await response.text();
    const err: any = new Error(`Anthropic API 调用失败 (${response.status})：${body.slice(0, 500)}`);
    err.status = response.status;
    throw err;
  }
  const data: any = await response.json();
  const text = (data?.content || []).filter((b: any) => b?.type === "text").map((b: any) => b?.text || "").join("\n");
  return parseJsonScripts(text || "[]");
}

function extractOpenAIText(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part: any) => typeof part === "string" ? part : (part?.text ?? part?.content ?? "")).filter(Boolean).join("\n");
  }

  // SenseNova and a few Chinese providers wrap the OpenAI-like payload in `data`.
  const nestedMessage = data?.data?.choices?.[0]?.message;
  if (typeof nestedMessage === "string") return nestedMessage;
  if (typeof nestedMessage?.content === "string") return nestedMessage.content;
  if (Array.isArray(nestedMessage?.content)) {
    return nestedMessage.content.map((part: any) =>
      typeof part === "string" ? part : (part?.text ?? part?.content ?? "")
    ).filter(Boolean).join("\n");
  }

  if (typeof data?.output_text === "string") return data.output_text;
  return "";
}

async function generateWithOpenAI(config: ModelConfig, prompt: string, image?: string) {
  if (config.cloudProviderId === "openai") return generateWithOpenAINative(config, prompt, image);
  const baseUrl = normalizeBaseUrl(config.baseUrl, "https://api.openai.com/v1");
  if (!config.apiKey) throw new Error("请输入云端 API Key");
  if (!config.model) throw new Error("请输入云端模型名称");
  const img = extractImage(image);
  const content: any = img ? [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } }
  ] : prompt;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2 * 60 * 1000);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content }]
      })
    });
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("云端模型请求超过 2 分钟，已停止本次请求。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const body = await response.text();
    const err: any = new Error(`云端 API 调用失败 (${response.status})：${body.slice(0, 500)}`);
    err.status = response.status;
    throw err;
  }
  const data: any = await response.json();
  const rawText = extractOpenAIText(data) || "";
  const parsed = tryParseJsonScripts(rawText);
  if (parsed.scripts) return parsed.scripts;

  // Some otherwise capable models occasionally return almost-correct JSON
  // (typically one missing comma or an unescaped quote). Instead of throwing
  // away a full generation, ask the same model once to repair syntax only.
  console.warn("[Cloud JSON] 首次解析失败，尝试自动修复：", String(parsed.error?.message || parsed.error || "unknown"));

  const repairPrompt = `你是 JSON 格式修复器。下面内容是另一个模型已经生成好的 TikTok 脚本。\n\n任务：\n1. 只修复 JSON 语法错误，例如缺少逗号、错误引号、未转义的双引号、尾随逗号。\n2. 不要改写、删减、总结或重新创作任何脚本内容。\n3. 最终只输出严格合法的 JSON，不要 Markdown 代码块，不要解释。\n4. 保持原来的数组/对象结构和字段：title, style, hook, script, timestamp, visual, audio, cta。\n\n需要修复的内容：\n${rawText.slice(0, 60000)}`;

  const repairController = new AbortController();
  const repairTimeout = setTimeout(() => repairController.abort(), 70 * 1000);
  try {
    const repairResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: repairController.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [{ role: "user", content: repairPrompt }]
      })
    });

    if (!repairResponse.ok) {
      const repairBody = await repairResponse.text();
      throw new Error(`JSON 自动修复请求失败 (${repairResponse.status})：${repairBody.slice(0, 300)}`);
    }

    const repairData: any = await repairResponse.json();
    const repairedText = extractOpenAIText(repairData) || "";
    const repaired = tryParseJsonScripts(repairedText);
    if (repaired.scripts) {
      console.log("[Cloud JSON] 模型输出格式已自动修复成功");
      return repaired.scripts;
    }

    throw new Error(`模型第二次返回的 JSON 仍不合法：${String(repaired.error?.message || repaired.error || "unknown").slice(0, 180)}`);
  } catch (repairError: any) {
    if (repairError?.name === "AbortError") {
      throw new Error("脚本内容已经生成，但 JSON 格式异常；自动修复等待超过 70 秒。请重试一次，或换一个更擅长结构化输出的模型。");
    }
    throw new Error(`脚本内容已经生成，但模型返回的 JSON 格式异常，自动修复也未成功：${repairError?.message || repairError}`);
  } finally {
    clearTimeout(repairTimeout);
  }
}

async function generateWithGemini(config: ModelConfig, prompt: string, image?: string) {
  const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("请输入 Gemini API Key，或在 .env.local 中设置 GEMINI_API_KEY");
  const model = config.model || "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey });
  const parts: any[] = [{ text: prompt }];
  const img = extractImage(image);
  if (img) parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  const response = await ai.models.generateContent({
    model,
    contents: parts,
    config: {
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING }, style: { type: Type.STRING }, hook: { type: Type.STRING },
            script: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
              timestamp: { type: Type.STRING }, visual: { type: Type.STRING }, audio: { type: Type.STRING }
            }, required: ["timestamp", "visual", "audio"] } },
            cta: { type: Type.STRING }
          },
          required: ["title", "style", "hook", "script", "cta"]
        }
      }
    }
  });
  return parseJsonScripts(response.text || "[]");
}

function explainModelServiceError(error: any, config?: ModelConfig) {
  const model = config?.model || "当前模型";
  const raw = String(error?.message || error || "");
  const lower = raw.toLowerCase();
  const status = Number(error?.status || 0) || undefined;

  if (status === 404 || status === 410 || /model.*not found|does not exist|deprecated|retired|decommission|no longer available|invalid model/.test(lower)) {
    return {
      status: status || 400,
      error: `模型 ${model} 当前无法调用。它可能已经下线、改名、被服务商移除，或者你的账号没有该模型权限。建议点击“读取当前模型”刷新列表；如果列表里仍然存在但持续失败，请到服务商控制台确认该模型是否仍可用。`,
      detail: raw,
      code: "MODEL_UNAVAILABLE",
    };
  }
  if (status === 401 || status === 403 || /unauthorized|forbidden|authentication|api key|permission denied/.test(lower)) {
    return {
      status: status || 401,
      error: `API Key 或账号权限无法调用模型 ${model}。请检查 API Key、模型权限、地区节点和账户状态。`,
      detail: raw,
      code: "AUTH_OR_PERMISSION",
    };
  }
  if (status === 429 || /rate limit|too many requests|quota|insufficient quota/.test(lower)) {
    return {
      status: 429,
      error: `模型 ${model} 当前触发限流或额度不足。请稍等后重试，或检查服务商余额 / 配额。`,
      detail: raw,
      code: "RATE_LIMIT",
    };
  }
  if (/image|vision|multimodal|unsupported content|content type/.test(lower)) {
    return {
      status: status || 400,
      error: `服务商拒绝了图片输入。你当前把 ${model} 设置为“多模态 / 支持图片”，请确认该模型确实支持图片；如果它是纯文本模型，请切换为“纯文本”后重试。`,
      detail: raw,
      code: "IMAGE_NOT_SUPPORTED",
    };
  }
  if (/空内容|没有返回|empty|no content|no output|returned nothing/.test(lower)) {
    return {
      status: status || 502,
      error: `模型 ${model} 已收到请求，但没有返回可用内容。它可能已经不再可用、服务端暂时异常，或与当前接口不兼容。建议先“测试模型连接”，再“读取当前模型”刷新列表；仍失败就更换模型。`,
      detail: raw,
      code: "EMPTY_MODEL_RESPONSE",
    };
  }
  if (status === 500 || status === 502 || status === 503 || status === 504 || /overloaded|service unavailable|temporarily unavailable|timeout|timed out|busy/.test(lower)) {
    return {
      status: status || 503,
      error: `模型服务暂时不可用或过载，当前模型：${model}。可以稍后重试；如果持续出现，请刷新模型列表并确认该模型是否仍在服务。`,
      detail: raw,
      code: "PROVIDER_UNAVAILABLE",
    };
  }
  return {
    status: status || 500,
    error: raw || `模型 ${model} 调用失败。请测试连接、刷新模型列表，或改用其他模型。`,
    detail: raw,
    code: "MODEL_CALL_FAILED",
  };
}

async function probeSelectedCloudModel(config: ModelConfig) {
  if (!config.apiKey && !(config.provider === "gemini" && process.env.GEMINI_API_KEY)) throw new Error("请输入 API Key");
  if (!config.model) throw new Error("请先选择模型");

  if (config.provider === "gemini") {
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY!;
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({ model: config.model, contents: [{ text: "Reply OK only." }] });
    return;
  }

  if (config.provider === "anthropic") {
    const base = normalizeBaseUrl(config.baseUrl, "https://api.anthropic.com");
    const r = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": config.apiKey!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: config.model, max_tokens: 8, messages: [{ role: "user", content: "Reply OK only." }] }),
    });
    if (!r.ok) {
      const body = await r.text();
      const err: any = new Error(`API 返回 ${r.status}: ${body.slice(0, 400)}`);
      err.status = r.status;
      throw err;
    }
    return;
  }

  if (config.cloudProviderId === "openai") {
    const base = normalizeBaseUrl(config.baseUrl, "https://api.openai.com/v1");
    const r = await fetch(`${base}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, input: "Reply OK only.", max_output_tokens: 16 }),
    });
    if (!r.ok) {
      const body = await r.text();
      const err: any = new Error(`API 返回 ${r.status}: ${body.slice(0, 400)}`);
      err.status = r.status;
      throw err;
    }
    return;
  }

  const preset = getCloudProviderPreset(config.cloudProviderId);
  const base = normalizeBaseUrl(config.baseUrl, preset.baseUrl);
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: "Reply OK only." }], max_tokens: 8 }),
  });
  if (!r.ok) {
    const body = await r.text();
    const err: any = new Error(`API 返回 ${r.status}: ${body.slice(0, 400)}`);
    err.status = r.status;
    throw err;
  }
}

export async function startServer(options: { port?: number; development?: boolean; rootDir: string; dataDir?: string }) {
  const app = express();
  const PORT = options.port ?? 0;
  const accountStore = new AccountStore(options.dataDir || path.join(options.rootDir, ".commercial-data"));
  app.use(express.json({ limit: "50mb" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true, version: "1.0.3" }));

  // Commercial mode foundation. Payment providers will call the recharge
  // endpoint later; generation remains local-first until BILLING_REQUIRED is set.
  app.post("/api/account/register", (req, res) => {
    try { return res.json(accountStore.register(String(req.body?.email || ""), String(req.body?.password || ""))); }
    catch (error: any) { return res.status(error.status || 500).json({ error: error.message }); }
  });
  app.post("/api/account/login", (req, res) => {
    try { return res.json(accountStore.login(String(req.body?.email || ""), String(req.body?.password || ""))); }
    catch (error: any) { return res.status(error.status || 500).json({ error: error.message }); }
  });
  app.get("/api/account/me", (req, res) => {
    const user = accountStore.authenticate(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
    return user ? res.json({ user }) : res.status(401).json({ error: "请先登录" });
  });
  app.get("/api/account/ledger", (req, res) => {
    const user = accountStore.authenticate(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
    return user ? res.json({ entries: accountStore.ledger(user.id) }) : res.status(401).json({ error: "请先登录" });
  });
  app.post("/api/billing/quote", (req, res) => {
    try { return res.json(accountStore.quote(String(req.body?.duration || ""))); }
    catch (error: any) { return res.status(error.status || 500).json({ error: error.message }); }
  });

  app.get("/api/models", async (req, res) => {
    try {
      const provider = String(req.query.provider || "ollama");
      const baseUrl = String(req.query.baseUrl || "");
      if (provider === "ollama") {
        const base = normalizeBaseUrl(baseUrl, "http://127.0.0.1:11434");
        const r = await fetch(`${base}/api/tags`);
        if (!r.ok) throw new Error(`Ollama 未响应 (${r.status})`);
        const data: any = await r.json();
        const models: string[] = (data.models || []).map((m: any) => m.name);
        const modelInfos = await Promise.all(models.map((name) => getOllamaModelInfo(base, name)));
        modelInfos.sort((a, b) => Number(b.instruct) - Number(a.instruct) || Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name));
        return res.json({ models: modelInfos.map((m) => m.name), modelInfos });
      }
      return res.json({ models: [] });
    } catch (error: any) {
      res.status(503).json({ error: `无法连接模型服务：${error.message}` });
    }
  });


  app.post("/api/cloud-models", async (req, res) => {
    try {
      const config = req.body as ModelConfig;
      if (config.provider === "ollama") return res.status(400).json({ error: "该接口仅用于云端模型" });
      const models = await listCloudModels(config);
      return res.json({ models, count: models.length });
    } catch (error: any) {
      return res.status(503).json({ error: error.message || "读取云端模型列表失败" });
    }
  });

  app.post("/api/test-model", async (req, res) => {
    const config = req.body as ModelConfig;
    try {
      if (config.provider === "ollama") {
        const base = normalizeBaseUrl(config.baseUrl, "http://127.0.0.1:11434");
        const r = await fetch(`${base}/api/tags`);
        if (!r.ok) throw new Error(`Ollama 未响应 (${r.status})`);
        const data: any = await r.json();
        const models: string[] = (data.models || []).map((m: any) => m.name);
        const modelInfos = await Promise.all(models.map((name) => getOllamaModelInfo(base, name)));
        modelInfos.sort((a, b) => Number(b.instruct) - Number(a.instruct) || Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name));
        return res.json({ ok: true, message: `Ollama 已连接，共发现 ${models.length} 个模型`, models: modelInfos.map((m) => m.name), modelInfos });
      }
      if (config.provider === "openai" || config.provider === "gemini" || config.provider === "anthropic") {
        if (!config.apiKey && !(config.provider === "gemini" && process.env.GEMINI_API_KEY)) throw new Error("请输入 API Key");
        const preset = getCloudProviderPreset(config.cloudProviderId);
        let models: CloudModelInfo[] = [];
        if (preset.supportsModelList) {
          models = await listCloudModels(config, true);
        }
        await probeSelectedCloudModel(config);
        const providerName = preset.name;
        return res.json({ ok: true, message: `${providerName} 已连接 · 当前模型 ${config.model} 可正常调用${models.length ? ` · 列表共 ${models.length} 个模型` : ""}`, cloudModels: models });
      }
      throw new Error("未知模型提供方");
    } catch (error: any) {
      const explained = explainModelServiceError(error, config);
      res.status(explained.status).json({ ok: false, error: explained.error, detail: explained.detail, code: explained.code });
    }
  });

  app.post("/api/analyze-product-image", async (req, res) => {
    try {
      const body = req.body as ScriptRequest;
      const config: ModelConfig = body.modelConfig || { provider: "ollama", baseUrl: "http://127.0.0.1:11434", model: "", inputMode: "text" };
      if (!body.image) return res.status(400).json({ error: "请先上传产品图片" });
      if (!config.model) return res.status(400).json({ error: "请先选择模型" });
      const visualFacts = await analyzeProductImage(config, body.product || "", body.image);
      return res.json({ visualFacts, model: { provider: config.provider, model: config.model } });
    } catch (error: any) {
      console.error("Error analyzing product image:", error);
      const config = (req.body?.modelConfig || { provider: "openai", model: "" }) as ModelConfig;
      const explained = explainModelServiceError(error, config);
      return res.status(explained.status).json({ error: explained.error, detail: explained.detail, code: explained.code });
    }
  });

  app.post("/api/generate-one", async (req, res) => {
    try {
      const body = req.body as ScriptRequest & { index?: number; style?: string };
      const { product, targetAudience, features, duration } = body;
      if (!product || !targetAudience || !features || !duration) return res.status(400).json({ error: "请填写完整的产品、受众、卖点与时长" });
      const config: ModelConfig = body.modelConfig || { provider: "ollama", baseUrl: "http://127.0.0.1:11434", model: "" };
      if (config.provider !== "ollama") return res.status(400).json({ error: "逐套生成接口仅用于本地 Ollama" });
      const index = Math.min(3, Math.max(1, Number(body.index || 1)));
      const styles = ["UGC 真实评测", "POV 第一视角", "Viral Demo 强视觉演示"];
      const style = String(body.style || styles[index - 1]);
      const prompt = buildPrompt(body);
      const [script] = await generateTimed(duration, async correction => [await generateOneWithOllama(config, prompt + correction, body.visualFacts ? undefined : body.image, index, style, duration)]);
      return res.json({ script, index, total: 3, model: { provider: config.provider, model: config.model } });
    } catch (error: any) {
      console.error("Error generating one Ollama script:", error);
      const config = (req.body?.modelConfig || { provider: "ollama", model: "" }) as ModelConfig;
      const explained = explainModelServiceError(error, config);
      return res.status(explained.status).json({ error: explained.error, detail: explained.detail, code: explained.code });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const body = req.body as ScriptRequest;
      const { product, targetAudience, features, duration } = body;
      if (!product || !targetAudience || !features || !duration) return res.status(400).json({ error: "请填写完整的产品、受众、卖点与时长" });
      const config: ModelConfig = body.modelConfig || {
        provider: "ollama",
        baseUrl: "http://127.0.0.1:11434",
        model: ""
      };
      const prompt = buildPrompt(body);
      const generationImage = body.visualFacts ? undefined : body.image;
      const scripts = await generateTimed(duration, async correction => {
      const adjustedPrompt = prompt + correction;
      if (config.provider === "ollama") return generateWithOllama(config, adjustedPrompt, generationImage, duration);
      else if (config.provider === "openai") return generateWithOpenAI(config, adjustedPrompt, generationImage);
      else if (config.provider === "gemini") return generateWithGemini(config, adjustedPrompt, generationImage);
      else if (config.provider === "anthropic") return generateWithAnthropic(config, adjustedPrompt, generationImage);
      else throw new Error("不支持的模型提供方");
      });
      res.json({ scripts: scripts.slice(0, 3), model: { provider: config.provider, model: config.model } });
    } catch (error: any) {
      console.error("Error generating scripts:", error);
      const config = (req.body?.modelConfig || { provider: "openai", model: "" }) as ModelConfig;
      const explained = explainModelServiceError(error, config);
      res.status(explained.status).json({ error: explained.error, detail: explained.detail, code: explained.code });
    }
  });

  let vite: import("vite").ViteDevServer | undefined;
  if (options.development) {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({ root: options.rootDir, server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(options.rootDir, "dist");
    if (!existsSync(path.join(distPath, "index.html"))) throw new Error(`Frontend missing: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  const server = createServer(app);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(PORT, "127.0.0.1", () => { server.removeListener("error", reject); resolve(); });
    });
  } catch (error) { await vite?.close(); throw error; }
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No listening address");
  return { server, url: `http://127.0.0.1:${address.port}`, close: async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
    await vite?.close();
  } };
}
