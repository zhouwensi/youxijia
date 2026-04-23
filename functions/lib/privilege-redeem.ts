/**
 * 小程序权益兑换码发放、三站核销、通行证绑定、跨站权益 JSON。
 * 合规：兑换码仅表示权益类型，不承载外链；核销依赖本站 user_token 或 hub_link_tokens。
 */
import type { Env } from "../types";
import { json, type Db } from "./http";
import { getUserTokenFromRequest, sha256Hex, ipForRequest } from "./cf-helpers";

type PrivilegeRouteCtx = {
  request: Request;
  env: Env;
  db: Db;
  url: URL;
  method: string;
  segs: string[];
};

const RANDOM_ALPHANUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type ClaimKind =
  | "YXS_BASIC"
  | "YXS_PREMIUM"
  | "MYN_BASIC"
  | "MYN_PREMIUM"
  | "CSC_BASIC"
  | "CSC_PREMIUM";

type ClaimSpec = {
  prefix: "YXS" | "MYN" | "CSC";
  tier: "basic" | "premium";
  dailyLimit: number;
  credits: number;
  /** 写入 user_cross_entitlements 的增量（按 site 合并） */
  entPatch: Record<string, Record<string, unknown>>;
};

const CLAIM_SPECS: Record<ClaimKind, ClaimSpec> = {
  YXS_BASIC: {
    prefix: "YXS",
    tier: "basic",
    dailyLimit: 1,
    credits: 1,
    entPatch: { YIJUHUA: {} },
  },
  YXS_PREMIUM: {
    prefix: "YXS",
    tier: "premium",
    dailyLimit: 3,
    credits: 3,
    entPatch: {
      YIJUHUA: {
        listBoostDays: 7,
      },
    },
  },
  MYN_BASIC: {
    prefix: "MYN",
    tier: "basic",
    dailyLimit: 1,
    credits: 0.5,
    entPatch: {
      YOUXIMUDI: {
        offeringsDelta: { flower: 10, rose: 0, candle: 0 },
        wallForever: true,
      },
    },
  },
  MYN_PREMIUM: {
    prefix: "MYN",
    tier: "premium",
    dailyLimit: 2,
    credits: 2,
    entPatch: {
      YOUXIMUDI: {
        offeringsDelta: { flower: 30, rose: 30, candle: 30 },
        messagePinDays: 30,
        priorityReviewDays: 30,
      },
    },
  },
  CSC_BASIC: {
    prefix: "CSC",
    tier: "basic",
    dailyLimit: 1,
    credits: 0.5,
    entPatch: { XIYOU: { fullReportBasic: true } },
  },
  CSC_PREMIUM: {
    prefix: "CSC",
    tier: "premium",
    dailyLimit: 2,
    credits: 2,
    entPatch: {
      XIYOU: {
        allQuizDays: 30,
        duoFit: true,
        deepJob: true,
        exportHd: true,
      },
    },
  },
};

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function randomSuffix5(): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += RANDOM_ALPHANUM[Math.floor(Math.random() * RANDOM_ALPHANUM.length)];
  }
  return s;
}

async function genUniqueCode(db: Db, prefix: "YXS" | "MYN" | "CSC"): Promise<string> {
  for (let i = 0; i < 80; i++) {
    const code = prefix + randomSuffix5();
    const row = await db.prepare("SELECT 1 AS x FROM privilege_redeem_codes WHERE code = ?").bind(code).first();
    if (!row) return code;
  }
  return prefix + randomSuffix5() + String(Math.floor(Math.random() * 9));
}

async function readBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

async function getOpenidForToken(db: Db, userToken: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT mp_openid FROM user_accounts WHERE user_token = ?")
    .bind(userToken)
    .first<{ mp_openid: string | null }>();
  const o = row?.mp_openid;
  return o && String(o).trim() ? String(o).trim() : null;
}

