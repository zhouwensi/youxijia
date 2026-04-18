export interface Env {
  YOUXIJIA_DB: D1Database;
  /** wrangler secret，优先于 D1 的 llm_default_api_key */
  LLM_DEFAULT_API_KEY?: string;
  LLM_DEFAULT_BASE_URL?: string;
  /** 与 Node 版 X-Admin-Key 一致；建议用 wrangler secret 注入 */
  ADMIN_KEY?: string;
  /** 微信小程序 AppID（Secret，勿提交仓库） */
  WX_MINI_APPID?: string;
  /** 微信小程序 AppSecret（Secret） */
  WX_MINI_SECRET?: string;
}
