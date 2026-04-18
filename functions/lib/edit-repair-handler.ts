/**
 * POST /api/games/:id/edit（start / message / save）
 * POST /api/games/:id/repair + GET /api/games/:id/repair-status（异步 waitUntil + repair_tasks）
 */
import type { Env } from "../types";
import { json, type Db } from "./http";
import { getConfig } from "./db";
import { LLM_MODELS, getModelMaxTokens, isModelEnabled } from "./llm-models";
import {
  extractHtmlFromResponse,
  chatUrl,
  callOpenAiCompatible,
  callAnthropic,
} from "./generate-handler";
import { getUserTokenFromRequest, isUserAdmin } from "./cf-helpers";
import type { RouteCtx } from "./routes-remaining";

const EDIT_SYSTEM_PROMPT = `你是一个专业的HTML5游戏优化专家。用户会给你一个已有的HTML游戏代码，然后提出修改需求。

【核心要求】：
1. 理解现有代码的逻辑和结构，在此基础上进行修改
2. 尽量保持原有功能不被破坏
3. 只修改必要的部分，不要重写整个代码
4. 保持代码风格一致

【内容合规要求】：
1. 游戏内容必须健康积极
2. 不得添加违法、暴力、色情、赌博等不良内容
3. 适合全年龄段用户

【技术要求】：
1. 返回完整的HTML文件（包含<!DOCTYPE html>、<html>、<head>、<body>）
2. 所有CSS写在<style>标签内，JS写在<script>标签内
3. 确保游戏在修改后仍能正常运行
4. 保持手机和电脑的兼容性

【输出格式】：
只返回完整的HTML代码，用\`\`\`html和\`\`\`包裹，不要有任何解释文字。`;

function getEditSuggestions(code: string): string[] {
  const suggestions: string[] = [];
  if (!code.includes("audio") && !code.includes("Audio")) suggestions.push("🔊 添加背景音乐和音效");
  if (!code.includes("localStorage")) suggestions.push("💾 添加存档功能");
  if (!code.includes("level") && !code.includes("关卡")) suggestions.push("🎯 添加多个难度等级");
  if (!code.includes("particle") && !code.includes("粒子")) suggestions.push("✨ 添加粒子特效");
  if (!code.includes("pause") && !code.includes("暂停")) suggestions.push("⏸️ 添加暂停功能");
  if (suggestions.length === 0) {
    suggestions.push("🎮 优化游戏手感", "📱 改善移动端体验", "🏆 添加成就系统");
  }
  return suggestions.slice(0, 5);
}