async function getDailyClaimCount(db: Db, openid: string, claimKind: string, date: string): Promise<number> {
  const row = await db
    .prepare(
      "SELECT claim_count FROM privilege_claim_daily WHERE mp_openid = ? AND claim_key = ? AND claim_date = ?",
    )
    .bind(openid, claimKind, date)
    .first<{ claim_count: number }>();
  return row?.claim_count ?? 0;
}

async function incrDailyClaim(db: Db, openid: string, claimKind: string, date: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO privilege_claim_daily (mp_openid, claim_key, claim_count, claim_date)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(mp_openid, claim_key, claim_date) DO UPDATE SET claim_count = claim_count + 1`,
    )
    .bind(openid, claimKind, date)
    .run();
}

async function getIpClaimCount(db: Db, ip: string, claimKind: string, date: string): Promise<number> {
  const row = await db
    .prepare("SELECT claim_count FROM privilege_claim_ip_daily WHERE ip = ? AND claim_key = ? AND claim_date = ?")
    .bind(ip, claimKind, date)
    .first<{ claim_count: number }>();
  return row?.claim_count ?? 0;
}

async function bumpIpClaim(db: Db, ip: string, claimKind: string, date: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO privilege_claim_ip_daily (ip, claim_key, claim_count, claim_date)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(ip, claim_key, claim_date) DO UPDATE SET claim_count = claim_count + 1`,
    )
    .bind(ip, claimKind, date)
    .run();
}

/** 同一 IP 单日同类领取上限（防刷），与 openid 限制叠加 */
const IP_DAILY_CAP = 200;

