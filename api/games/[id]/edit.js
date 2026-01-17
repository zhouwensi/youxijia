// POST /api/games/[id]/edit - 游戏高级编辑（多轮对话优化）

const db = require('../../_lib/db');

// 系统提示词（用于编辑优化）
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

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Author-Token, X-User-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  const userToken = req.headers['x-user-token'] || req.headers['x-author-token'];
  
  if (!userToken) {
    return res.status(401).json({ success: false, error: '请先登录' });
  }

  try {
    // 验证游戏是否存在且属于当前用户
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    if (game.author_token !== userToken) {
      return res.status(403).json({ success: false, error: '只能编辑自己的游戏' });
    }

    // 根据action参数分发处理
    const { action } = req.body || req.query;
    
    switch (action) {
      case 'start':
        return handleStartSession(req, res, game, userToken);
      case 'message':
        return handleEditMessage(req, res, game, userToken);
      case 'preview':
        return handlePreview(req, res, game);
      case 'save':
        return handleSave(req, res, game, userToken);
      case 'history':
        return handleGetHistory(req, res, game);
      case 'rollback':
        return handleRollback(req, res, game, userToken);
      case 'quick':
        return handleQuickEdit(req, res, game, userToken);
      default:
        return res.status(400).json({ success: false, error: '未知的操作类型' });
    }
  } catch (error) {
    console.error('[编辑API错误]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 开始新的编辑会话
async function handleStartSession(req, res, game, userToken) {
  const sessionId = generateUUID();
  
  // 确保表存在
  ensureEditTablesExist();
  
  // 创建新会话
  db.prepare(`
    INSERT INTO game_edit_sessions (id, game_id, user_token, original_code, current_code)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, game.id, userToken, game.code, game.code);
  
  // 记录初始版本（如果还没有版本历史）
  const existingVersions = db.prepare('SELECT COUNT(*) as count FROM game_versions WHERE game_id = ?').get(game.id);
  if (existingVersions.count === 0) {
    db.prepare(`
      INSERT INTO game_versions (game_id, version_number, code, change_summary, created_by)
      VALUES (?, 1, ?, '初始版本', ?)
    `).run(game.id, game.code, userToken);
  }
  
  return res.status(200).json({
    success: true,
    sessionId,
    game: {
      id: game.id,
      title: game.title,
      prompt: game.prompt,
      codeLength: game.code.length
    },
    suggestions: getEditSuggestions(game.code)
  });
}

// 处理编辑消息（多轮对话）
async function handleEditMessage(req, res, game, userToken) {
  const { sessionId, message, llmConfig } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ success: false, error: '缺少会话ID' });
  }
  
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: '请输入修改要求' });
  }
  
  // 获取会话
  const session = db.prepare('SELECT * FROM game_edit_sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: '编辑会话不存在或已过期' });
  }
  
  if (session.user_token !== userToken) {
    return res.status(403).json({ success: false, error: '无权访问此会话' });
  }
  
  // 获取历史对话
  const history = db.prepare(`
    SELECT role, content FROM game_edit_messages 
    WHERE session_id = ? 
    ORDER BY created_at ASC
  `).all(sessionId);
  
  // 构建对话上下文
  const messages = [
    { role: 'system', content: EDIT_SYSTEM_PROMPT },
    { role: 'user', content: `这是当前的游戏代码：\n\n\`\`\`html\n${session.current_code}\n\`\`\`` }
  ];
  
  // 添加历史对话
  history.forEach(msg => {
    messages.push({ role: msg.role, content: msg.content });
  });
  
  // 添加当前用户消息
  messages.push({ role: 'user', content: `请按照以下要求修改游戏：${message}` });
  
  // 保存用户消息
  db.prepare(`
    INSERT INTO game_edit_messages (session_id, role, content)
    VALUES (?, 'user', ?)
  `).run(sessionId, message);
  
  // 调用LLM
  const config = {
    provider: llmConfig?.provider || 'deepseek',
    apiKey: llmConfig?.apiKey || process.env.DEEPSEEK_API_KEY,
    baseUrl: llmConfig?.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: llmConfig?.model || 'deepseek-chat'
  };
  
  if (!config.apiKey) {
    return res.status(400).json({ success: false, error: '请配置API Key' });
  }
  
  console.log('[编辑] 开始调用LLM优化游戏...');
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 16384
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`LLM API错误: ${response.status} - ${errorData}`);
    }
    
    const data = await response.json();
    const apiTime = Date.now() - startTime;
    console.log(`[编辑] LLM响应时间: ${apiTime}ms`);
    
    let newCode = data.choices[0].message.content;
    
    // 提取HTML代码
    const htmlMatch = newCode.match(/```html\n?([\s\S]*?)```/);
    if (htmlMatch) {
      newCode = htmlMatch[1].trim();
    } else {
      const altMatch = newCode.match(/```\n?([\s\S]*?)```/);
      if (altMatch) {
        newCode = altMatch[1].trim();
      }
    }
    
    // 验证代码结构
    if (!newCode.includes('<html') && !newCode.includes('<!DOCTYPE')) {
      return res.status(400).json({ success: false, error: 'AI返回的代码格式不正确，请重试' });
    }
    
    // 保存AI回复和代码快照
    db.prepare(`
      INSERT INTO game_edit_messages (session_id, role, content, code_snapshot, tokens_used)
      VALUES (?, 'assistant', ?, ?, ?)
    `).run(sessionId, '已完成修改', newCode, data.usage?.total_tokens || 0);
    
    // 更新会话的当前代码
    db.prepare(`
      UPDATE game_edit_sessions SET current_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newCode, sessionId);
    
    return res.status(200).json({
      success: true,
      code: newCode,
      message: '修改完成！可以预览效果或继续优化',
      changes: detectChanges(session.current_code, newCode),
      tokensUsed: data.usage?.total_tokens || 0,
      apiTime
    });
    
  } catch (error) {
    console.error('[编辑] LLM调用失败:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// 预览当前编辑效果
function handlePreview(req, res, game) {
  const { sessionId } = req.query || req.body;
  
  if (!sessionId) {
    return res.status(400).json({ success: false, error: '缺少会话ID' });
  }
  
  const session = db.prepare('SELECT current_code FROM game_edit_sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: '会话不存在' });
  }
  
  return res.status(200).json({
    success: true,
    code: session.current_code
  });
}

// 保存编辑结果
async function handleSave(req, res, game, userToken) {
  const { sessionId, saveAsNew, title } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ success: false, error: '缺少会话ID' });
  }
  
  const session = db.prepare('SELECT * FROM game_edit_sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: '会话不存在' });
  }
  
  if (saveAsNew) {
    // 另存为新游戏
    const newGameId = generateUUID();
    const newTitle = title || game.title + ' (编辑版)';
    
    db.prepare(`
      INSERT INTO games (id, title, prompt, code, author_name, author_token, llm_model)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(newGameId, newTitle, game.prompt + ' [编辑优化]', session.current_code, game.author_name, userToken, game.llm_model);
    
    // 标记会话完成
    db.prepare(`UPDATE game_edit_sessions SET status = 'completed' WHERE id = ?`).run(sessionId);
    
    return res.status(200).json({
      success: true,
      gameId: newGameId,
      title: newTitle,
      message: '已保存为新游戏'
    });
  } else {
    // 更新原游戏
    // 先保存版本历史
    const latestVersion = db.prepare(`
      SELECT MAX(version_number) as max_version FROM game_versions WHERE game_id = ?
    `).get(game.id);
    
    const newVersionNumber = (latestVersion?.max_version || 0) + 1;
    
    db.prepare(`
      INSERT INTO game_versions (game_id, version_number, code, change_summary, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(game.id, newVersionNumber, session.current_code, '编辑优化', userToken);
    
    // 更新游戏代码
    db.prepare(`
      UPDATE games SET code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(session.current_code, game.id);
    
    // 更新静态HTML文件
    const fs = require('fs');
    const path = require('path');
    const gameDir = path.join(process.cwd(), 'public', 'g', game.id.substring(0, 2));
    const gamePath = path.join(gameDir, `${game.id}.html`);
    
    if (fs.existsSync(gamePath)) {
      fs.writeFileSync(gamePath, session.current_code, 'utf-8');
    }
    
    // 标记会话完成
    db.prepare(`UPDATE game_edit_sessions SET status = 'completed' WHERE id = ?`).run(sessionId);
    
    return res.status(200).json({
      success: true,
      gameId: game.id,
      version: newVersionNumber,
      message: '游戏已更新'
    });
  }
}

