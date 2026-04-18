/** 使用同一 KV 存游戏（key: game:{id}）+ 列表索引 games:index */

const INDEX_KEY = 'games:index';
const MAX_INDEX = 400;
const GAME_PREFIX = 'game:';

function nowIso() {
  return new Date().toISOString();
}

export async function getGame(kv, id) {
  if (!kv || !id) return null;
  const raw = await kv.get(`${GAME_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function putGame(kv, game) {
  await kv.put(`${GAME_PREFIX}${game.id}`, JSON.stringify(game));
}

export async function readIndex(kv) {
  const raw = await kv.get(INDEX_KEY);
  if (!raw) return [];
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

async function writeIndex(kv, list) {
  await kv.put(INDEX_KEY, JSON.stringify(list.slice(0, MAX_INDEX)));
}

async function appendAuthorIndex(kv, authorToken, id) {
  if (!authorToken) return;
  const k = `author:${authorToken}`;
  const raw = await kv.get(k);
  let ids = [];
  try {
    ids = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) ids = [];
  } catch {
    ids = [];
  }
  ids = ids.filter((x) => x !== id);
  ids.unshift(id);
  await kv.put(k, JSON.stringify(ids.slice(0, 200)));
}

/** 列表项不含 code，减小体积 */
function toListItem(g) {
  return {
    id: g.id,
    title: g.title,
    prompt: g.prompt,
    author_name: g.author_name,
    play_count: g.play_count || 0,
    like_count: g.like_count || 0,
    favorite_count: g.favorite_count || 0,
    created_at: g.created_at,
    orientation: g.orientation || 'portrait',
    status: g.status || 'published',
    comment_count: g.comment_count || 0,
    is_hidden: g.is_hidden ?? 0,
    is_featured: g.is_featured ?? 0,
  };
}

function withAliases(row) {
  if (!row) return row;
  return {
    ...row,
    likes: row.like_count || 0,
    plays: row.play_count || 0,
    favorites: row.favorite_count || 0,
    comments: row.comment_count || 0,
    views: row.play_count || 0,
  };
}

export async function createGame(kv, body) {
  const { title, prompt, code, authorName, authorToken, status, orientation, visibility } = body || {};
  const isDraft = status === 'draft';
  if (!isDraft && (!code || !prompt)) {
    return { ok: false, status: 400, body: { success: false, error: '缺少必要参数' } };
  }
  if (isDraft && !prompt) {
    return { ok: false, status: 400, body: { success: false, error: '草稿需要提供描述' } };
  }

  const id = crypto.randomUUID();
  const token = authorToken || crypto.randomUUID();
  const gameTitle = title || String(prompt).slice(0, 50);
  const gameAuthor = authorName || '匿名';
  const gameCode = code || '';
  const gameStatus = isDraft ? 'draft' : 'published';
  const gameOrientation = orientation || 'portrait';
  const gameVisibility = visibility || 'public';
  const isPublic = gameVisibility === 'public' ? 1 : 0;

  const game = {
    id,
    title: gameTitle,
    prompt,
    code: gameCode,
    author_name: gameAuthor,
    author_token: token,
    status: gameStatus,
    orientation: gameOrientation,
    visibility: gameVisibility,
    is_public: isPublic,
    is_hidden: 0,
    is_featured: 0,
    llm_model: null,
    play_count: 0,
    like_count: 0,
    favorite_count: 0,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  await putGame(kv, game);
  await appendAuthorIndex(kv, token, id);

  if (!isDraft) {
    const idx = await readIndex(kv);
    idx.unshift(toListItem(game));
    await writeIndex(kv, idx);
  }

  const subDir = id.slice(0, 2);
  const staticUrl = `/g/${subDir}/${id}.html`;

  return {
    ok: true,
    body: {
      success: true,
      id,
      authorToken: token,
      staticUrl: isDraft ? null : staticUrl,
    },
  };
}

export async function updateGame(kv, id, body, headerAuthorToken) {
  const game = await getGame(kv, id);
  if (!game) {
    return { ok: false, status: 404, body: { success: false, error: '游戏不存在' } };
  }
  const effective = body?.authorToken || headerAuthorToken;
  if (game.author_token !== effective) {
    return { ok: false, status: 403, body: { success: false, error: '无权限编辑此游戏' } };
  }

  const { title, prompt, code, authorName, status, visibility } = body || {};
  if (title !== undefined) game.title = title;
  if (prompt !== undefined) game.prompt = prompt;
  if (code !== undefined) game.code = code;
  if (authorName !== undefined) game.author_name = authorName;
  if (status !== undefined) game.status = status;
  if (visibility !== undefined) {
    game.visibility = visibility;
    game.is_public = visibility === 'public' ? 1 : 0;
  }
  game.updated_at = nowIso();

  await putGame(kv, game);

  const idx = await readIndex(kv);
  const i = idx.findIndex((x) => x.id === id);
  if (i >= 0) {
    idx[i] = toListItem(game);
    await writeIndex(kv, idx);
  } else if (game.status === 'published') {
    idx.unshift(toListItem(game));
    await writeIndex(kv, idx);
  }

  const subDir = id.slice(0, 2);
  const staticUrl = game.status === 'published' ? `/g/${subDir}/${id}.html` : null;
  return { ok: true, body: { success: true, staticUrl } };
}

export async function getGameDetail(kv, id) {
  const game = await getGame(kv, id);
  if (!game) {
    return { ok: false, status: 404, body: { success: false, error: '游戏不存在' } };
  }
  game.play_count = (game.play_count || 0) + 1;
  game.updated_at = nowIso();
  await putGame(kv, game);

  const idx = await readIndex(kv);
  const i = idx.findIndex((x) => x.id === id);
  if (i >= 0) {
    idx[i] = toListItem(game);
    await writeIndex(kv, idx);
  }

  const subDir = id.slice(0, 2);
  const staticUrl = `/g/${subDir}/${id}.html`;
  const author_games_count = 0;

  return {
    ok: true,
    body: {
      success: true,
      game: { ...game, author_games_count },
      staticUrl,
    },
  };
}

export async function listMyGames(kv, authorToken) {
  if (!authorToken) {
    return {
      ok: true,
      body: { success: true, games: [], stats: { count: 0, plays: 0, likes: 0 } },
    };
  }
  const raw = await kv.get(`author:${authorToken}`);
  let ids = [];
  try {
    ids = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) ids = [];
  } catch {
    ids = [];
  }
  const games = [];
  for (const id of ids.slice(0, 120)) {
    const g = await getGame(kv, id);
    if (!g) continue;
    const row = {
      id: g.id,
      title: g.title,
      prompt: g.prompt,
      author_name: g.author_name,
      play_count: g.play_count || 0,
      like_count: g.like_count || 0,
      favorite_count: g.favorite_count || 0,
      created_at: g.created_at,
      status: g.status,
      visibility: g.visibility,
      comment_count: g.comment_count || 0,
    };
    games.push(withAliases(row));
  }
  const publishedGames = games.filter((g) => g.status !== 'draft');
  const stats = {
    count: publishedGames.length,
    plays: publishedGames.reduce((s, g) => s + (g.play_count || 0), 0),
    likes: publishedGames.reduce((s, g) => s + (g.like_count || 0), 0),
  };
  return { ok: true, body: { success: true, games, stats } };
}

export async function listGames(kv, url) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const sort = url.searchParams.get('sort') || 'newest';

  let rows = await readIndex(kv);
  rows = rows.filter((g) => g.status !== 'draft' && (g.is_hidden === 0 || g.is_hidden === undefined));

  if (sort === 'hot') {
    rows = [...rows].sort((a, b) => {
      const sa = (a.play_count || 0) + (a.like_count || 0) * 5 + (a.favorite_count || 0) * 3;
      const sb = (b.play_count || 0) + (b.like_count || 0) * 5 + (b.favorite_count || 0) * 3;
      return sb - sa;
    });
  } else {
    rows = [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const total = rows.length;
  const slice = rows.slice(offset, offset + limit).map(withAliases);

  return {
    ok: true,
    body: {
      success: true,
      games: slice,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + slice.length < total,
      },
    },
  };
}

function rowToAdminGame(row) {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    author_name: row.author_name,
    play_count: row.play_count || 0,
    like_count: row.like_count || 0,
    favorite_count: row.favorite_count || 0,
    is_featured: row.is_featured ?? 0,
    is_hidden: row.is_hidden ?? 0,
    category: row.category ?? null,
    created_at: row.created_at,
  };
}

export async function adminListGames(kv, url) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const search = (url.searchParams.get('search') || '').trim().toLowerCase();
  const filter = url.searchParams.get('filter') || 'all';

  let rows = await readIndex(kv);
  if (search) {
    rows = rows.filter(
      (g) =>
        (g.title && String(g.title).toLowerCase().includes(search)) ||
        (g.prompt && String(g.prompt).toLowerCase().includes(search))
    );
  }
  if (filter === 'featured') {
    rows = rows.filter((g) => (g.is_featured ?? 0) === 1);
  } else if (filter === 'hidden') {
    rows = rows.filter((g) => (g.is_hidden ?? 0) === 1);
  }
  rows = [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const total = rows.length;
  const slice = rows.slice(offset, offset + limit).map((r) => rowToAdminGame(r));
  return {
    success: true,
    games: slice,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function removeFromAuthorIndex(kv, authorToken, gameId) {
  if (!authorToken) return;
  const k = `author:${authorToken}`;
  const raw = await kv.get(k);
  let ids = [];
  try {
    ids = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) ids = [];
  } catch {
    ids = [];
  }
  ids = ids.filter((x) => x !== gameId);
  await kv.put(k, JSON.stringify(ids));
}

export async function adminUpdateGameFlags(kv, id, body) {
  const game = await getGame(kv, id);
  if (!game) return { ok: false, status: 404, body: { success: false, error: '游戏不存在' } };
  if (body.is_featured !== undefined) game.is_featured = body.is_featured ? 1 : 0;
  if (body.is_hidden !== undefined) game.is_hidden = body.is_hidden ? 1 : 0;
  if (body.category !== undefined) game.category = body.category;
  game.updated_at = nowIso();
  await putGame(kv, game);
  const idx = await readIndex(kv);
  const i = idx.findIndex((x) => x.id === id);
  if (i >= 0) {
    idx[i] = toListItem(game);
    await writeIndex(kv, idx);
  } else if (game.status === 'published') {
    idx.unshift(toListItem(game));
    await writeIndex(kv, idx);
  }
  return { ok: true, body: { success: true, message: '游戏已更新' } };
}

export async function adminDeleteGame(kv, id) {
  const game = await getGame(kv, id);
  if (!game) return { ok: false, status: 404, body: { success: false, error: '游戏不存在' } };
  await kv.delete(`${GAME_PREFIX}${id}`);
  const idx = (await readIndex(kv)).filter((x) => x.id !== id);
  await writeIndex(kv, idx);
  await removeFromAuthorIndex(kv, game.author_token, id);
  return { ok: true, body: { success: true, message: '已删除' } };
}

const DRAFT_SUB_KV_PREFIX = 'mp_draft_sub:';

function parseCreatedAtMs(createdAt) {
  if (!createdAt) return Date.now();
  const n = Date.parse(String(createdAt).replace(' ', 'T'));
  return Number.isFinite(n) ? n : Date.now();
}

/** 将作者的草稿列表映射为小程序「创作中任务」（与 server.js sync_<draftId> 对齐） */
export async function listCreatingTasksFromDrafts(kv, authorToken) {
  if (!kv || !authorToken) return [];
  const r = await listMyGames(kv, authorToken);
  const games = (r.body && r.body.games) || [];
  const drafts = games.filter((g) => g.status === 'draft');
  const tasks = [];
  for (const g of drafts) {
    const subRaw = await kv.get(`${DRAFT_SUB_KV_PREFIX}${g.id}`);
    const subscribed = subRaw === '1';
    tasks.push({
      taskId: `sync_${g.id}`,
      type: 'create',
      typeName: '创建游戏',
      status: 'processing',
      progress: 50,
      progressText: 'AI创作中...',
      prompt: g.prompt || '',
      createdAt: parseCreatedAtMs(g.created_at),
      subscribed,
      gameId: g.id,
    });
  }
  tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return tasks;
}

/** 草稿任务订阅（KV 无微信发模板能力，仅记录订阅态供前端与后续扩展） */
export async function subscribeDraftTaskKv(kv, gameId, authorToken, user) {
  if (!kv || !gameId || !authorToken) {
    return { ok: false, status: 400, body: { success: false, error: '参数无效' } };
  }
  const game = await getGame(kv, gameId);
  if (!game) return { ok: false, status: 404, body: { success: false, error: '任务不存在或已完成' } };
  if (game.author_token !== authorToken) {
    return { ok: false, status: 403, body: { success: false, error: '无权操作此任务' } };
  }
  if (game.status !== 'draft') {
    return { ok: true, body: { success: false, error: '任务已完成，无法订阅', taskStatus: game.status } };
  }
  const key = `${DRAFT_SUB_KV_PREFIX}${gameId}`;
  const existed = await kv.get(key);
  if (existed === '1') {
    return { ok: true, body: { success: false, error: '已订阅此任务', alreadySubscribed: true } };
  }
  if (user && !user.wechat_openid) {
    return {
      ok: true,
      body: {
        success: false,
        error: '请先在小程序中登录以获取通知权限',
        needWechatLogin: true,
      },
    };
  }
  await kv.put(key, '1');
  return {
    ok: true,
    body: {
      success: true,
      taskId: `sync_${gameId}`,
      creditsReward: 0,
      message: '订阅成功！',
    },
  };
}
