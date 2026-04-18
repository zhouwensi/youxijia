import type { Env } from "../types";
import { json, type Db } from "./http";
import { getConfig } from "./db";
import {
  LLM_MODELS,
  getModelCreditCost,
  getModelMaxTokens,
  isModelEnabled,
} from "./llm-models";

export function extractHtmlFromResponse(response: string): string {
  if (!response) return response;
  let code = response;
  const htmlMatch = code.match(/```html\s*\n?([\s\S]*?)```/i);
  if (htmlMatch?.[1]) return htmlMatch[1].trim();
  const plainMatch = code.match(/```\s*\n([\s\S]*?)```/);
  if (
    plainMatch?.[1] &&
    (plainMatch[1].includes("<html") || plainMatch[1].includes("<!DOCTYPE"))
  ) {
    return plainMatch[1].trim();
  }
  const doctypeIndex = code.indexOf("<!DOCTYPE");
  const doctypeLowerIndex = code.indexOf("<!doctype");
  const startIndex = doctypeIndex !== -1 ? doctypeIndex : doctypeLowerIndex;
  if (startIndex !== -1) {
    const htmlEndIndex = code.lastIndexOf("</html>");
    if (htmlEndIndex !== -1) return code.substring(startIndex, htmlEndIndex + 7).trim();
    const endIndex = code.indexOf("```", startIndex);
    if (endIndex !== -1) return code.substring(startIndex, endIndex).trim();
    return code.substring(startIndex).trim();
  }
  const htmlStartIndex = code.indexOf("<html");
  if (htmlStartIndex !== -1) {
    const htmlEndIndex = code.lastIndexOf("</html>");
    if (htmlEndIndex !== -1) return code.substring(htmlStartIndex, htmlEndIndex + 7).trim();
  }
  if (code.startsWith("```")) {
    const firstNewline = code.indexOf("\n");
    if (firstNewline !== -1) code = code.substring(firstNewline + 1);
    if (code.endsWith("```")) code = code.slice(0, -3);
  }
  code = code.replace(/```html\s*\n?/gi, "");
  code = code.replace(/```\s*$/gm, "");
  code = code.replace(/^```\s*$/gm, "");
  return code.trim();
}

function buildAdvancedHint(advancedSettings: Record<string, unknown> | undefined): string {
  if (!advancedSettings) return "";
  const hints: string[] = [];
  const gameTypeMap: Record<string, string> = {
    action: "动作游戏",
    puzzle: "益智解谜游戏",
    casual: "休闲游戏",
    racing: "竞速游戏",
    shooting: "射击游戏",
    platform: "平台跳跃游戏",
    rpg: "RPG角色扮演游戏",
    strategy: "策略游戏",
  };
  const artStyleMap: Record<string, string> = {
    pixel: "像素风格",
    cartoon: "卡通风格",
    minimalist: "极简风格",
    retro: "复古风格",
    neon: "霓虹赛博风格",
    handdrawn: "手绘风格",
  };
  const gt = advancedSettings.gameType as string | undefined;
  if (gt && gt !== "auto") hints.push(`游戏类型: ${gameTypeMap[gt] || gt}`);
  const art = advancedSettings.artStyle as string | undefined;
  if (art && art !== "auto") hints.push(`美术风格: ${artStyleMap[art] || art}，请在视觉设计上体现`);
  const ori = advancedSettings.orientation as string | undefined;
  if (ori === "landscape") hints.push("屏幕方向: 横屏优化");
  else if (ori === "portrait") hints.push("屏幕方向: 竖屏优化");
  const plat = advancedSettings.platform as string | undefined;
  if (plat === "mobile") hints.push("目标平台: 移动端触屏优化");
  else if (plat === "pc") hints.push("目标平台: PC 键鼠优化");
  const diff = advancedSettings.difficulty as string | undefined;
  if (diff && diff !== "medium") {
    const dm: Record<string, string> = {
      easy: "简单难度",
      hard: "困难难度",
    };
    hints.push(`难度: ${dm[diff] || diff}`);
  }
  const se = advancedSettings.soundEffect as string | undefined;
  if (se && se !== "none" && se !== "") {
    if (se === "basic") hints.push("音效: 基础 Web Audio 音效");
    else if (se === "rich") hints.push("音效: 丰富 Web Audio 与循环 BGM");
  }
  if (hints.length === 0) return "";
  return `\n【用户高级设置】：\n${hints.map((h) => `- ${h}`).join("\n")}\n请在生成游戏时参考以上设置。`;
}

export function chatUrl(provider: string, baseUrl: string): string {
  const b = baseUrl.replace(/\/$/, "");
  if (provider === "zhipu") return `${b}/chat/completions`;
  return `${b}/v1/chat/completions`;
}

export async function callOpenAiCompatible(opts: {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  extraHeaders?: Record<string, string>;
}): Promise<{ text: string; usage?: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${opts.apiKey}`,
    ...opts.extraHeaders,
  };
  const res = await fetch(opts.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: 0.7,
      max_tokens: opts.maxTokens,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`LLM API错误: ${res.status} - ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, usage: data.usage };
}

export async function callAnthropic(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}): Promise<{ text: string; usage?: unknown }> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/v1/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Anthropic API错误: ${res.status} - ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: unknown;
  };
  const block = data.content?.find((c) => c.type === "text");
  const text = block?.text ?? "";
  return { text, usage: data.usage };
}

export async function handleGenerate(
  request: Request,
  env: Env,
  db: Db,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ success: false, error: "无效 JSON" }, 400);
  }

  const prompt = String(body.prompt ?? "").trim();
  const llmConfig = (body.llmConfig as Record<string, unknown>) || {};
  const draftId = body.draftId ? String(body.draftId) : null;
  const advancedSettings = body.advancedSettings as Record<string, unknown> | undefined;
  const turboModel = body.turboModel ? String(body.turboModel) : null;
  const isTurboSwitch = Boolean(body.isTurboSwitch);
  const userToken = request.headers.get("X-User-Token");
  const authorToken = request.headers.get("X-Author-Token");

  if (!prompt) return json({ success: false, error: "请输入游戏描述" }, 400);

  const llmEnabled = (await getConfig(db, "llm_enabled", "true")) === "true";
  if (!llmEnabled) {
    return json({ success: false, error: "游戏生成功能暂时不可用" }, 503);
  }

  let turboCreditCost = 0;
  if (turboModel && isTurboSwitch && userToken) {
    const tc = LLM_MODELS[turboModel];
    if (!tc) return json({ success: false, error: "无效的加速模型" }, 400);
    turboCreditCost = await getModelCreditCost(db, turboModel);
    if (turboCreditCost > 0) {
      const row = await db
        .prepare("SELECT credits FROM user_credits WHERE user_token = ?")
        .bind(userToken)
        .first<{ credits: number }>();
      const have = row?.credits ?? 0;
      if (have < turboCreditCost) {
        return json(
          {
            success: false,
            error: `积分不足，需要 ${turboCreditCost} 积分`,
            creditsNeeded: turboCreditCost,
            creditsHave: have,
          },
          400,
        );
      }
      await db
        .prepare(
          "UPDATE user_credits SET credits = credits - ?, total_used = total_used + ?, updated_at = datetime('now') WHERE user_token = ?",
        )
        .bind(turboCreditCost, turboCreditCost, userToken)
        .run();
      await db
        .prepare(
          "INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, 'turbo_generate', ?)",
        )
        .bind(userToken, -turboCreditCost, `加速生成：${tc.name}`)
        .run();
    }
  }

  const defaultModelKey = (await getConfig(db, "llm_default_model", "deepseek-v3")) || "deepseek-v3";
  const defaultApiKey =
    env.LLM_DEFAULT_API_KEY || (await getConfig(db, "llm_default_api_key", "")) || "";
  const defaultBaseUrlEnv = env.LLM_DEFAULT_BASE_URL || "";

  const requestedModelId = (llmConfig.provider as string) || null;
  const useUserApiKey = Boolean(llmConfig.apiKey && String(llmConfig.apiKey).length > 0);

  let selectedModelId: string | null = null;
  let finalModel: string;
  let finalProvider: string;
  let finalBaseUrl: string;

  if (turboModel && LLM_MODELS[turboModel]) {
    const tc = LLM_MODELS[turboModel];
    finalModel = tc.model;
    finalProvider = tc.provider;
    finalBaseUrl = tc.baseUrl;
    selectedModelId = turboModel;
  } else if (requestedModelId && LLM_MODELS[requestedModelId]) {
    if (!(await isModelEnabled(db, requestedModelId))) {
      return json({ success: false, error: "该模型未启用" }, 400);
    }
    const mc = LLM_MODELS[requestedModelId];
    finalModel = mc.model;
    finalProvider = mc.provider;
    finalBaseUrl = mc.baseUrl;
    selectedModelId = requestedModelId;
  } else if (requestedModelId === "custom" && useUserApiKey) {
    finalModel = String(llmConfig.model || "deepseek-chat");
    finalProvider = "custom";
    finalBaseUrl = String(llmConfig.baseUrl || "https://api.deepseek.com");
    selectedModelId = null;
  } else if (LLM_MODELS[defaultModelKey]) {
    const mc = LLM_MODELS[defaultModelKey];
    finalModel = mc.model;
    finalProvider = mc.provider;
    finalBaseUrl = mc.baseUrl;
    selectedModelId = defaultModelKey;
  } else {
    const fb = LLM_MODELS["deepseek-v3"];
    finalModel = fb.model;
    finalProvider = fb.provider;
    finalBaseUrl = fb.baseUrl;
    selectedModelId = "deepseek-v3";
  }

  const modelSpecificKey = selectedModelId
    ? await getConfig(db, `llm_apikey_${selectedModelId}`, "")
    : "";
  let apiKey = "";
  let keySource = "";
  if (useUserApiKey && String(llmConfig.apiKey).length > 0) {
    apiKey = String(llmConfig.apiKey);
    keySource = "user";
  } else if (modelSpecificKey) {
    apiKey = modelSpecificKey;
    keySource = "model_specific";
  } else if (defaultApiKey) {
    apiKey = defaultApiKey;
    keySource = "default";
  }

  if (defaultBaseUrlEnv && (keySource === "default" || finalProvider === "custom")) {
    finalBaseUrl = defaultBaseUrlEnv.replace(/\/$/, "");
  }

  const modelCreditCost = selectedModelId ? await getModelCreditCost(db, selectedModelId) : 0;
  if (!turboModel && keySource !== "user" && userToken && selectedModelId && modelCreditCost > 0) {
    const row = await db
      .prepare("SELECT credits FROM user_credits WHERE user_token = ?")
      .bind(userToken)
      .first<{ credits: number }>();
    const have = row?.credits ?? 0;
    if (have < modelCreditCost) {
      return json(
        {
          success: false,
          error: `积分不足，需要 ${modelCreditCost} 积分`,
          creditsNeeded: modelCreditCost,
          creditsHave: have,
        },
        400,
      );
    }
    await db
      .prepare(
        "UPDATE user_credits SET credits = credits - ?, total_used = total_used + ?, updated_at = datetime('now') WHERE user_token = ?",
      )
      .bind(modelCreditCost, modelCreditCost, userToken)
      .run();
    const name = LLM_MODELS[selectedModelId]?.name || selectedModelId;
    await db
      .prepare(
        "INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, 'generate', ?)",
      )
      .bind(userToken, -modelCreditCost, `生成游戏：${name}`)
      .run();
  }

  if (!apiKey) {
    return json(
      {
        success: false,
        error: "未配置 API Key：请在 Cloudflare Secret 设置 LLM_DEFAULT_API_KEY，或在后台 system_config 填写 llm_default_api_key",
        needApiKey: true,
      },
      400,
    );
  }

  const advancedHint = buildAdvancedHint(advancedSettings);
  const gameNameHint = advancedSettings?.gameName
    ? `\n【游戏名称】：请将游戏标题设置为"${String(advancedSettings.gameName)}"`
    : "";

  const systemPrompt = `你是一个专业的HTML5游戏开发专家。用户会给你一句话描述，你需要生成一个完整的、可直接运行的HTML5游戏。

【最重要 - 代码必须完整】：
- 代码必须完整，确保有</script></body></html>结束标签
- 代码要精简高效，避免冗余，控制在800行以内
- 不要写过多注释，保持代码简洁

【基本要求】：
1. 完整HTML文件：<!DOCTYPE html>、<html>、<head>、<body>，必须正确闭合
2. CSS写在<style>内，JS写在<script>内
3. 页面加载后立即显示游戏，不能空白
4. 同时支持键盘和触屏操作

【触摸控制要求 - 非常重要】：
1. 对于需要移动/转向的角色或物体，必须支持手指触摸拖动控制，不要只用按钮
2. 实现触摸方式：监听touchstart/touchmove/touchend事件，根据手指移动方向控制角色
3. 可以使用虚拟摇杆（左下角半透明圆形区域）或直接触摸屏幕任意位置拖动
4. 同时保留键盘方向键/WASD支持，但触屏设备优先使用触摸控制

【游戏界面要求 - 非常重要】：
1. 只有3种界面状态：开始界面、游戏进行中、结束界面
2. 开始界面：显示游戏标题、"开始游戏"按钮、以及"游戏说明"按钮（点击显示操作方法）
3. 游戏进行中：必须隐藏所有遮罩层，只显示Canvas游戏画面。得分、生命值等HUD信息直接用Canvas绘制在画面上，不要用HTML覆盖层
4. 结束界面：游戏结束时才显示结果，可以用半透明遮罩层
5. 点击"开始游戏"后，必须立即隐藏开始界面的遮罩，让玩家看到游戏画面
6. 不要在游戏进行中显示任何全屏或半透明的HTML遮罩层
7. 游戏界面右上角保留一个小的"?"按钮，点击可随时查看游戏说明

【内容合规要求】：
1. 游戏内容必须健康积极，适合所有年龄段
2. 禁止包含暴力血腥、色情低俗、政治敏感、赌博等违规内容
3. 游戏角色和场景设计要正向友好

【游戏要求】：
1. 游戏有趣、逻辑完整
2. 深色主题，适配手机和电脑

【布局要求 - 非常重要】：
1. 游戏必须在一屏内完整显示，禁止出现滚动条
2. 使用 width:100vw; height:100vh; overflow:hidden 确保全屏且不滚动
3. Canvas尺寸动态适配：使用 window.innerWidth 和 window.innerHeight
4. 所有UI元素使用绝对定位或flex布局，不要超出视口范围
5. 监听 resize 事件，窗口大小变化时自动调整Canvas尺寸
${advancedHint}${gameNameHint}
只返回完整的HTML代码，用\`\`\`html和\`\`\`包裹，不要解释。`;

  const userMsg = `请生成游戏：${prompt}`;
  const maxTokens = selectedModelId ? await getModelMaxTokens(db, selectedModelId) : 8000;
  const apiStart = Date.now();

  let rawText: string;
  let usage: unknown;
  try {
    if (finalProvider === "anthropic") {
      const r = await callAnthropic({
        baseUrl: finalBaseUrl,
        apiKey,
        model: finalModel,
        system: systemPrompt,
        user: userMsg,
        maxTokens,
      });
      rawText = r.text;
      usage = r.usage;
    } else {
      const url = chatUrl(finalProvider, finalBaseUrl);
      const extra: Record<string, string> = {};
      if (finalProvider === "openrouter") {
        extra["HTTP-Referer"] = "https://yijuhuayouxi.com";
        extra["X-Title"] = "youxijia";
      }
      const r = await callOpenAiCompatible({
        url,
        apiKey,
        model: finalModel,
        system: systemPrompt,
        user: userMsg,
        maxTokens,
        extraHeaders: extra,
      });
      rawText = r.text;
      usage = r.usage;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ success: false, error: msg }, 500);
  }

  const apiTime = Date.now() - apiStart;
  let code = extractHtmlFromResponse(rawText);
  const hasScript = code.includes("<script");
  const hasClosingScript = code.includes("</script>");
  const hasBody = code.includes("<body");
  const hasClosingBody = code.includes("</body>");
  const hasHtml = code.includes("<html");
  const hasClosingHtml = code.includes("</html>");
  if (hasScript && !hasClosingScript) {
    return json({ success: false, error: "生成的游戏代码不完整（缺少</script>）" }, 500);
  }
  if (hasBody && !hasClosingBody) {
    return json({ success: false, error: "生成的游戏代码不完整（缺少</body>）" }, 500);
  }
  if (hasHtml && !hasClosingHtml) {
    return json({ success: false, error: "生成的游戏代码不完整（缺少</html>）" }, 500);
  }

  const titleMatch = code.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch?.[1] ? titleMatch[1] : prompt.slice(0, 50);

  if (draftId && authorToken) {
    const draft = await db
      .prepare("SELECT author_token FROM games WHERE id = ?")
      .bind(draftId)
      .first<{ author_token: string }>();
    if (draft && draft.author_token === authorToken) {
      const gameOrientation = (advancedSettings?.orientation as string) || "portrait";
      const gameVisibility = (advancedSettings?.visibility as string) || "public";
      const isPublic = gameVisibility === "public" ? 1 : 0;
      await db
        .prepare(
          `UPDATE games SET title = ?, code = ?, status = 'published', orientation = ?, visibility = ?, is_public = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .bind(title, code, gameOrientation, gameVisibility, isPublic, draftId)
        .run();
    }
  }

  const totalTime = apiTime;
  return json({
    success: true,
    code,
    title,
    prompt,
    draftId: draftId || null,
    debug: {
      codeLength: code.length,
      apiTime,
      totalTime,
      tokens: usage,
      keySource,
    },
  });
}