// 获取编辑/版本历史
function handleGetHistory(req, res, game) {
  const versions = db.prepare(`
    SELECT id, version_number, change_summary, created_at
    FROM game_versions
    WHERE game_id = ?
    ORDER BY version_number DESC
    LIMIT 20
  `).all(game.id);
  
  const sessions = db.prepare(`
    SELECT id, status, created_at, updated_at
    FROM game_edit_sessions
    WHERE game_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(game.id);
  
  return res.status(200).json({
    success: true,
    versions,
    sessions
  });
}

// 回滚到某个版本
async function handleRollback(req, res, game, userToken) {
  const { versionId } = req.body;
  
  const version = db.prepare(`
    SELECT * FROM game_versions WHERE id = ? AND game_id = ?
  `).get(versionId, game.id);
  
  if (!version) {
    return res.status(404).json({ success: false, error: '版本不存在' });
  }
  
  // 保存当前版本作为新版本
  const latestVersion = db.prepare(`
    SELECT MAX(version_number) as max_version FROM game_versions WHERE game_id = ?
  `).get(game.id);
  
  const newVersionNumber = (latestVersion?.max_version || 0) + 1;
  
  db.prepare(`
    INSERT INTO game_versions (game_id, version_number, code, change_summary, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(game.id, newVersionNumber, version.code, `回滚到版本 ${version.version_number}`, userToken);
  
  // 更新游戏
  db.prepare(`UPDATE games SET code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(version.code, game.id);
  
  // 更新静态文件
  const fs = require('fs');
  const path = require('path');
  const gameDir = path.join(process.cwd(), 'public', 'g', game.id.substring(0, 2));
  const gamePath = path.join(gameDir, `${game.id}.html`);
  
  if (fs.existsSync(gamePath)) {
    fs.writeFileSync(gamePath, version.code, 'utf-8');
  }
  
  return res.status(200).json({
    success: true,
    message: `已回滚到版本 ${version.version_number}`,
    version: newVersionNumber
  });
}

// 快速编辑（一次性修改，不创建会话）
async function handleQuickEdit(req, res, game, userToken) {
  const { editPrompt, llmConfig } = req.body;
  
  if (!editPrompt || editPrompt.trim().length === 0) {
    return res.status(400).json({ success: false, error: '请输入修改要求' });
  }
  
  const config = {
    provider: llmConfig?.provider || 'deepseek',
    apiKey: llmConfig?.apiKey || process.env.DEEPSEEK_API_KEY,
    baseUrl: llmConfig?.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: llmConfig?.model || 'deepseek-chat'
  };
  
  if (!config.apiKey) {
    return res.status(400).json({ success: false, error: '请配置API Key' });
  }
  
  const messages = [
    { role: 'system', content: EDIT_SYSTEM_PROMPT },
    { role: 'user', content: `这是当前的游戏代码：\n\n\`\`\`html\n${game.code}\n\`\`\`\n\n请按照以下要求修改：${editPrompt}` }
  ];
  
  console.log('[快速编辑] 开始调用LLM...');
  
  try {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 16384
      })
    });
    
    if (!response.ok) {
      throw new Error(`LLM API错误: ${response.status}`);
    }
    
    const data = await response.json();
    let newCode = data.choices[0].message.content;
    
    // 提取HTML
    const htmlMatch = newCode.match(/```html\n?([\s\S]*?)```/);
    if (htmlMatch) {
      newCode = htmlMatch[1].trim();
    }
    
    // 保存版本历史
    ensureEditTablesExist();
    const latestVersion = db.prepare(`
      SELECT MAX(version_number) as max_version FROM game_versions WHERE game_id = ?
    `).get(game.id);
    
    const newVersionNumber = (latestVersion?.max_version || 0) + 1;
    
    db.prepare(`
      INSERT INTO game_versions (game_id, version_number, code, change_summary, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(game.id, newVersionNumber, newCode, editPrompt.substring(0, 100), userToken);
    
    // 更新游戏
    db.prepare(`UPDATE games SET code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(newCode, game.id);
    
    // 更新静态文件
    const fs = require('fs');
    const path = require('path');
    const gameDir = path.join(process.cwd(), 'public', 'g', game.id.substring(0, 2));
    const gamePath = path.join(gameDir, `${game.id}.html`);
    
    if (fs.existsSync(gamePath)) {
      fs.writeFileSync(gamePath, newCode, 'utf-8');
    }
    
    return res.status(200).json({
      success: true,
      code: newCode,
      version: newVersionNumber,
      message: '修改完成！'
    });
    
  } catch (error) {
    console.error('[快速编辑] 失败:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// 辅助函数

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function ensureEditTablesExist() {
  // 创建编辑会话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_edit_sessions (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      user_token TEXT NOT NULL,
      original_code TEXT NOT NULL,
      current_code TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 创建编辑消息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_edit_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      code_snapshot TEXT,
      tokens_used INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 创建版本历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      code TEXT NOT NULL,
      change_summary TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 创建索引
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_edit_sessions_game ON game_edit_sessions(game_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_edit_messages_session ON game_edit_messages(session_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_game_versions ON game_versions(game_id, version_number DESC)`);
  } catch (e) {
    // 索引已存在，忽略错误
  }
}

function getEditSuggestions(code) {
  const suggestions = [];
  
  // 分析代码，给出编辑建议
  if (!code.includes('background-color') && !code.includes('background:')) {
    suggestions.push('🎨 添加更炫酷的背景效果');
  }
  if (!code.includes('audio') && !code.includes('Audio')) {
    suggestions.push('🔊 添加背景音乐和音效');
  }
  if (!code.includes('localStorage')) {
    suggestions.push('💾 添加存档功能，保存最高分');
  }
  if (!code.includes('level') && !code.includes('关卡')) {
    suggestions.push('🎯 添加多个关卡或难度等级');
  }
  if (!code.includes('particle') && !code.includes('粒子')) {
    suggestions.push('✨ 添加粒子特效让画面更炫');
  }
  if (!code.includes('pause') && !code.includes('暂停')) {
    suggestions.push('⏸️ 添加暂停功能');
  }
  
  // 默认建议
  if (suggestions.length === 0) {
    suggestions.push('🎮 优化游戏手感');
    suggestions.push('📱 改善移动端体验');
    suggestions.push('🏆 添加成就系统');
  }
  
  return suggestions.slice(0, 5);
}

function detectChanges(oldCode, newCode) {
  const changes = [];
  
  // 简单的变化检测
  if (newCode.length > oldCode.length * 1.1) {
    changes.push('增加了新功能');
  } else if (newCode.length < oldCode.length * 0.9) {
    changes.push('优化了代码结构');
  }
  
  if (newCode.includes('audio') && !oldCode.includes('audio')) {
    changes.push('添加了音效');
  }
  if (newCode.includes('particle') && !oldCode.includes('particle')) {
    changes.push('添加了粒子效果');
  }
  if (newCode.includes('level') && !oldCode.includes('level')) {
    changes.push('添加了关卡系统');
  }
  
  return changes.length > 0 ? changes : ['代码已更新'];
}
