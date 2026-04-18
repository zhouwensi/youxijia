/**
 * 幂等：解析/创建 D1「youxijia-db」并写入 wrangler.toml 的 database_id
 * 需已 wrangler 登录或设置 CLOUDFLARE_API_TOKEN
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tomlPath = path.join(root, "wrangler.toml");

const D1_NAME = "youxijia-db";
const PLACEHOLDER_DB_ID = "00000000-0000-4000-8000-000000000001";

function isProvisionedDbId(id) {
  return Boolean(id && id.includes("-") && id !== PLACEHOLDER_DB_ID);
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: "utf-8", cwd: root, stdio: ["pipe", "pipe", "pipe"] });
}

function uuidFromText(text) {
  const m = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

function readToml() {
  return fs.readFileSync(tomlPath, "utf-8");
}

function writeToml(content) {
  fs.writeFileSync(tomlPath, content, "utf-8");
}

function patchDatabaseId(content, value) {
  return content.replace(
    /^database_id = ".*"$/m,
    `database_id = "${value}"`,
  );
}

function getDbId(content) {
  const m = content.match(/^database_id = "([^"]*)"$/m);
  return m?.[1]?.trim() ?? "";
}

function parseD1InfoJson(out) {
  try {
    const j = JSON.parse(out);
    const id =
      j.uuid ?? j.database_id ?? j.id ?? j.result?.uuid ?? j.result?.database_id ?? null;
    return typeof id === "string" && id.includes("-") ? id : null;
  } catch {
    return null;
  }
}

function parseD1ListJson(out, name) {
  try {
    const j = JSON.parse(out);
    const arr = j.databases ?? j.result ?? j ?? [];
    const list = Array.isArray(arr) ? arr : [];
    const row = list.find((x) => (x.name ?? x.database_name) === name);
    const id = row?.uuid ?? row?.database_id;
    return typeof id === "string" && id.includes("-") ? id : null;
  } catch {
    return null;
  }
}

function ensureD1Id() {
  let content = readToml();
  let dbId = getDbId(content);
  if (isProvisionedDbId(dbId)) {
    console.log("[provision] D1 database_id 已配置，跳过创建。");
    return dbId;
  }

  console.log("[provision] 查找或创建 D1 数据库…");
  let dbIdResolved = null;

  try {
    const infoOut = runCapture(`npx wrangler d1 info ${D1_NAME} --json 2>&1`);
    dbIdResolved = parseD1InfoJson(infoOut) || uuidFromText(infoOut);
  } catch {
    /* ignore */
  }

  if (!dbIdResolved) {
    let createOut = "";
    try {
      createOut = runCapture(`npx wrangler d1 create ${D1_NAME} 2>&1`);
    } catch (e) {
      createOut = String(e.stdout || e.stderr || e.message || "");
    }
    dbIdResolved = parseD1InfoJson(createOut) || uuidFromText(createOut);
  }

  if (!dbIdResolved) {
    let listOut = "";
    try {
      listOut = runCapture(`npx wrangler d1 list --json 2>&1`);
      dbIdResolved = parseD1ListJson(listOut, D1_NAME);
    } catch (e) {
      listOut = String(e.stdout || e.stderr || e.message || "");
      dbIdResolved = parseD1ListJson(listOut, D1_NAME);
    }
  }

  if (!dbIdResolved) {
    throw new Error(
      `无法获取 D1 database_id。请执行 npm run login 后重试，或手动: npx wrangler d1 create ${D1_NAME}`,
    );
  }

  content = readToml();
  writeToml(patchDatabaseId(content, dbIdResolved));
  console.log("[provision] 已写入 D1 database_id:", dbIdResolved);
  return dbIdResolved;
}

function main() {
  console.log("[provision] 检查 Cloudflare 登录状态…");
  let who = "";
  try {
    who = runCapture("npx wrangler whoami 2>&1");
  } catch (e) {
    console.error(String(e.stderr || e.stdout || e.message || ""));
    console.error("\n请先登录：npm run login\n或设置 CLOUDFLARE_API_TOKEN\n");
    process.exit(1);
  }
  if (/not authenticated|Please run [`']wrangler login[`']/i.test(who)) {
    console.error(who);
    console.error("\n当前未登录 Cloudflare。请 npm run login 或设置 CLOUDFLARE_API_TOKEN。\n");
    process.exit(1);
  }

  ensureD1Id();
  console.log("[provision] 完成。可继续: npm run cf:db:remote && npm run cf:deploy");
}

main();
