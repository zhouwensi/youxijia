import type { PagesFunction } from "@cloudflare/workers-types";
import type { Env } from "../types";
import { corsHeaders } from "../lib/http";
import { dispatchApi } from "../lib/handlers";

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  const url = new URL(context.request.url);
  const wt = context.waitUntil?.bind(context);
  const res = await dispatchApi(context.request, context.env, url.pathname, wt ? { waitUntil: wt } : undefined);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders())) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, headers });
};