async function addCreditsAndLedger(
  db: Db,
  userToken: string,
  delta: number,
  reason: string,
  refCode: string | null,
  site: string | null,
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO user_credits (user_token, credits, total_earned) VALUES (?, ?, ?)
       ON CONFLICT(user_token) DO UPDATE SET
         credits = credits + excluded.credits,
         total_earned = total_earned + excluded.total_earned,
         updated_at = datetime('now')`,
    )
    .bind(userToken, delta, Math.max(0, delta))
    .run();
  const row = await db
    .prepare("SELECT credits FROM user_credits WHERE user_token = ?")
    .bind(userToken)
    .first<{ credits: number }>();
  const bal = row?.credits ?? 0;
  await db
    .prepare(
      "INSERT INTO gamer_points_ledger (user_token, delta, balance_after, reason, ref_code, site) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(userToken, delta, bal, reason, refCode, site)
    .run();
  return bal;
}

function deepMergeEnt(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && out[k] && !Array.isArray(out[k])) {
      out[k] = deepMergeEnt(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function mergeOfferingsDelta(
  db: Db,
  userToken: string,
  site: string,
  delta: Record<string, number>,
): Promise<void> {
  const row = await db
    .prepare("SELECT payload FROM user_cross_entitlements WHERE user_token = ? AND site = ?")
    .bind(userToken, site)
    .first<{ payload: string }>();
  let payload: Record<string, unknown> = {};
  if (row?.payload) {
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }
  const off = (payload.offerings as Record<string, number>) || { flower: 0, rose: 0, candle: 0 };
  for (const [k, n] of Object.entries(delta)) {
    off[k] = (off[k] || 0) + n;
  }
  payload.offerings = off;
  await db
    .prepare(
      `INSERT INTO user_cross_entitlements (user_token, site, payload, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_token, site) DO UPDATE SET payload = excluded.payload, updated_at = datetime('now')`,
    )
    .bind(userToken, site, JSON.stringify(payload))
    .run();
}

async function applyEntitlements(db: Db, userToken: string, patch: Record<string, Record<string, unknown>>) {
  const now = new Date();
  const plusDays = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();

  for (const [site, p] of Object.entries(patch)) {
    if (!p || typeof p !== "object") continue;
    const row = await db
      .prepare("SELECT payload FROM user_cross_entitlements WHERE user_token = ? AND site = ?")
      .bind(userToken, site)
      .first<{ payload: string }>();
    let payload: Record<string, unknown> = {};
    if (row?.payload) {
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        payload = {};
      }
    }

    if (site === "YIJUHUA" && typeof p.listBoostDays === "number") {
      const days = p.listBoostDays as number;
      const until = plusDays(days);
      const prev = typeof payload.listBoostUntil === "string" ? new Date(payload.listBoostUntil as string).getTime() : 0;
      const next = Math.max(prev, new Date(until).getTime());
      payload.listBoostUntil = new Date(next).toISOString();
    }

    if (site === "YOUXIMUDI") {
      const od = p.offeringsDelta as Record<string, number> | undefined;
      if (od) await mergeOfferingsDelta(db, userToken, site, od);
      const row2 = await db
        .prepare("SELECT payload FROM user_cross_entitlements WHERE user_token = ? AND site = ?")
        .bind(userToken, site)
        .first<{ payload: string }>();
      payload = row2?.payload ? (JSON.parse(row2.payload) as Record<string, unknown>) : {};
      if (p.wallForever === true) payload.wallForever = true;
      if (typeof p.messagePinDays === "number") {
        const until = plusDays(p.messagePinDays);
        const prev =
          typeof payload.messagePinUntil === "string" ? new Date(payload.messagePinUntil as string).getTime() : 0;
        payload.messagePinUntil = new Date(Math.max(prev, new Date(until).getTime())).toISOString();
      }
      if (typeof p.priorityReviewDays === "number") {
        const until = plusDays(p.priorityReviewDays);
        const prev =
          typeof payload.priorityReviewUntil === "string"
            ? new Date(payload.priorityReviewUntil as string).getTime()
            : 0;
        payload.priorityReviewUntil = new Date(Math.max(prev, new Date(until).getTime())).toISOString();
      }
    }

    if (site === "XIYOU") {
      payload = deepMergeEnt(payload, p as Record<string, unknown>);
      if (typeof (p as { allQuizDays?: number }).allQuizDays === "number") {
        const d = (p as { allQuizDays: number }).allQuizDays;
        const until = plusDays(d);
        const prev =
          typeof payload.allQuizUntil === "string" ? new Date(payload.allQuizUntil as string).getTime() : 0;
        payload.allQuizUntil = new Date(Math.max(prev, new Date(until).getTime())).toISOString();
      }
    }

    await db
      .prepare(
        `INSERT INTO user_cross_entitlements (user_token, site, payload, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(user_token, site) DO UPDATE SET payload = excluded.payload, updated_at = datetime('now')`,
      )
      .bind(userToken, site, JSON.stringify(payload))
      .run();
  }
}

async function resolveUserTokenFromLink(db: Db, linkToken: string): Promise<string | null> {
  const t = String(linkToken || "").trim();
  if (!t || t.length < 16) return null;
  const row = await db
    .prepare("SELECT user_token FROM hub_link_tokens WHERE link_token = ?")
    .bind(t)
    .first<{ user_token: string }>();
  return row?.user_token ?? null;
}

async function verifyInternalForwardAsync(env: Env, site: string, bodyRaw: string, sig: string): Promise<boolean> {
  const s = String(site || "").trim();
  const secrets: Record<string, string | undefined> = {
    youximudi: env.HUB_SITE_SECRET_YOUXIMUDI,
    xiyou: env.HUB_SITE_SECRET_XIYOU,
  };
  const secret = secrets[s];
  if (!secret || !sig) return false;
  const hex = await sha256Hex(secret + ":" + bodyRaw);
  return sig === hex;
}

export async function tryPrivilegeRoutes(ctx: PrivilegeRouteCtx): Promise<Response | null> {
  const { request, env, db, method, segs, url } = ctx;
  const h = (n: string) => request.headers.get(n);

  if (method === "POST" && segs[0] === "mp" && segs[1] === "privilege" && segs[2] === "claim") {
    const platform = (h("x-platform") || "").toLowerCase();
    if (platform !== "miniprogram") {
      return json({ success: false, error: "请在微信小程序内领取" }, 403);
    }
    const userToken = getUserTokenFromRequest(request);
    if (!userToken) return json({ success: false, error: "请先登录" }, 401);
    const openid = await getOpenidForToken(db, userToken);
    if (!openid) return json({ success: false, error: "请重新微信登录" }, 401);

    const body = await readBody<{ kind?: string }>(request);
    const kind = String(body.kind || "").toUpperCase() as ClaimKind;
    const spec = CLAIM_SPECS[kind];
    if (!spec) return json({ success: false, error: "无效的权益类型" }, 400);

    const date = todayUtcDate();
    const used = await getDailyClaimCount(db, openid, kind, date);
    if (used >= spec.dailyLimit) {
      return json({ success: false, error: "今日领取次数已达上限", exhausted: true }, 400);
    }

    const ip = ipForRequest(request);
    if (ip) {
      const ipCount = await getIpClaimCount(db, ip, kind, date);
      if (ipCount >= IP_DAILY_CAP) {
        return json({ success: false, error: "网络繁忙，请明日再试" }, 429);
      }
      await bumpIpClaim(db, ip, kind, date);
    }

    const code = await genUniqueCode(db, spec.prefix);
    const expiresAt = await db
      .prepare("SELECT datetime('now', '+7 days') AS e")
      .first<{ e: string }>();
    const exp = expiresAt?.e || "";

    await db
      .prepare(
        `INSERT INTO privilege_redeem_codes (code, kind, tier, mp_openid, user_token, credits_on_redeem, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(code, kind, spec.tier, openid, userToken, spec.credits, exp)
      .run();

    await incrDailyClaim(db, openid, kind, date);

    return json({
      success: true,
      code,
      kind,
      tier: spec.tier,
      creditsOnRedeem: spec.credits,
      expiresAt: exp,
      message: "领取成功",
    });
  }

  if (method === "GET" && segs[0] === "mp" && segs[1] === "privilege" && segs[2] === "quotas") {
    const platform = (h("x-platform") || "").toLowerCase();
    if (platform !== "miniprogram") return json({ success: false, error: "forbidden" }, 403);
    const userToken = getUserTokenFromRequest(request);
    if (!userToken) return json({ success: false, error: "请先登录" }, 401);
    const openid = await getOpenidForToken(db, userToken);
    if (!openid) return json({ success: false, error: "请重新微信登录" }, 401);
    const date = todayUtcDate();
    const quotas: Record<string, { used: number; limit: number }> = {};
    for (const kind of Object.keys(CLAIM_SPECS) as ClaimKind[]) {
      const spec = CLAIM_SPECS[kind];
      const used = await getDailyClaimCount(db, openid, kind, date);
      quotas[kind] = { used, limit: spec.dailyLimit };
    }
    return json({ success: true, quotas });
  }

  if (method === "GET" && segs[0] === "mp" && segs[1] === "privilege" && segs[2] === "my-codes") {
    const platform = (h("x-platform") || "").toLowerCase();
    if (platform !== "miniprogram") return json({ success: false, error: "请在微信小程序内查看" }, 403);
    const userToken = getUserTokenFromRequest(request);
    if (!userToken) return json({ success: false, error: "请先登录" }, 401);

    const rows = await db
      .prepare(
        `SELECT code, kind, tier, credits_on_redeem AS creditsOnRedeem, created_at AS createdAt,
                expires_at AS expiresAt, used_at AS usedAt, used_site AS usedSite
         FROM privilege_redeem_codes WHERE user_token = ? ORDER BY id DESC LIMIT 200`,
      )
      .bind(userToken)
      .all();

    const list = (rows.results || []).map((r: Record<string, unknown>) => {
      const usedAt = r.usedAt ? String(r.usedAt) : "";
      const exp = String(r.expiresAt || "");
      const expired = !usedAt && exp && new Date(exp.replace(" ", "T")).getTime() < Date.now();
      let status = "pending";
      if (usedAt) status = "used";
      else if (expired) status = "expired";
      return { ...r, status };
    });

    return json({ success: true, items: list });
  }

  if (method === "POST" && segs[0] === "hub" && segs[1] === "link-token" && segs[2] === "create") {
    const userToken = getUserTokenFromRequest(request);
    if (!userToken) return json({ success: false, error: "请先登录" }, 401);
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const linkToken = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    await db
      .prepare("INSERT INTO hub_link_tokens (link_token, user_token) VALUES (?, ?)")
      .bind(linkToken, userToken)
      .run();
    return json({
      success: true,
      linkToken,
      hint: "在其它站点「背包 / 我的权益」中粘贴此通行证密钥，即可与当前账号共享三站通用积分与核销权益。",
    });
  }

  if (method === "GET" && segs[0] === "hub" && segs[1] === "points-ledger") {
    const userToken = getUserTokenFromRequest(request);
    const link = String(url.searchParams.get("linkToken") || "").trim();
    let token = userToken;
    if (!token && link) token = (await resolveUserTokenFromLink(db, link)) || "";
    if (!token) return json({ success: false, error: "请先登录或提供通行证密钥" }, 401);

    const rows = await db
      .prepare(
        `SELECT id, delta, balance_after AS balanceAfter, reason, ref_code AS refCode, site, created_at AS createdAt
         FROM gamer_points_ledger WHERE user_token = ? ORDER BY id DESC LIMIT 100`,
      )
      .bind(token)
      .all();
    const uc = await db
      .prepare("SELECT credits FROM user_credits WHERE user_token = ?")
      .bind(token)
      .first<{ credits: number }>();
    return json({
      success: true,
      balance: uc?.credits ?? 0,
      items: rows.results || [],
    });
  }

  if (method === "GET" && segs[0] === "hub" && segs[1] === "cross-entitlements") {
    const site = String(url.searchParams.get("site") || "").trim();
    if (!site) return json({ success: false, error: "缺少 site" }, 400);
    const userToken = getUserTokenFromRequest(request);
    const link = String(url.searchParams.get("linkToken") || "").trim();
    let token = userToken;
    if (!token && link) token = (await resolveUserTokenFromLink(db, link)) || "";
    if (!token) return json({ success: false, error: "请先登录或提供通行证密钥" }, 401);

    const row = await db
      .prepare("SELECT payload, updated_at AS updatedAt FROM user_cross_entitlements WHERE user_token = ? AND site = ?")
      .bind(token, site)
      .first<{ payload: string; updatedAt: string }>();
    let payload: Record<string, unknown> = {};
    if (row?.payload) {
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        payload = {};
      }
    }
    const uc = await db
      .prepare("SELECT credits FROM user_credits WHERE user_token = ?")
      .bind(token)
      .first<{ credits: number }>();
    return json({ success: true, site, payload, credits: uc?.credits ?? 0, updatedAt: row?.updatedAt || null });
  }

  async function doRedeem(codeRaw: string, redeemerToken: string, usedSite: string): Promise<Response> {
    const code = String(codeRaw || "").trim().toUpperCase();
    if (code.length !== 8) return json({ success: false, error: "兑换码格式不正确" }, 400);

    const row = await db
      .prepare(
        `SELECT id, kind, tier, credits_on_redeem AS creditsOnRedeem, expires_at AS expiresAt, used_at AS usedAt, user_token AS issuerToken
         FROM privilege_redeem_codes WHERE code = ?`,
      )
      .bind(code)
      .first<{
        id: number;
        kind: string;
        creditsOnRedeem: number;
        expiresAt: string;
        usedAt: string | null;
        issuerToken: string;
      }>();
    if (!row) return json({ success: false, error: "兑换码不存在" }, 404);
    if (row.usedAt) return json({ success: false, error: "兑换码已使用" }, 400);
    const expMs = new Date(String(row.expiresAt).replace(" ", "T")).getTime();
    if (expMs < Date.now()) return json({ success: false, error: "兑换码已过期" }, 400);

    const kind = String(row.kind).toUpperCase() as ClaimKind;
    const spec = CLAIM_SPECS[kind];
    if (!spec) return json({ success: false, error: "兑换码类型已失效" }, 400);

    await db
      .prepare(
        `UPDATE privilege_redeem_codes SET used_at = datetime('now'), used_site = ?, used_user_token = ? WHERE id = ?`,
      )
      .bind(usedSite, redeemerToken, row.id)
      .run();

    const credits = Number(row.creditsOnRedeem) || spec.credits;
    if (credits !== 0) {
      await addCreditsAndLedger(db, redeemerToken, credits, `核销兑换码 ${code}`, code, usedSite);
    }
    await applyEntitlements(db, redeemerToken, spec.entPatch);

    const uc = await db
      .prepare("SELECT credits FROM user_credits WHERE user_token = ?")
      .bind(redeemerToken)
      .first<{ credits: number }>();

    return json({
      success: true,
      message: "核销成功",
      creditsGranted: credits,
      balance: uc?.credits ?? 0,
      kind,
    });
  }

  if (method === "POST" && segs[0] === "hub" && segs[1] === "privilege" && segs[2] === "redeem") {
    const body = await readBody<{ code?: string; linkToken?: string }>(request);
    const code = String(body.code || "");
    let redeemerToken = getUserTokenFromRequest(request);
    const link = String(body.linkToken || "").trim();
    if (!redeemerToken && link) redeemerToken = (await resolveUserTokenFromLink(db, link)) || "";
    if (!redeemerToken) return json({ success: false, error: "请先登录本站账号，或在表单中填写通行证密钥" }, 401);
    return doRedeem(code, redeemerToken, "YIJUHUA");
  }

  if (method === "POST" && segs[0] === "internal" && segs[1] === "hub" && segs[2] === "redeem") {
    const site = String(h("x-internal-site") || "").trim().toLowerCase();
    const sig = String(h("x-internal-signature") || "").trim();
    const bodyRaw = await request.text();
    const ok = await verifyInternalForwardAsync(env, site, bodyRaw, sig);
    if (!ok) return json({ success: false, error: "签名校验失败" }, 403);
    let body: { code?: string; linkToken?: string };
    try {
      body = JSON.parse(bodyRaw || "{}") as { code?: string; linkToken?: string };
    } catch {
      return json({ success: false, error: "无效 JSON" }, 400);
    }
    const link = String(body.linkToken || "").trim();
    const redeemerToken = await resolveUserTokenFromLink(db, link);
    if (!redeemerToken) return json({ success: false, error: "缺少或无效的通行证密钥" }, 400);
    const usedSite = site === "youximudi" ? "YOUXIMUDI" : site === "xiyou" ? "XIYOU" : site.toUpperCase();
    return doRedeem(String(body.code || ""), redeemerToken, usedSite);
  }

  if (method === "POST" && segs[0] === "mp" && segs[1] === "privilege" && segs[2] === "interstitial-log") {
    const platform = (h("x-platform") || "").toLowerCase();
    if (platform !== "miniprogram") return json({ success: false, error: "forbidden" }, 403);
    const userToken = getUserTokenFromRequest(request);
    if (!userToken) return json({ success: false, error: "请先登录" }, 401);
    const openid = await getOpenidForToken(db, userToken);
    if (!openid) return json({ success: false, error: "请重新微信登录" }, 401);
    const date = todayUtcDate();
    const row = await db
      .prepare("SELECT show_count FROM mp_interstitial_daily WHERE mp_openid = ? AND ad_date = ?")
      .bind(openid, date)
      .first<{ show_count: number }>();
    const cur = row?.show_count ?? 0;
    if (cur >= 5) return json({ success: false, error: "今日展示次数已达上限", cap: 5 }, 400);
    await db
      .prepare(
        `INSERT INTO mp_interstitial_daily (mp_openid, ad_date, show_count) VALUES (?, ?, 1)
         ON CONFLICT(mp_openid, ad_date) DO UPDATE SET show_count = show_count + 1`,
      )
      .bind(openid, date)
      .run();
    return json({ success: true, shown: cur + 1 });
  }

  return null;
}
