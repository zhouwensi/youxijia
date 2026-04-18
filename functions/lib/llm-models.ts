import type { Env } from "../types";
import type { Db } from "./http";
import { getConfig } from "./db";

export type LlmModelEntry = {
  name: string;
  provider: string;
  model: string;
  baseUrl: string;
  creditCost: number;
  speed: string;
  quality: string;
  maxTokens: number;
  turboRecommended?: boolean;
};

export const LLM_MODELS: Record<string, LlmModelEntry> = {
  "deepseek-v3": {
    name: "DeepSeek V3",
    provider: "deepseek",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
    creditCost: 1,
    speed: "slow",
    quality: "high",
    maxTokens: 8192,
    turboRecommended: true,
  },
  "deepseek-r1": {
    name: "DeepSeek R1",
    provider: "deepseek",
    model: "deepseek-reasoner",
    baseUrl: "https://api.deepseek.com",
    creditCost: 1,
    speed: "slow",
    quality: "very-high",
    maxTokens: 8192,
  },
  "gpt-4o": {
    name: "GPT-4o",
    provider: "openai",
    model: "gpt-4o",
    baseUrl: "https://api.openai.com",
    creditCost: 1,
    speed: "medium",
    quality: "very-high",
    maxTokens: 16384,
  },
  "gpt-4o-mini": {
    name: "GPT-4o Mini",
    provider: "openai",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com",
    creditCost: 1,
    speed: "fast",
    quality: "medium",
    maxTokens: 16384,
    turboRecommended: true,
  },
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    provider: "openrouter",
    model: "google/gemini-2.5-flash",
    baseUrl: "https://openrouter.ai/api",
    creditCost: 1,
    speed: "very-fast",
    quality: "high",
    maxTokens: 8192,
  },
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro",
    provider: "openrouter",
    model: "google/gemini-2.5-pro",
    baseUrl: "https://openrouter.ai/api",
    creditCost: 1,
    speed: "fast",
    quality: "very-high",
    maxTokens: 65536,
  },
};

const DEFAULT_ENABLED = [
  "deepseek-v3",
  "deepseek-r1",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gpt-4o",
  "gpt-4o-mini",
];

export async function isModelEnabled(db: Db, modelId: string): Promise<boolean> {
  const v = await getConfig(db, `llm_enabled_${modelId}`, null);
  if (v !== null) return v === "true" || v === "1";
  return DEFAULT_ENABLED.includes(modelId);
}

export async function getModelCreditCost(db: Db, modelId: string): Promise<number> {
  const v = await getConfig(db, `llm_credits_${modelId}`, null);
  if (v !== null) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return LLM_MODELS[modelId]?.creditCost ?? 0;
}

export async function getModelMaxTokens(db: Db, modelId: string): Promise<number> {
  const v = await getConfig(db, `llm_maxtokens_${modelId}`, null);
  if (v !== null) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 8000;
  }
  return LLM_MODELS[modelId]?.maxTokens ?? 8000;
}

export async function getModelQuality(db: Db, modelId: string): Promise<string> {
  const v = await getConfig(db, `llm_quality_${modelId}`, null);
  if (v !== null) return v;
  return LLM_MODELS[modelId]?.quality ?? "medium";
}

function speedLevelFromModelSpeed(speed: string): string {
  const speedMap: Record<string, string> = {
    "very-fast": "ultra",
    fast: "fast",
    medium: "normal",
    slow: "slow",
    "very-slow": "very-slow",
  };
  return speedMap[speed] || "normal";
}

export async function getModelSpeedLevel(db: Db, modelId: string): Promise<string> {
  const v = await getConfig(db, `llm_speed_${modelId}`, null);
  if (v) return v;
  const m = LLM_MODELS[modelId];
  return speedLevelFromModelSpeed(m?.speed ?? "medium");
}

export async function getTurboModelsPayload(db: Db, env?: Env): Promise<{
  models: Array<Record<string, unknown>>;
  defaultModel: string;
}> {
  const defaultModelId =
    (await getConfig(db, "llm_default_model", "deepseek-v3")) || "deepseek-v3";

  /** 与 generate-handler 一致：Secret 或 D1 的 llm_default_api_key 视为平台已配置默认 Key */
  const globalPlatformKey = Boolean(
    (env?.LLM_DEFAULT_API_KEY && env.LLM_DEFAULT_API_KEY.trim().length > 0) ||
      ((await getConfig(db, "llm_default_api_key", "")) || "").trim().length > 0,
  );

  const entries = await Promise.all(
    Object.entries(LLM_MODELS).map(async ([key, config]) => {
      if (!(await isModelEnabled(db, key))) return null;
      const creditCost = await getModelCreditCost(db, key);
      const quality = await getModelQuality(db, key);
      const maxTokens = await getModelMaxTokens(db, key);
      const apiKeyKey = `llm_apikey_${key}`;
      const perModelKey = await getConfig(db, apiKeyKey, "");
      const hasDefaultKey =
        Boolean(perModelKey && perModelKey.length > 0) || globalPlatformKey;
      const speedLevel = await getModelSpeedLevel(db, key);
      return {
        id: key,
        name: config.name,
        creditCost,
        speedLevel,
        quality,
        maxTokens,
        turboRecommended: !!config.turboRecommended,
        hasDefaultKey,
        needsUserKey: creditCost === 0 && !hasDefaultKey,
      };
    }),
  );

  const models = entries.filter(Boolean) as Array<Record<string, unknown>>;
  models.sort((a, b) => {
    const ac = (a.creditCost as number) ?? 0;
    const bc = (b.creditCost as number) ?? 0;
    if (ac !== bc) return ac - bc;
    const order: Record<string, number> = {
      medium: 1,
      high: 2,
      "very-high": 3,
      excellent: 4,
    };
    return (
      (order[String(b.quality)] || 0) - (order[String(a.quality)] || 0)
    );
  });

  return { models, defaultModel: defaultModelId };
}
