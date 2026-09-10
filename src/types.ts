export type AIProvider = "ollama" | "openai" | "gemini" | "anthropic";

export interface ModelConfig {
  provider: AIProvider;
  baseUrl: string;
  apiKey?: string;
  model: string;
  cloudProviderId?: string;
  inputMode?: "text" | "multimodal";
}

export interface CloudModelInfo {
  id: string;
  name?: string;
  provider?: string;
  vision?: boolean;
  contextLength?: number;
}

export interface OllamaModelInfo {
  name: string;
  capabilities: string[];
  vision: boolean;
  thinking: boolean;
  dedicatedThinking: boolean;
  instruct: boolean;
  recommended: boolean;
  recommendation?: string;
}


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

export interface ScriptRequest {
  region: string;
  product: string;
  targetAudience: string;
  features: string;
  image?: string;
  duration: string;
  visualFacts?: ProductVisualFacts;
  modelConfig?: ModelConfig;
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

export interface GenerateResponse {
  scripts: ScriptOption[];
  model?: {
    provider: AIProvider;
    model: string;
  };
}