function detectCodeChanges(oldCode: string, newCode: string): string[] {
  const changes: string[] = [];
  if (newCode.length > oldCode.length * 1.1) changes.push("增加了新功能");
  if (newCode.includes("audio") && !oldCode.includes("audio")) changes.push("添加了音效");
  if (newCode.includes("particle") && !oldCode.includes("particle")) changes.push("添加了粒子效果");
  return changes.length > 0 ? changes : ["代码已更新"];
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function resolveLlm(
  env: Env,
  db: Db,
  llmConfig: Record<string, unknown> | undefined,
): Promise<{
  apiKey: string;
  finalModel: string;
  finalProvider: string;
  finalBaseUrl: string;
  selectedModelId: string | null;
} | null> {
  const defaultModelKey = (await getConfig(db, "llm_default_model", "deepseek-v3")) || "deepseek-v3";
  const defaultApiKey =
    env.LLM_DEFAULT_API_KEY || (await getConfig(db, "llm_default_api_key", "")) || "";
  const defaultBaseUrlEnv = env.LLM_DEFAULT_BASE_URL || "";
  const requestedModelId = (llmConfig?.provider as string) || null;
  const useUserApiKey = Boolean(llmConfig?.apiKey && String(llmConfig.apiKey).length > 0);

  let selectedModelId: string | null = null;
  let finalModel: string;
  let finalProvider: string;
  let finalBaseUrl: string;

  if (requestedModelId && LLM_MODELS[requestedModelId]) {
    if (!(await isModelEnabled(db, requestedModelId))) return null;
    const mc = LLM_MODELS[requestedModelId];
    finalModel = mc.model;
    finalProvider = mc.provider;
    finalBaseUrl = mc.baseUrl;
    selectedModelId = requestedModelId;
  } else if (requestedModelId === "custom" && useUserApiKey) {
    finalModel = String(llmConfig?.model || "deepseek-chat");
    finalProvider = "custom";
    finalBaseUrl = String(llmConfig?.baseUrl || "https://api.deepseek.com");
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
  if (useUserApiKey && String(llmConfig?.apiKey).length > 0) apiKey = String(llmConfig?.apiKey);
  else if (modelSpecificKey) apiKey = modelSpecificKey;
  else if (defaultApiKey) apiKey = defaultApiKey;

  let base = finalBaseUrl;
  if (defaultBaseUrlEnv && (apiKey === defaultApiKey || finalProvider === "custom")) {
    base = defaultBaseUrlEnv.replace(/\/$/, "");
  }

  if (!apiKey) return null;
  return { apiKey, finalModel, finalProvider, finalBaseUrl: base, selectedModelId };
}

async function runRepairInBackground(
  env: Env,
  db: Db,
  gameId: string,
  game: Record<string, unknown>,
  creditCost: number,
  userToken: string,
  isAdmin: boolean,
) {
  const taskId = `repair_${gameId}_${Date.now()}`;
  const repairPrompt = `你是一个专业的前端代码修复专家。请分析以下HTML游戏代码，找出并修复其中的错误。

原始游戏代码：
\`\`\`html
${String(game.code || "")}
\`\`\`

请：
1. 仔细分析代码中的所有问题
2. 修复所有发现的问题
3. 确保游戏能正常运行

输出格式要求：
1. 首先输出修复摘要（列出修复了哪些问题），用 【修复摘要】 标记
2. 然后输出完整的修复后代码，用 \`\`\`html 包裹

示例：
【修复摘要】
1. 修复了XXX问题

\`\`\`html
<!DOCTYPE html>
</html>
\`\`\``;

  const startTime = Date.now();
  try {
    const resolved = await resolveLlm(env, db, undefined);
    if (!resolved) {
      await db
        .prepare(
          "UPDATE repair_tasks SET status = ?, message = ?, detail_json = ?, updated_at = datetime('now') WHERE game_id = ?",
        )
        .bind("failed", "未配置 API Key", JSON.stringify({ taskId, error: "no_api_key", endTime: Date.now() }), gameId)
        .run();
      if (!isAdmin && creditCost > 0) {
        await db
          .prepare(
            "UPDATE user_credits SET credits = credits + ?, total_used = total_used - ?, updated_at = datetime('now') WHERE user_token = ?",
          )
          .bind(creditCost, creditCost, userToken)
          .run();
      }
      return;
    }
    const { apiKey, finalModel, finalProvider, finalBaseUrl } = resolved;
    const maxTokens = 16000;
    let rawText: string;
    if (finalProvider === "anthropic") {
      const r = await callAnthropic({
        baseUrl: finalBaseUrl,
        apiKey,
        model: finalModel,
        system: "你是一个专业的游戏代码修复专家，擅长分析和修复HTML/CSS/JavaScript代码中的问题。",
        user: repairPrompt,
        maxTokens,
      });
      rawText = r.text;
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
        system: "你是一个专业的游戏代码修复专家，擅长分析和修复HTML/CSS/JavaScript代码中的问题。",
        user: repairPrompt,
        maxTokens,
        extraHeaders: extra,
      });
      rawText = r.text;
    }

    let repairSummary = "";
    const summaryMatch = rawText.match(/【修复摘要】([\s\S]*?)```/);
    if (summaryMatch) repairSummary = summaryMatch[1].trim();

    const repairedCode = extractHtmlFromResponse(rawText);
    if (!repairedCode || repairedCode.length < 100) {
      await db
        .prepare(
          "UPDATE repair_tasks SET status = ?, message = ?, detail_json = ?, updated_at = datetime('now') WHERE game_id = ?",
        )
        .bind(
          "failed",
          "AI未返回有效的修复代码",
          JSON.stringify({ taskId, error: "bad_code", endTime: Date.now() }),
          gameId,
        )
        .run();
      if (!isAdmin && creditCost > 0) {
        await db
          .prepare(
            "UPDATE user_credits SET credits = credits + ?, total_used = total_used - ?, updated_at = datetime('now') WHERE user_token = ?",
          )
          .bind(creditCost, creditCost, userToken)
          .run();
      }
      return;
    }

    await db
      .prepare("UPDATE games SET code = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(repairedCode, gameId)
      .run();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    await db
      .prepare(
        "UPDATE repair_tasks SET status = ?, message = ?, detail_json = ?, updated_at = datetime('now') WHERE game_id = ?",
      )
      .bind(
        "completed",
        "修复完成",
        JSON.stringify({
          taskId,
          status: "completed",
          repairSummary: repairSummary || "已完成代码分析和修复",
          endTime: Date.now(),
          duration,
        }),
        gameId,
      )
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .prepare(
        "UPDATE repair_tasks SET status = ?, message = ?, detail_json = ?, updated_at = datetime('now') WHERE game_id = ?",
      )
      .bind("failed", msg, JSON.stringify({ taskId, error: msg, endTime: Date.now() }), gameId)
      .run();
    if (!isAdmin && creditCost > 0) {
      await db
        .prepare(
          "UPDATE user_credits SET credits = credits + ?, total_used = total_used - ?, updated_at = datetime('now') WHERE user_token = ?",
        )
        .bind(creditCost, creditCost, userToken)
        .run();
    }
  }
}

export async function tryEditRepair(ctx: RouteCtx): Promise<Response | null> {
  const { request, env, db, method, segs, waitUntil } = ctx;
  if (segs[0] !== "games" || segs.length < 3) return null;
  const gameId = segs[1];
  const tail = segs[2];

  const userToken =
    getUserTokenFromRequest(request) || request.headers.get("X-Author-Token");

  if (method === "POST" && tail === "edit") {
    if (!userToken) return json({ success: false, error: "请先登录" }, 401);
    const game = await db
      .prepare("SELECT * FROM games WHERE id = ?")
      .bind(gameId)
      .first<Record<string, unknown>>();
    if (!game) return json({ success: false, error: "游戏不存在" }, 404);
    const isAuthor = game.author_token === userToken;
    const admin = await isUserAdmin(db, userToken);
    const isPublicGame = game.is_public === 1 && game.visibility === "public";
    if (!isAuthor && !(admin && isPublicGame)) {
      if (admin && !isPublicGame) {
        return json({ success: false, error: "管理员只能编辑公开可见的游戏" }, 403);
      }
      return json({ success: false, error: "只能编辑自己的游戏" }, 403);
    }

    const body = await readJson(request);
    const action = String(body.action || "");
    if (!action) return json({ success: false, error: "缺少 action 参数" }, 400);

    if (action === "start") {
      const sessionId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO game_edit_sessions (id, game_id, user_token, original_code, current_code)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(sessionId, game.id, userToken, game.code, game.code)
        .run();
      const existingVersions = await db
        .prepare("SELECT COUNT(*) AS c FROM game_versions WHERE game_id = ?")
        .bind(String(game.id))
        .first<{ c: number }>();
      if ((existingVersions?.c ?? 0) === 0) {
        await db
          .prepare(
            `INSERT INTO game_versions (game_id, version_number, code, change_summary, created_by)
             VALUES (?, 1, ?, '初始版本', ?)`,
          )
          .bind(String(game.id), String(game.code), userToken)
          .run();
      }
      return json({
        success: true,
        sessionId,
        game: { id: game.id, title: game.title, prompt: game.prompt, code: game.code },
        suggestions: getEditSuggestions(String(game.code || "")),
      });
    }

    if (action === "message") {
      const sessionId = String(body.sessionId || "");
      const message = String(body.message || "").trim();
      if (!sessionId) return json({ success: false, error: "缺少会话ID" }, 400);
      if (!message) return json({ success: false, error: "请输入修改要求" }, 400);
      const session = await db
        .prepare("SELECT * FROM game_edit_sessions WHERE id = ?")
        .bind(sessionId)
        .first<Record<string, unknown>>();
      if (!session) return json({ success: false, error: "编辑会话不存在或已过期" }, 404);
      if (session.user_token !== userToken) return json({ success: false, error: "无权访问此会话" }, 403);

      const history = await db
        .prepare(
          `SELECT role, content FROM game_edit_messages WHERE session_id = ? ORDER BY created_at ASC`,
        )
        .bind(sessionId)
        .all();

      const messages: { role: string; content: string }[] = [
        { role: "system", content: EDIT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `这是当前的游戏代码：\n\n\`\`\`html\n${session.current_code}\n\`\`\``,
        },
      ];
      for (const row of history.results || []) {
        const r = row as { role: string; content: string };
        messages.push({ role: r.role, content: r.content });
      }
      messages.push({ role: "user", content: `请按照以下要求修改游戏：${message}` });

      await db
        .prepare("INSERT INTO game_edit_messages (session_id, role, content) VALUES (?, 'user', ?)")
        .bind(sessionId, message)
        .run();

      const llmConfig = body.llmConfig as Record<string, unknown> | undefined;
      const resolved = await resolveLlm(env, db, llmConfig);
      if (!resolved) {
        return json(
          { success: false, error: "API Key 未配置，请在后台或环境变量中配置" },
          400,
        );
      }
      const { apiKey, finalModel, finalProvider, finalBaseUrl, selectedModelId } = resolved;
      const modelMaxTokens = selectedModelId ? await getModelMaxTokens(db, selectedModelId) : 8192;
      const startTime = Date.now();
      const userBlob = messages
        .filter((m) => m.role !== "system")
        .map((m) => `### ${m.role}\n${m.content}`)
        .join("\n\n");
      let rawText: string;
      let usageTotal = 0;
      if (finalProvider === "anthropic") {
        const r = await callAnthropic({
          baseUrl: finalBaseUrl,
          apiKey,
          model: finalModel,
          system: EDIT_SYSTEM_PROMPT,
          user: userBlob,
          maxTokens: modelMaxTokens,
        });
        rawText = r.text;
        usageTotal = 0;
      } else {
        const url = chatUrl(finalProvider, finalBaseUrl);
        const extra: Record<string, string> = {};
        if (finalProvider === "openrouter") {
          extra["HTTP-Referer"] = "https://youxijia.fun";
          extra["X-Title"] = "GameMaker AI Editor";
        }
        const r = await callOpenAiCompatible({
          url,
          apiKey,
          model: finalModel,
          system: EDIT_SYSTEM_PROMPT,
          user: userBlob,
          maxTokens: modelMaxTokens,
          extraHeaders: extra,
        });
        rawText = r.text;
        usageTotal = 0;
      }

      let newCode = extractHtmlFromResponse(rawText);
      newCode = newCode.replace(/^```html\s*\n?/gi, "").replace(/^```\s*\n?/gi, "").replace(/\n?```\s*$/gi, "");
      if (!newCode.includes("<html") && !newCode.includes("<!DOCTYPE")) {
        return json({ success: false, error: "AI返回的代码格式不正确，请重试" }, 400);
      }
      if (!newCode.includes("</html>") || !newCode.includes("</body>")) {
        return json({ success: false, error: "AI返回的代码不完整（缺少结束标签），请重试" }, 400);
      }

      await db
        .prepare(
          `INSERT INTO game_edit_messages (session_id, role, content, code_snapshot, tokens_used)
           VALUES (?, 'assistant', ?, ?, ?)`,
        )
        .bind(sessionId, "已完成修改", newCode, usageTotal)
        .run();
      await db
        .prepare(
          "UPDATE game_edit_sessions SET current_code = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(newCode, sessionId)
        .run();

      const apiTime = Date.now() - startTime;
      return json({
        success: true,
        code: newCode,
        message: "修改完成！可以预览效果或继续优化",
        changes: detectCodeChanges(String(session.current_code), newCode),
        tokensUsed: usageTotal,
        apiTime,
      });
    }

    if (action === "save") {
      const sessionId = String(body.sessionId || "");
      const saveAsNew = Boolean(body.saveAsNew);
      const title = body.title ? String(body.title) : "";
      if (!sessionId) return json({ success: false, error: "缺少会话ID" }, 400);
      const session = await db
        .prepare("SELECT * FROM game_edit_sessions WHERE id = ?")
        .bind(sessionId)
        .first<Record<string, unknown>>();
      if (!session) return json({ success: false, error: "会话不存在" }, 404);
      const codeToSave = String(session.current_code || "");
      if (!codeToSave.includes("</html>") || !codeToSave.includes("</body>")) {
        return json({ success: false, error: "代码不完整，无法保存。请重新编辑后再试。" }, 400);
      }
      if (saveAsNew) {
        const newGameId = crypto.randomUUID();
        const newTitle = title || `${String(game.title)} (编辑版)`;
        await db
          .prepare(
            `INSERT INTO games (id, title, prompt, code, author_name, author_token, llm_model, status, is_public, visibility)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'published', 1, 'public')`,
          )
          .bind(
            newGameId,
            newTitle,
            `${String(game.prompt)} [编辑优化]`,
            codeToSave,
            game.author_name,
            userToken,
            game.llm_model || "deepseek-v3",
          )
          .run();
        await db.prepare("UPDATE game_edit_sessions SET status = 'completed' WHERE id = ?").bind(sessionId).run();
        return json({ success: true, gameId: newGameId, title: newTitle, message: "已保存为新游戏" });
      }
      const latestVersion = await db
        .prepare("SELECT MAX(version_number) AS max_version FROM game_versions WHERE game_id = ?")
        .bind(String(game.id))
        .first<{ max_version: number | null }>();
      const newVersionNumber = (latestVersion?.max_version ?? 0) + 1;
      await db
        .prepare(
          `INSERT INTO game_versions (game_id, version_number, code, change_summary, created_by)
           VALUES (?, ?, ?, '编辑优化', ?)`,
        )
        .bind(String(game.id), newVersionNumber, codeToSave, userToken)
        .run();
      await db
        .prepare("UPDATE games SET code = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(codeToSave, String(game.id))
        .run();
      await db.prepare("UPDATE game_edit_sessions SET status = 'completed' WHERE id = ?").bind(sessionId).run();
      return json({
        success: true,
        gameId: game.id,
        version: newVersionNumber,
        message: "游戏已更新",
      });
    }

    return json({ success: false, error: "未知的操作类型" }, 400);
  }

  if (method === "POST" && tail === "repair") {
    const userHdr = getUserTokenFromRequest(request);
    if (!userHdr) return json({ success: false, error: "请先登录" }, 401);
    const body = await readJson(request);
    const creditCost = typeof body.creditCost === "number" ? body.creditCost : 0.5;

    const game = await db.prepare("SELECT * FROM games WHERE id = ?").bind(gameId).first<Record<string, unknown>>();
    if (!game) return json({ success: false, error: "游戏不存在" }, 404);
    const isAuthor = game.author_token === userHdr;
    const admin = await isUserAdmin(db, userHdr);
    if (!isAuthor && !admin) return json({ success: false, error: "只有游戏作者可以修复游戏" }, 403);

    const existing = await db
      .prepare("SELECT status, detail_json FROM repair_tasks WHERE game_id = ?")
      .bind(gameId)
      .first<{ status: string; detail_json: string | null }>();
    if (existing?.status === "running") {
      return json({
        success: true,
        message: "该游戏已有修复任务正在进行中，请稍后刷新页面查看",
        status: "already_running",
      });
    }

    const resolved = await resolveLlm(env, db, undefined);
    if (!resolved) {
      return json({ success: false, error: "系统未配置AI服务，请联系管理员" }, 500);
    }

    if (!admin) {
      const uc = await db
        .prepare("SELECT credits FROM user_credits WHERE user_token = ?")
        .bind(userHdr)
        .first<{ credits: number }>();
      if (!uc || uc.credits < creditCost) {
        return json(
          {
            success: false,
            error: `积分不足，修复需要 ${creditCost} 积分`,
            creditsNeeded: creditCost,
            creditsHave: uc?.credits ?? 0,
          },
          400,
        );
      }
      await db
        .prepare(
          "UPDATE user_credits SET credits = credits - ?, total_used = total_used + ?, updated_at = datetime('now') WHERE user_token = ?",
        )
        .bind(creditCost, creditCost, userHdr)
        .run();
      await db
        .prepare(
          "INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, 'repair_game', ?)",
        )
        .bind(userHdr, -creditCost, `AI修复游戏: ${String(game.title)}`)
        .run();
    }

    const detail = JSON.stringify({
      taskId: `repair_${gameId}_${Date.now()}`,
      status: "running",
      startTime: Date.now(),
      creditCost: admin ? 0 : creditCost,
      userToken: userHdr,
    });
    await db
      .prepare(
        `INSERT INTO repair_tasks (game_id, status, message, detail_json, user_token, updated_at)
         VALUES (?, 'running', ?, ?, ?, datetime('now'))
         ON CONFLICT(game_id) DO UPDATE SET status = excluded.status, message = excluded.message,
         detail_json = excluded.detail_json, user_token = excluded.user_token, updated_at = datetime('now')`,
      )
      .bind(gameId, "修复中", detail, userHdr)
      .run();

    const job = () => runRepairInBackground(env, db, gameId, game, creditCost, userHdr, admin);
    if (waitUntil) waitUntil(job());
    else await job();

    return json({
      success: true,
      message: "修复任务已启动！AI正在后台分析并修复代码，完成后请刷新页面查看。",
      gameId,
      status: "started",
    });
  }

  if (method === "GET" && tail === "repair-status") {
    const userHdr = getUserTokenFromRequest(request);
    const g = await db
      .prepare("SELECT author_token FROM games WHERE id = ?")
      .bind(gameId)
      .first<{ author_token: string }>();
    if (!g) return json({ success: false, error: "游戏不存在" }, 404);
    const admin = await isUserAdmin(db, userHdr);
    const isAuthor = g.author_token === userHdr;
    if (!isAuthor && !admin) return json({ success: false, error: "无权限查看" }, 403);

    const row = await db
      .prepare("SELECT status, message, detail_json FROM repair_tasks WHERE game_id = ?")
      .bind(gameId)
      .first<{ status: string | null; message: string | null; detail_json: string | null }>();
    if (!row || !row.status || row.status === "none") {
      return json({ success: true, status: "none", message: "没有进行中的修复任务" });
    }
    let extra: Record<string, unknown> = {};
    if (row.detail_json) {
      try {
        extra = JSON.parse(row.detail_json) as Record<string, unknown>;
      } catch {
        extra = {};
      }
    }
    return json({
      success: true,
      status: row.status,
      message: row.message,
      ...extra,
    });
  }

  return null;
}
