// ==================== 模型注册表 ====================
const MODEL_REGISTRY = {
  // DeepSeek 系列
  'deepseek-v3': {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    name: 'DeepSeek V3',
    hint: 'DeepSeek V3 性价比最高，推荐使用'
  },
  'deepseek-r1': {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    hint: '推理增强模型，适合复杂游戏逻辑'
  },
  // 国产模型
  'glm-4.7': {
    provider: 'zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-plus',
    name: 'GLM 4.7',
    hint: '智谱最新模型'
  },
  'glm-4.6': {
    provider: 'zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4',
    name: 'GLM 4.6',
    hint: '智谱GLM-4'
  },
  'glm-4.5': {
    provider: 'zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    name: 'GLM 4.5',
    hint: '智谱GLM-4 Flash，快速响应'
  },
  'kimi-k2': {
    provider: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-128k',
    name: 'Kimi K2',
    hint: 'Moonshot Kimi大模型'
  },
  'qwen3-coder-plus': {
    provider: 'aliyun',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-coder-plus',
    name: 'Qwen3 Coder Plus',
    hint: '阿里通义千问编程专用模型'
  },
  // OpenAI 系列
  'gpt-4o-mini': {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    hint: '性价比高的GPT-4o版本'
  },
  'gpt-4o': {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    name: 'GPT-4o',
    hint: 'OpenAI旗舰多模态模型'
  },
  'gpt-5': {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5',
    name: 'GPT 5',
    hint: 'OpenAI最新模型（需要有权限）'
  },
  'gpt-5.1': {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.1',
    name: 'GPT 5.1',
    hint: 'GPT-5升级版'
  },
  'gpt-5.1-codex': {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.1-codex',
    name: 'GPT 5.1 Codex',
    hint: '代码生成专用'
  },
  // Claude 系列
  'claude-3.7-sonnet': {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.7 Sonnet',
    hint: 'Claude 3.5 Sonnet'
  },
  'claude-4-sonnet': {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
    name: 'Claude 4 Sonnet',
    hint: 'Claude 4 Sonnet'
  },
  'claude-4.5-haiku': {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-haiku-4-20250514',
    name: 'Claude 4.5 Haiku',
    hint: '快速响应版Claude'
  },
  'claude-4.5-sonnet': {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-4-5-sonnet',
    name: 'Claude 4.5 Sonnet',
    hint: 'Claude 4.5 Sonnet'
  },
  'claude-4.5-opus': {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-4-5-opus',
    name: 'Claude 4.5 Opus',
    hint: 'Anthropic最强模型'
  },
  // Google 系列
  'gemini-2.5-pro': {
    provider: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    hint: 'Google Gemini专业版'
  },
  'gemini-3-pro': {
    provider: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    hint: 'Google最新Gemini'
  },
  // 自定义
  'custom': {
    provider: 'custom',
    baseUrl: '',
    model: '',
    name: '自定义接口',
    hint: '使用自定义API接口'
  }
};

// ==================== 应用状态 ====================
const state = {
  currentGame: null,
  currentGameId: null,
  recentGamesOffset: 0,
  isGenerating: false,
  abortController: null,
  debugMode: false,
  credits: 0,
  creditsConfig: null,
  modelsConfig: null,
  trialInfo: null,  // 体验模式信息
  myInviteCode: null,  // 我的邀请码
  weeklyChallenge: null,  // 本周挑战
  settings: {
    llmModelId: 'deepseek-v3',  // 使用模型ID
    llmApiKey: '',
    llmBaseUrl: '',
    llmModel: '',
    authorName: ''
  }
};

// 获取或创建用户Token
function getUserToken() {
  let token = localStorage.getItem('aigame-user-token');
  if (!token) {
    token = generateUUID();
    localStorage.setItem('aigame-user-token', token);
  }
  return token;
}

// 获取或创建作者Token（用于管理我的游戏）
function getAuthorToken() {
  let token = localStorage.getItem('aigame-author-token');
  if (!token) {
    token = generateUUID();
    localStorage.setItem('aigame-author-token', token);
  }
  return token;
}

// 游戏图标映射
const gameIcons = ['🎮', '🎲', '🕹️', '👾', '🏆', '⭐', '🚀', '🐍', '📦', '🎯', '🔢', '💎', '💣', '🎪'];

// 后台生成任务状态
const backgroundTask = {
  isActive: false,      // 是否有生成任务在进行
  isMinimized: false,   // 是否最小化（后台模式）
  isCancelled: false,   // 是否已取消
  prompt: '',           // 生成的prompt
  result: null,         // 存储生成结果 {title, code}
  error: null           // 错误信息
};

// 日志函数
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = { info: '📝', success: '✅', error: '❌', warn: '⚠️' }[type] || '📝';
  console.log(`[${timestamp}] ${prefix} ${message}`);
  
  // 更新生成日志UI
  const logContainer = document.getElementById('generating-log');
  const overlay = document.getElementById('generating-overlay');
  if (logContainer && overlay && overlay.classList.contains('active')) {
    const logItem = document.createElement('div');
    logItem.className = `log-item ${type}`;
    logItem.textContent = `${prefix} ${message}`;
    logContainer.appendChild(logItem);
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  
  // 调试面板
  if (state.debugMode) {
    const debugContent = document.getElementById('debug-content');
    if (debugContent) {
      debugContent.textContent += `[${timestamp}] ${message}\n`;
      debugContent.scrollTop = debugContent.scrollHeight;
    }
  }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  log('页面加载完成，初始化应用...', 'info');
  loadSettings();
  loadGames();
  initLeaderboard();
  handleRouting();
  
  // 监听浏览器前进后退
  window.addEventListener('popstate', handleRouting);
  
  // Ctrl+Enter 或 Cmd+Enter 生成游戏
  document.getElementById('prompt-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      generateGame();
    }
  });
  
  // 设置调试模式复选框状态
  const debugCheckbox = document.getElementById('debug-mode');
  if (debugCheckbox) {
    debugCheckbox.checked = state.debugMode;
  }
});

// 路由处理
function handleRouting() {
  const path = window.location.pathname;
  const gameMatch = path.match(/\/game\/([^/]+)/);
  
  if (gameMatch) {
    const gameId = gameMatch[1];
    loadGameById(gameId);
  } else {
    showHome();
  }
}

// 显示首页
function showHome() {
  document.getElementById('home-page').classList.add('active');
  document.getElementById('game-page').classList.remove('active');
  document.body.classList.remove('fullscreen');
  // 只在当前不是首页时才更新URL
  if (window.location.pathname !== '/') {
    history.pushState(null, '', '/');
  }
  // 刷新排行榜数据
  refreshLeaderboards();
}

// 刷新排行榜数据
function refreshLeaderboards() {
  loadLeaderboardData('hot');
  loadLeaderboardData('likes');
  loadLeaderboardData('favorites');
}

// 显示游戏页面
function showGamePage() {
  document.getElementById('home-page').classList.remove('active');
  document.getElementById('game-page').classList.add('active');
}

// 加载设置
function loadSettings() {
  const saved = localStorage.getItem('aigame-settings');
  if (saved) {
    try {
      state.settings = { ...state.settings, ...JSON.parse(saved) };
      log('设置已从本地加载');
    } catch (e) {
      log('加载设置失败: ' + e.message, 'error');
    }
  }
  
  // 加载调试模式
  state.debugMode = localStorage.getItem('aigame-debug') === 'true';
}

// 保存设置
function saveSettings() {
  try {
    // 获取模型选择
    const modelSelect = document.getElementById('llm-model-select');
    const selectedModel = modelSelect ? modelSelect.value : 'deepseek-v3';
    
    // 获取模型配置信息
    const modelConfig = MODEL_REGISTRY[selectedModel] || {};
    
    const settings = {
      llmProvider: selectedModel,  // 使用模型ID作为provider
      llmApiKey: document.getElementById('llm-api-key')?.value || '',
      llmBaseUrl: document.getElementById('llm-base-url')?.value || modelConfig.baseUrl || '',
      llmModel: document.getElementById('llm-model')?.value || modelConfig.model || selectedModel,
      authorName: document.getElementById('author-name')?.value || ''
    };
    
    state.settings = settings;
    localStorage.setItem('aigame-settings', JSON.stringify(settings));
    
    // 保存调试模式
    state.debugMode = document.getElementById('debug-mode')?.checked || false;
    localStorage.setItem('aigame-debug', state.debugMode);
    
    closeSettings();
    showToast('设置已保存', 'success');
    log('设置已保存', 'success');
  } catch (error) {
    console.error('保存设置失败:', error);
    showToast('保存设置失败: ' + error.message, 'error');
  }
}

// 切换调试模式
function toggleDebugMode() {
  state.debugMode = document.getElementById('debug-mode')?.checked || false;
  localStorage.setItem('aigame-debug', state.debugMode);
  
  const debugPanel = document.getElementById('debug-panel');
  if (debugPanel) {
    debugPanel.style.display = state.debugMode ? 'block' : 'none';
  }
}

// 切换调试面板
function toggleDebugPanel() {
  const debugPanel = document.getElementById('debug-panel');
  if (debugPanel) {
    debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
  }
}

// 切换API Key可见性
function toggleApiKeyVisibility() {
  const input = document.getElementById('llm-api-key');
  const btn = document.querySelector('.btn-toggle-pwd');
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.textContent = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.textContent = '👁️';
  }
}

// 打开设置弹窗
function openSettings() {
  const modal = document.getElementById('settings-modal');
  modal.classList.add('active');
  
  // 填充当前设置
  const modelSelect = document.getElementById('llm-model-select');
  if (modelSelect) {
    // 尝试匹配保存的模型
    modelSelect.value = state.settings.llmProvider || 'deepseek-v3';
  }
  
  const apiKeyInput = document.getElementById('llm-api-key');
  if (apiKeyInput) apiKeyInput.value = state.settings.llmApiKey || '';
  
  const baseUrlInput = document.getElementById('llm-base-url');
  if (baseUrlInput) baseUrlInput.value = state.settings.llmBaseUrl || '';
  
  const modelInput = document.getElementById('llm-model');
  if (modelInput) modelInput.value = state.settings.llmModel || '';
  
  const authorInput = document.getElementById('author-name');
  if (authorInput) authorInput.value = state.settings.authorName || '';
  
  const debugCheckbox = document.getElementById('debug-mode');
  if (debugCheckbox) {
    debugCheckbox.checked = state.debugMode;
  }
  
  // 触发模型选择变更以更新UI
  onModelSelectChange();
}

// 关闭设置弹窗
function closeSettings() {
  document.getElementById('settings-modal').classList.remove('active');
}

// 提供商切换
function onProviderChange() {
  const provider = document.getElementById('llm-provider').value;
  const baseUrlGroup = document.getElementById('base-url-group');
  const modelGroup = document.getElementById('model-group');
  
  if (provider === 'custom') {
    baseUrlGroup.style.display = 'block';
    modelGroup.style.display = 'block';
  } else if (provider === 'openai') {
    baseUrlGroup.style.display = 'none';
    modelGroup.style.display = 'block';
  } else {
    baseUrlGroup.style.display = 'none';
    modelGroup.style.display = 'none';
  }
}

// 加载游戏列表
async function loadGames() {
  try {
    // 只加载最新创作（10个）
    const recentRes = await fetch('/api/games/recent?limit=10');
    const recentData = await recentRes.json();
    renderGamesList('recent-games', recentData.games || []);
    state.recentGamesOffset = (recentData.games || []).length;
  } catch (error) {
    console.error('加载游戏列表失败:', error);
  }
}

// ==================== 排行榜功能 ====================

// 初始化所有排行榜
function initLeaderboard() {
  // 加载编辑推荐（卡片网格样式）
  loadFeaturedGames();
  // 加载三个列表榜单
  loadLeaderboardData('hot');
  loadLeaderboardData('likes');
  loadLeaderboardData('favorites');
  // 加载全部游戏（卡片网格样式）
  loadAllGamesSection();
}

// 加载全部游戏区块（首页底部，按热门排序）
async function loadAllGamesSection() {
  const container = document.getElementById('all-games');
  if (!container) return;
  
  container.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const res = await fetch('/api/games?sort=hot&limit=10');
    const data = await res.json();
    
    if (data.success && data.games && data.games.length > 0) {
      container.innerHTML = '';
      data.games.forEach(game => {
        container.appendChild(createGameCard(game));
      });
    } else {
      container.innerHTML = '<div class="empty-state"><p>暂无游戏</p></div>';
    }
  } catch (error) {
    console.error('加载全部游戏失败:', error);
    container.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
  }
}

// 加载编辑推荐（卡片网格样式）
async function loadFeaturedGames() {
  const container = document.getElementById('featured-games');
  if (!container) return;
  
  container.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const res = await fetch('/api/leaderboard/featured?limit=10');
    const data = await res.json();
    
    if (data.success && data.games && data.games.length > 0) {
      container.innerHTML = '';
      data.games.forEach(game => {
        container.appendChild(createGameCard(game));
      });
    } else {
      container.innerHTML = '<div class="empty-state"><p>暂无推荐游戏</p></div>';
    }
  } catch (error) {
    console.error('加载编辑推荐失败:', error);
    container.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
  }
}

// 加载排行榜数据
async function loadLeaderboardData(type) {
  const container = document.getElementById(`leaderboard-${type}`);
  if (!container) return;
  
  container.innerHTML = '<div class="leaderboard-empty">加载中...</div>';
  
  try {
    const res = await fetch(`/api/leaderboard/${type}?limit=10`);
    const data = await res.json();
    
    if (data.success && data.games && data.games.length > 0) {
      renderLeaderboard(container, data.games, type);
    } else {
      container.innerHTML = '<div class="leaderboard-empty">暂无数据</div>';
    }
  } catch (error) {
    console.error(`加载${type}排行榜失败:`, error);
    container.innerHTML = '<div class="leaderboard-empty">加载失败</div>';
  }
}

// 渲染排行榜
function renderLeaderboard(container, games, type) {
  container.innerHTML = '';
  
  games.forEach((game, index) => {
    const rank = index + 1;
    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    item.onclick = () => openGame(game.id);
    
    // 确定排名样式
    let rankClass = 'rank-other';
    if (rank === 1) rankClass = 'rank-1';
    else if (rank === 2) rankClass = 'rank-2';
    else if (rank === 3) rankClass = 'rank-3';
    
    // 根据类型确定高亮的统计数据
    let highlightStat = '';
    switch(type) {
      case 'likes':
        highlightStat = `<span class="leaderboard-stat highlight">❤️ ${game.like_count || 0}</span>`;
        break;
      case 'favorites':
        highlightStat = `<span class="leaderboard-stat highlight">⭐ ${game.favorite_count || 0}</span>`;
        break;
      case 'hot':
        const score = game.score || (game.play_count + (game.like_count || 0) * 5 + (game.favorite_count || 0) * 3);
        highlightStat = `<span class="leaderboard-stat highlight">🔥 ${score}</span>`;
        break;
    }
    
    item.innerHTML = `
      <div class="leaderboard-rank ${rankClass}">${rank}</div>
      <div class="leaderboard-info">
        <div class="leaderboard-title">${escapeHtml(game.title)}</div>
        <div class="leaderboard-meta">👤 ${escapeHtml(game.author_name || '匿名')}</div>
      </div>
      <div class="leaderboard-stats">
        ${highlightStat}
        <span class="leaderboard-stat">👁️ ${game.play_count || 0}</span>
      </div>
    `;
    
    container.appendChild(item);
  });
}

// 加载更多游戏
async function loadMoreGames() {
  try {
    const res = await fetch(`/api/games/recent?offset=${state.recentGamesOffset}`);
    const data = await res.json();
    
    if (data.games && data.games.length > 0) {
      const container = document.getElementById('recent-games');
      data.games.forEach(game => {
        container.appendChild(createGameCard(game));
      });
      state.recentGamesOffset += data.games.length;
    } else {
      showToast('没有更多游戏了');
    }
  } catch (error) {
    console.error('加载更多游戏失败:', error);
    showToast('加载失败，请重试', 'error');
  }
}

// 渲染游戏列表
function renderGamesList(containerId, games) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  if (games.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎮</div>
        <p>还没有游戏，来创建第一个吧！</p>
      </div>
    `;
    return;
  }
  
  games.forEach(game => {
    container.appendChild(createGameCard(game));
  });
}

// 创建游戏卡片
function createGameCard(game) {
  const card = document.createElement('div');
  card.className = 'game-card';
  card.onclick = () => openGame(game.id);
  
  const icon = gameIcons[Math.abs(hashCode(game.id)) % gameIcons.length];
  const timeAgo = formatTimeAgo(game.created_at);
  
  card.innerHTML = `
    <div class="game-card-preview">${icon}</div>
    <div class="game-card-content">
      <div class="game-card-title">${escapeHtml(game.title)}</div>
      <div class="game-card-prompt">${escapeHtml(game.prompt)}</div>
      <div class="game-card-meta">
        <span class="game-card-author">👤 ${escapeHtml(game.author_name || '匿名')}</span>
        <div class="game-card-stats">
          <span>❤️ ${game.like_count || 0}</span>
          <span>👁️ ${game.play_count || 0}</span>
        </div>
      </div>
    </div>
  `;
  
  return card;
}

// 设置提示词
function setPrompt(prompt) {
  document.getElementById('prompt-input').value = prompt;
  document.getElementById('prompt-input').focus();
}

// 清空生成日志
function clearGeneratingLog() {
  const logContainer = document.getElementById('generating-log');
  if (logContainer) {
    logContainer.innerHTML = '';
  }
}

// 更新生成状态
function updateGeneratingStatus(status) {
  const statusEl = document.getElementById('generating-status');
  if (statusEl) {
    statusEl.textContent = status;
  }
}

// 生成计时器
let generatingTimer = null;
let generatingStartTime = null;

// 更新生成时间显示
function updateGeneratingTime() {
  if (!generatingStartTime) return;
  
  const elapsed = Math.floor((Date.now() - generatingStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  
  const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  
  const timeEl = document.getElementById('generating-time');
  if (timeEl) timeEl.textContent = `已用时: ${timeStr}`;
  
  const floatTimeEl = document.getElementById('float-time');
  if (floatTimeEl) floatTimeEl.textContent = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`;
}

// 开始计时
function startGeneratingTimer() {
  generatingStartTime = Date.now();
  updateGeneratingTime();
  generatingTimer = setInterval(updateGeneratingTime, 1000);
}

// 停止计时
function stopGeneratingTimer() {
  if (generatingTimer) {
    clearInterval(generatingTimer);
    generatingTimer = null;
  }
  generatingStartTime = null;
}

// 最小化生成遮罩
function minimizeGenerating() {
  backgroundTask.isMinimized = true;
  
  // 隐藏遮罩
  document.getElementById('generating-overlay').classList.remove('active');
  
  // 显示浮动状态条
  document.getElementById('generating-float').classList.add('active');
  
  showToast('生成继续进行中，完成后会通知你', 'success');
  log('生成已最小化，继续后台运行');
}

// 恢复生成遮罩
function restoreGenerating() {
  backgroundTask.isMinimized = false;
  
  // 隐藏浮动条
  document.getElementById('generating-float').classList.remove('active');
  
  // 如果还在生成中，显示遮罩
  if (state.isGenerating) {
    document.getElementById('generating-overlay').classList.add('active');
  }
}

// 取消生成
function cancelGeneration() {
  backgroundTask.isCancelled = true;
  
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  
  state.isGenerating = false;
  stopGeneratingTimer();
  
  document.querySelector('.btn-generate')?.classList.remove('loading');
  document.getElementById('generating-overlay').classList.remove('active');
  document.getElementById('generating-float').classList.remove('active');
  
  showToast('已取消生成');
  log('用户取消了生成', 'warn');
}

// 显示生成完成通知
function showGenerationNotify() {
  const notify = document.getElementById('generation-notify');
  if (notify) {
    notify.classList.add('active');
    
    // 10秒后自动隐藏
    setTimeout(() => {
      if (notify.classList.contains('active')) {
        notify.classList.remove('active');
      }
    }, 10000);
  }
}

// 关闭生成完成通知
function closeGenerationNotify() {
  document.getElementById('generation-notify')?.classList.remove('active');
}

// 查看后台生成的游戏
function viewGeneratedGame() {
  closeGenerationNotify();
  
  if (backgroundTask.result) {
    // 恢复生成结果
    state.currentGame = {
      title: backgroundTask.result.title,
      prompt: backgroundTask.prompt,
      code: backgroundTask.result.code,
      isNew: true
    };
    state.currentGameId = null;
    
    // 清理后台任务
    backgroundTask.result = null;
    backgroundTask.prompt = '';
    
    // 打开保存弹窗
    openSaveModal();
  }
}

// 生成游戏
async function generateGame() {
  const prompt = document.getElementById('prompt-input').value.trim();
  
  if (!prompt) {
    showToast('请输入游戏描述', 'error');
    return;
  }
  
  if (state.isGenerating) {
    return;
  }
  
  // 检查API Key
  if (!state.settings.llmApiKey) {
    showToast('请先在设置中配置 API Key', 'error');
    openSettings();
    return;
  }
  
  state.isGenerating = true;
  state.abortController = new AbortController();
  
  // 初始化后台任务状态
  backgroundTask.isActive = true;
  backgroundTask.isMinimized = false;
  backgroundTask.isCancelled = false;
  backgroundTask.prompt = prompt;
  backgroundTask.result = null;
  
  const btn = document.querySelector('.btn-generate');
  btn.classList.add('loading');
  
  clearGeneratingLog();
  document.getElementById('generating-overlay').classList.add('active');
  startGeneratingTimer();
  
  log(`开始生成游戏: "${prompt}"`);
  updateGeneratingStatus('正在连接 AI 服务...');
  
  try {
    // 构建LLM配置 - 使用模型注册表
    const selectedModel = state.settings.llmProvider || 'deepseek-v3';
    const modelConfig = MODEL_REGISTRY[selectedModel];
    
    const llmConfig = {
      apiKey: state.settings.llmApiKey
    };
    
    if (modelConfig) {
      // 使用注册表中的配置
      llmConfig.provider = modelConfig.provider || selectedModel;
      llmConfig.baseUrl = modelConfig.baseUrl;
      llmConfig.model = modelConfig.model;
    } else if (selectedModel === 'custom') {
      // 自定义配置
      llmConfig.provider = 'custom';
      llmConfig.baseUrl = state.settings.llmBaseUrl;
      llmConfig.model = state.settings.llmModel;
    } else {
      // 后备：尝试从旧的provider名推断
      if (selectedModel.startsWith('deepseek')) {
        llmConfig.provider = 'deepseek';
        llmConfig.baseUrl = 'https://api.deepseek.com';
        llmConfig.model = selectedModel === 'deepseek-r1' ? 'deepseek-reasoner' : 'deepseek-chat';
      } else if (selectedModel.startsWith('gpt')) {
        llmConfig.provider = 'openai';
        llmConfig.baseUrl = 'https://api.openai.com/v1';
        llmConfig.model = selectedModel;
      } else if (selectedModel.startsWith('claude')) {
        llmConfig.provider = 'anthropic';
        llmConfig.baseUrl = 'https://api.anthropic.com';
        llmConfig.model = selectedModel;
      } else {
        // 最后的后备
        llmConfig.provider = 'deepseek';
        llmConfig.baseUrl = 'https://api.deepseek.com';
        llmConfig.model = 'deepseek-chat';
      }
    }
    
    log(`使用 ${llmConfig.provider} 模型: ${llmConfig.model}`);
    log(`API地址: ${llmConfig.baseUrl}`);
    updateGeneratingStatus('AI 正在思考创意...');
    
    const startTime = Date.now();
    
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, llmConfig }),
      signal: state.abortController.signal
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`API 响应完成，耗时 ${elapsed}秒`);
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || '生成失败');
    }
    
    log(`游戏生成成功: ${data.title}`, 'success');
    
    // 显示调试信息
    if (data.debug) {
      log(`代码长度: ${data.debug.codeLength} 字符`);
      if (data.debug.apiTime) {
        log(`服务端耗时: ${data.debug.apiTime}ms`);
      }
      if (data.debug.tokens) {
        log(`Token使用: 输入${data.debug.tokens.prompt_tokens}, 输出${data.debug.tokens.completion_tokens}`);
      }
    }
    
    // 验证HTML代码结构
    const code = data.code || '';
    const hasDoctype = code.toLowerCase().includes('<!doctype');
    const hasHtml = code.includes('<html');
    const hasScript = code.includes('<script');
    const hasCanvas = code.includes('<canvas') || code.includes('getContext');
    
    log(`HTML验证: DOCTYPE=${hasDoctype}, HTML=${hasHtml}, Script=${hasScript}, Canvas=${hasCanvas}`);
    
    if (!hasScript) {
      log('警告: 生成的代码可能缺少JavaScript脚本', 'warn');
    }
    
    // 检查是否已被取消
    if (backgroundTask.isCancelled) {
      log('生成完成，但已被取消', 'warn');
      return;
    }
    
    // 判断是否在后台模式
    if (backgroundTask.isMinimized) {
      // 后台模式：保存结果，显示通知
      backgroundTask.result = {
        title: data.title,
        code: data.code
      };
      
      document.getElementById('generating-float').classList.remove('active');
      showGenerationNotify();
      
      log(`后台生成完成: ${data.title}`, 'success');
      showToast('游戏生成完成！点击通知查看', 'success');
    } else {
      // 前台模式：直接显示结果
      state.currentGame = {
        title: data.title,
        prompt: prompt,
        code: data.code,
        isNew: true
      };
      state.currentGameId = null;
      
      // 隐藏生成遮罩
      document.getElementById('generating-overlay').classList.remove('active');
      
      // 显示保存弹窗并预览
      openSaveModal();
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      log('生成被用户取消', 'warn');
    } else {
      log('生成失败: ' + error.message, 'error');
      showToast(error.message || '生成失败，请重试', 'error');
    }
    document.getElementById('generating-overlay').classList.remove('active');
    document.getElementById('generating-float').classList.remove('active');
  } finally {
    state.isGenerating = false;
    state.abortController = null;
    backgroundTask.isActive = false;
    stopGeneratingTimer();
    btn.classList.remove('loading');
  }
}

// 打开保存弹窗
function openSaveModal() {
  const modal = document.getElementById('save-modal');
  modal.classList.add('active');
  
  document.getElementById('save-title').value = state.currentGame?.title || '';
  document.getElementById('save-author').value = state.settings.authorName || '';
  
  // 停止生成计时器
  stopGeneratingTimer();
  
  // 在预览iframe中加载游戏（完整加载，可直接玩）
  const previewFrame = document.getElementById('preview-frame');
  if (previewFrame && state.currentGame?.code) {
    // 直接加载游戏代码，不做缩放处理，让用户可以直接玩
    previewFrame.srcdoc = state.currentGame.code;
    // 保存原始代码用于调试
    state.currentGameCode = state.currentGame.code;
  }
}

// 切换预览区域全屏
function toggleFullscreenPreview() {
  const previewArea = document.querySelector('.preview-play-area');
  if (previewArea) {
    previewArea.classList.toggle('fullscreen');
  }
}

// 关闭保存弹窗
function closeSaveModal() {
  const modal = document.getElementById('save-modal');
  modal.classList.remove('active');
  
  // 重置弹窗标题
  const modalHeader = modal.querySelector('.modal-header h3');
  if (modalHeader) {
    modalHeader.textContent = '🎮 游戏生成完成！';
  }
  
  // 清除编辑标记
  if (state.currentGame) {
    state.currentGame.isEditing = false;
  }
}

// 确认保存游戏
async function confirmSaveGame() {
  const title = document.getElementById('save-title').value.trim() || state.currentGame?.title;
  const authorName = document.getElementById('save-author').value.trim() || '匿名';
  
  try {
    // 获取或生成作者令牌
    let authorToken = getAuthorToken();
    
    // 检查是否为编辑模式
    const isEditing = state.currentGame?.isEditing && state.currentGameId;
    
    let response;
    if (isEditing) {
      // 更新现有游戏
      response = await fetch(`/api/games/${state.currentGameId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Author-Token': authorToken
        },
        body: JSON.stringify({
          title,
          code: state.currentGame.code
        })
      });
    } else {
      // 创建新游戏
      response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          prompt: state.currentGame.prompt,
          code: state.currentGame.code,
          authorName,
          authorToken
        })
      });
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || '保存失败');
    }
    
    // 保存游戏ID的作者令牌映射（仅新游戏）
    if (!isEditing && data.id) {
      saveGameAuthorToken(data.id, authorToken);
      state.currentGameId = data.id;
    }
    
    // 清除编辑标记
    if (state.currentGame) {
      state.currentGame.isEditing = false;
    }
    
    closeSaveModal();
    showToast(isEditing ? '游戏已更新！' : '游戏已保存！', 'success');
    
    // 跳转到游戏页面
    state.currentGame.isNew = false;
    displayGame(state.currentGame.code, title, authorName);
    history.pushState(null, '', `/game/${state.currentGameId}`);
    
    // 刷新游戏列表
    loadGames();
    
  } catch (error) {
    console.error('保存游戏失败:', error);
    showToast(error.message || '保存失败，请重试', 'error');
  }
}

// 打开游戏
async function openGame(gameId) {
  await loadGameById(gameId);
  history.pushState(null, '', `/game/${gameId}`);
}

// 显示游戏加载状态
function showGameLoading(show) {
  const loading = document.getElementById('game-loading');
  const error = document.getElementById('game-error');
  if (loading) {
    if (show) {
      loading.classList.add('active');
    } else {
      loading.classList.remove('active');
    }
  }
  if (error) error.style.display = 'none';
}

// 显示游戏错误状态
function showGameError(show) {
  const loading = document.getElementById('game-loading');
  const error = document.getElementById('game-error');
  if (loading) loading.classList.remove('active');
  if (error) error.style.display = show ? 'flex' : 'none';
}

// 重新加载游戏
function reloadGame() {
  if (state.currentGameId) {
    loadGameById(state.currentGameId);
  } else if (state.currentGame?.code) {
    displayGame(state.currentGame.code, state.currentGame.title, state.currentGame.author_name);
  }
}

// 通过ID加载游戏
async function loadGameById(gameId) {
  log(`加载游戏: ${gameId}`);
  showGamePage();
  showGameLoading(true);
  
  try {
    const response = await fetch(`/api/games/${gameId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || '加载失败');
    }
    
    state.currentGame = data.game;
    state.currentGameId = gameId;
    
    log(`游戏加载成功: ${data.game.title}`, 'success');
    log(`代码长度: ${data.game.code?.length || 0} 字符`);
    
    displayGame(data.game.code, data.game.title, data.game.author_name);
    
    // 检查是否为作者
    checkIsAuthor(gameId);
    
    // 更新点赞数
    document.getElementById('like-count').textContent = data.game.like_count || 0;
    
    // 检查点赞和收藏状态
    checkLikeStatus(gameId);
    checkFavoriteStatus(gameId);
    
  } catch (error) {
    log('加载游戏失败: ' + error.message, 'error');
    showGameError(true);
    showToast('游戏加载失败', 'error');
  }
}

// 显示游戏
function displayGame(code, title, authorName) {
  showGamePage();
  showGameLoading(true);
  
  document.getElementById('game-title').textContent = title || '未命名游戏';
  document.getElementById('game-author').textContent = `作者：${authorName || '匿名'}`;
  
  const iframe = document.getElementById('game-frame');
  
  // 预处理代码 - 确保有完整的HTML结构
  let processedCode = code || '';
  
  // 如果代码不包含完整的HTML结构，包装它
  if (!processedCode.toLowerCase().includes('<!doctype')) {
    log('警告: 代码缺少DOCTYPE，正在修复...', 'warn');
    processedCode = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || '游戏'}</title>
  <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { background: #1a1a2e; color: white; }</style>
</head>
<body>
${processedCode}
</body>
</html>`;
  }
  
  // 只在调试模式下注入调试脚本
  if (state.debugMode) {
    const errorCatchScript = `
<script>
(function() {
  // 创建调试信息显示区域（放在左上角，不遮挡游戏按钮）
  function showDebugInfo(msg, isError) {
    console.log('[GameDebug]', msg);
    var debugDiv = document.getElementById('__game_debug__');
    if (!debugDiv) {
      debugDiv = document.createElement('div');
      debugDiv.id = '__game_debug__';
      debugDiv.style.cssText = 'position:fixed;top:60px;left:10px;max-width:300px;max-height:120px;overflow:auto;background:rgba(0,0,0,0.75);color:#0f0;padding:8px;border-radius:6px;z-index:99999;font-size:11px;font-family:monospace;pointer-events:none;';
      document.body.appendChild(debugDiv);
    }
    var line = document.createElement('div');
    line.style.color = isError ? '#f55' : '#0f0';
    line.textContent = (isError ? '[ERR] ' : '[OK] ') + msg;
    debugDiv.appendChild(line);
    debugDiv.scrollTop = debugDiv.scrollHeight;
  }
  
  window.onerror = function(msg, url, lineNo) {
    showDebugInfo('JS: ' + msg + ' (L' + lineNo + ')', true);
    return false;
  };
  
  window.addEventListener('load', function() {
    showDebugInfo('页面加载完成');
    var canvas = document.querySelector('canvas');
    if (canvas) showDebugInfo('Canvas: ' + canvas.width + 'x' + canvas.height);
  });
})();
</script>`;
    
    if (processedCode.includes('</head>')) {
      processedCode = processedCode.replace('</head>', errorCatchScript + '</head>');
    } else if (processedCode.includes('<body')) {
      processedCode = processedCode.replace('<body', errorCatchScript + '<body');
    }
  }
  
  // 监听iframe加载完成
  iframe.onload = () => {
    log('游戏iframe加载完成', 'success');
    showGameLoading(false);
    
    // 自动聚焦iframe使其能接收键盘事件
    try {
      iframe.focus();
      // 尝试聚焦iframe内部的body
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
      }
    } catch (e) {
      log('自动聚焦失败: ' + e.message, 'warn');
    }
    
    // 检查iframe内容是否为空
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const bodyContent = iframeDoc.body ? iframeDoc.body.innerHTML.trim() : '';
      const hasCanvas = iframeDoc.querySelector('canvas');
      const hasVisibleContent = bodyContent.length > 0 || hasCanvas;
      
      log(`iframe内容检查: body长度=${bodyContent.length}, 有Canvas=${!!hasCanvas}`);
      
      if (!hasVisibleContent) {
        log('警告: iframe body为空，游戏可能未正确渲染', 'warn');
      }
    } catch (e) {
      log('无法检查iframe内容: ' + e.message, 'warn');
    }
    
    // 显示调试面板
    if (state.debugMode) {
      const debugPanel = document.getElementById('debug-panel');
      if (debugPanel) {
        debugPanel.style.display = 'block';
        const debugContent = document.getElementById('debug-content');
        if (debugContent) {
          debugContent.textContent = `游戏: ${title}\n代码长度: ${processedCode?.length || 0} 字符\n\n--- 代码预览 (前500字符) ---\n${processedCode?.substring(0, 500)}...`;
        }
      }
    }
  };
  
  iframe.onerror = (e) => {
    log('游戏iframe加载错误: ' + e, 'error');
    showGameError(true);
  };
  
  // 注入代码
  log(`注入游戏代码，长度: ${processedCode?.length || 0} 字符`);
  
  // 保存原始代码用于调试
  state.currentGameCode = processedCode;
  
  iframe.srcdoc = processedCode;
}

// 查看游戏源代码（调试用）
function viewGameSource() {
  if (state.currentGameCode) {
    const newWindow = window.open('', '_blank');
    newWindow.document.write('<pre style="white-space:pre-wrap;word-wrap:break-word;background:#1a1a2e;color:#eee;padding:20px;margin:0;">' + 
      escapeHtml(state.currentGameCode) + '</pre>');
    newWindow.document.close();
  } else {
    showToast('没有可查看的代码', 'error');
  }
}

// 检查是否为作者
async function checkIsAuthor(gameId) {
  const authorToken = getGameAuthorToken(gameId);
  const editBtn = document.getElementById('edit-btn');
  
  if (!authorToken) {
    editBtn.style.display = 'none';
    return;
  }
  
  try {
    const response = await fetch(`/api/games/${gameId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorToken })
    });
    
    const data = await response.json();
    editBtn.style.display = data.isAuthor ? 'flex' : 'none';
  } catch (error) {
    editBtn.style.display = 'none';
  }
}

// 保存游戏作者令牌映射
function saveGameAuthorToken(gameId, token) {
  const tokens = JSON.parse(localStorage.getItem('aigame-game-tokens') || '{}');
  tokens[gameId] = token;
  localStorage.setItem('aigame-game-tokens', JSON.stringify(tokens));
}

// 获取游戏作者令牌
function getGameAuthorToken(gameId) {
  const tokens = JSON.parse(localStorage.getItem('aigame-game-tokens') || '{}');
  return tokens[gameId];
}

// 点赞游戏
async function likeGame() {
  if (!state.currentGameId) return;
  
  try {
    const response = await fetch(`/api/games/${state.currentGameId}/like`, {
      method: 'POST',
      headers: { 'X-User-Token': getAuthorToken() }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 更新点赞数显示
      const likeCountEl = document.getElementById('like-count');
      const statLikesEl = document.getElementById('stat-likes');
      if (likeCountEl) likeCountEl.textContent = data.likeCount;
      if (statLikesEl) statLikesEl.textContent = data.likeCount;
      
      // 更新顶部操作栏点赞按钮状态
      const likeIcon = document.getElementById('like-icon');
      const likeBtn = document.getElementById('like-btn');
      if (likeIcon) likeIcon.textContent = data.liked ? '❤️' : '🤍';
      if (likeBtn) likeBtn.classList.toggle('liked', data.liked);
      
      // 更新统计条点赞按钮状态
      const statLikeIcon = document.getElementById('stat-like-icon');
      const statLikeBtn = document.getElementById('stat-like-btn');
      if (statLikeIcon) statLikeIcon.textContent = data.liked ? '❤️' : '🤍';
      if (statLikeBtn) statLikeBtn.classList.toggle('liked', data.liked);
      
      showToast(data.liked ? '感谢点赞！❤️' : '已取消点赞', data.liked ? 'success' : 'info');
    }
  } catch (error) {
    console.error('点赞失败:', error);
    showToast('操作失败，请重试', 'error');
  }
}

// 分享游戏
function shareGame() {
  if (!state.currentGameId) {
    showToast('请先保存游戏', 'error');
    return;
  }
  
  const url = `${window.location.origin}/game/${state.currentGameId}`;
  document.getElementById('share-url').value = url;
  document.getElementById('share-modal').classList.add('active');
}

// 关闭分享弹窗
function closeShareModal() {
  document.getElementById('share-modal').classList.remove('active');
}

// 复制分享链接
function copyShareUrl() {
  const input = document.getElementById('share-url');
  input.select();
  document.execCommand('copy');
  showToast('链接已复制', 'success');
}

// 分享到微信（打开二维码）
function shareToWechat() {
  showToast('请截图分享到微信');
}

// 分享到微博
function shareToWeibo() {
  const url = document.getElementById('share-url').value;
  const title = state.currentGame?.title || '一句话生成的游戏';
  const weiboUrl = `http://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  window.open(weiboUrl, '_blank');
}

// 编辑游戏
function editGame() {
  if (!state.currentGame || !state.currentGameId) return;
  
  // 将游戏内容填入输入框
  document.getElementById('prompt-input').value = state.currentGame.prompt;
  showHome();
  document.getElementById('prompt-input').focus();
  
  showToast('修改描述后重新生成游戏');
}

// 切换全屏
function toggleFullscreen() {
  document.body.classList.toggle('fullscreen');
  
  const container = document.querySelector('.game-frame-container');
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    container.requestFullscreen().catch(err => {
      console.log('全屏模式不可用');
    });
  }
}

// 显示Toast提示
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast active';
  if (type) {
    toast.classList.add(type);
  }
  
  setTimeout(() => {
    toast.classList.remove('active');
  }, 3000);
}

// 工具函数：转义HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 工具函数：简单哈希
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

// 工具函数：格式化时间
function formatTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  
  return date.toLocaleDateString('zh-CN');
}

// 工具函数：生成UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==================== 积分系统 ====================

// 加载用户积分
async function loadCredits() {
  try {
    const response = await fetch('/api/credits', {
      headers: { 'X-User-Token': getUserToken() }
    });
    const data = await response.json();
    
    if (data.success) {
      state.credits = data.credits;
      state.creditsConfig = data.config;
      updateCreditsDisplay();
    }
  } catch (error) {
    console.error('加载积分失败:', error);
  }
}

// 更新积分显示
function updateCreditsDisplay() {
  const navCount = document.getElementById('nav-credits-count');
  const modalCount = document.getElementById('credits-count');
  
  if (navCount) navCount.textContent = state.credits;
  if (modalCount) modalCount.textContent = state.credits;
}

// 打开积分弹窗
function openCreditsModal() {
  loadCredits().then(() => {
    const modal = document.getElementById('credits-modal');
    modal.classList.add('active');
    
    // 更新广告次数显示
    if (state.creditsConfig) {
      const adLimit = document.getElementById('ad-daily-limit');
      if (adLimit) adLimit.textContent = state.creditsConfig.dailyLimit;
    }
  });
}

// 关闭积分弹窗
function closeCreditsModal() {
  document.getElementById('credits-modal').classList.remove('active');
}

// 显示公众号验证
function showWechatVerify() {
  const section = document.getElementById('wechat-verify-section');
  section.style.display = section.style.display === 'none' ? 'block' : 'none';
}

// 验证公众号关注
async function verifyWechatFollow() {
  const code = document.getElementById('wechat-verify-code').value.trim();
  
  if (!code) {
    showToast('请输入验证码', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/credits/follow-wechat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      },
      body: JSON.stringify({ verifyCode: code })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(data.message, 'success');
      state.credits = data.credits;
      updateCreditsDisplay();
      document.getElementById('wechat-verify-section').style.display = 'none';
      
      // 禁用关注按钮
      const wayWechat = document.getElementById('way-wechat');
      if (wayWechat) {
        wayWechat.classList.add('disabled');
        wayWechat.querySelector('.credit-way-desc').textContent = '已领取';
      }
    } else {
      showToast(data.error || '验证失败', 'error');
    }
  } catch (error) {
    showToast('验证失败，请重试', 'error');
  }
}

// 看广告获取积分
async function watchAd() {
  // 这里应该接入真实的广告SDK
  // 目前简单模拟广告观看
  showToast('正在加载广告...', 'info');
  
  // 模拟广告播放
  setTimeout(async () => {
    try {
      const response = await fetch('/api/credits/watch-ad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Token': getUserToken()
        },
        body: JSON.stringify({ adId: 'mock-ad-' + Date.now() })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast(data.message, 'success');
        state.credits = data.credits;
        updateCreditsDisplay();
        
        // 更新今日广告次数
        const adCountEl = document.getElementById('ad-count-today');
        if (adCountEl) adCountEl.textContent = data.adCountToday;
      } else {
        showToast(data.error || '获取积分失败', 'error');
      }
    } catch (error) {
      showToast('操作失败，请重试', 'error');
    }
  }, 2000);
}

// 分享获取积分
function shareForCredits() {
  if (!state.currentGameId) {
    showToast('请先创作并保存一个游戏', 'error');
    closeCreditsModal();
    return;
  }
  
  closeCreditsModal();
  shareGame();
}

// ==================== 个人中心 ====================

// 打开个人中心弹窗
function openProfileModal() {
  const modal = document.getElementById('profile-modal');
  modal.classList.add('active');
  loadProfileData();
  loadMyGames();
}

// 关闭个人中心弹窗
function closeProfileModal() {
  document.getElementById('profile-modal').classList.remove('active');
}

// ==================== 全部游戏弹窗 ====================
let allGamesOffset = 0;
const ALL_GAMES_LIMIT = 20;
let allGamesLoading = false;
let allGamesHasMore = true;

// 打开全部游戏弹窗
async function openAllGamesModal() {
  const modal = document.getElementById('all-games-modal');
  if (!modal) return;
  
  // 重置状态
  allGamesOffset = 0;
  allGamesHasMore = true;
  
  // 清空并显示加载状态
  const grid = document.getElementById('all-games-grid');
  if (grid) {
    grid.innerHTML = '<div class="loading-spinner">加载中...</div>';
  }
  
  modal.classList.add('active');
  
  // 加载第一批数据
  await loadAllGames(true);
}

// 关闭全部游戏弹窗
function closeAllGamesModal() {
  const modal = document.getElementById('all-games-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// 加载全部游戏数据
async function loadAllGames(isInitial = false) {
  if (allGamesLoading || (!isInitial && !allGamesHasMore)) return;
  
  allGamesLoading = true;
  const loadMoreBtn = document.getElementById('load-more-all-games');
  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = '加载中...';
  }
  
  try {
    const response = await fetch(`/api/games?sort=newest&limit=${ALL_GAMES_LIMIT}&offset=${allGamesOffset}`);
    const data = await response.json();
    
    if (data.success && data.games) {
      const grid = document.getElementById('all-games-grid');
      if (!grid) return;
      
      // 如果是初始加载，清空容器
      if (isInitial) {
        grid.innerHTML = '';
      }
      
      // 渲染游戏卡片
      data.games.forEach(game => {
        grid.innerHTML += createGameCard(game);
      });
      
      // 更新offset和是否还有更多
      allGamesOffset += data.games.length;
      allGamesHasMore = data.games.length >= ALL_GAMES_LIMIT;
      
      // 更新按钮状态
      if (loadMoreBtn) {
        loadMoreBtn.style.display = allGamesHasMore ? 'inline-flex' : 'none';
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = '加载更多';
      }
    }
  } catch (error) {
    console.error('加载全部游戏失败:', error);
    showToast('加载失败，请稍后重试', 'error');
  } finally {
    allGamesLoading = false;
  }
}

// 加载更多全部游戏
function loadMoreAllGames() {
  loadAllGames(false);
}

// 切换个人中心标签页
function switchProfileTab(tabName) {
  // 切换标签按钮状态
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  // 切换内容区域
  document.querySelectorAll('.profile-tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
  
  // 加载对应数据
  switch(tabName) {
    case 'my-games':
      loadMyGames();
      break;
    case 'my-likes':
      loadMyLikes();
      break;
    case 'my-favorites':
      loadMyFavorites();
      break;
    case 'my-settings':
      loadProfileSettings();
      break;
  }
}

// 加载个人中心数据
async function loadProfileData() {
  // 设置用户名
  const username = state.settings.authorName || '游戏创作者';
  document.getElementById('profile-username').textContent = username;
  
  // 加载积分
  await loadCredits();
  document.getElementById('profile-credits').textContent = state.credits || 0;
  document.getElementById('profile-credits-value').textContent = state.credits || 0;
  
  // 加载游戏统计
  try {
    const response = await fetch('/api/my-games', {
      headers: { 'X-Author-Token': getAuthorToken() }
    });
    const data = await response.json();
    if (data.success) {
      document.getElementById('profile-game-count').textContent = data.stats?.count || 0;
      document.getElementById('profile-like-count').textContent = data.stats?.likes || 0;
    }
  } catch (e) {
    console.error('加载个人统计失败:', e);
  }
}

// 加载个人设置到表单
function loadProfileSettings() {
  const modelSelect = document.getElementById('profile-model-select');
  const apiKeyInput = document.getElementById('profile-api-key');
  const authorNameInput = document.getElementById('profile-author-name');
  const debugMode = document.getElementById('profile-debug-mode');
  const baseUrlInput = document.getElementById('profile-base-url');
  const customModelInput = document.getElementById('profile-custom-model');
  
  if (modelSelect) modelSelect.value = state.settings.llmModelId || 'deepseek-v3';
  if (apiKeyInput) apiKeyInput.value = state.settings.llmApiKey || '';
  if (authorNameInput) authorNameInput.value = state.settings.authorName || '';
  if (debugMode) debugMode.checked = state.settings.debugMode || false;
  if (baseUrlInput) baseUrlInput.value = state.settings.llmBaseUrl || '';
  if (customModelInput) customModelInput.value = state.settings.llmModel || '';
  
  // 显示/隐藏自定义字段
  onProfileModelChange();
}

// 个人中心模型选择变化
function onProfileModelChange() {
  const select = document.getElementById('profile-model-select');
  if (!select) return;
  
  const modelId = select.value;
  const baseUrlGroup = document.getElementById('profile-base-url-group');
  const customModelGroup = document.getElementById('profile-custom-model-group');
  
  if (modelId === 'custom') {
    if (baseUrlGroup) baseUrlGroup.style.display = 'block';
    if (customModelGroup) customModelGroup.style.display = 'block';
  } else {
    if (baseUrlGroup) baseUrlGroup.style.display = 'none';
    if (customModelGroup) customModelGroup.style.display = 'none';
  }
}

// 切换个人中心API Key可见性
function toggleProfileApiKeyVisibility() {
  const input = document.getElementById('profile-api-key');
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

// 保存个人中心设置
function saveProfileSettings() {
  const modelSelect = document.getElementById('profile-model-select');
  const apiKeyInput = document.getElementById('profile-api-key');
  const authorNameInput = document.getElementById('profile-author-name');
  const debugMode = document.getElementById('profile-debug-mode');
  const baseUrlInput = document.getElementById('profile-base-url');
  const customModelInput = document.getElementById('profile-custom-model');
  
  // 更新 state
  state.settings.llmModelId = modelSelect?.value || 'deepseek-v3';
  state.settings.llmProvider = modelSelect?.value || 'deepseek-v3';
  state.settings.llmApiKey = apiKeyInput?.value || '';
  state.settings.authorName = authorNameInput?.value || '';
  state.settings.debugMode = debugMode?.checked || false;
  state.settings.llmBaseUrl = baseUrlInput?.value || '';
  state.settings.llmModel = customModelInput?.value || '';
  
  // 保存到 localStorage
  localStorage.setItem('aigame-settings', JSON.stringify(state.settings));
  
  // 更新用户名显示
  document.getElementById('profile-username').textContent = state.settings.authorName || '游戏创作者';
  
  showToast('设置已保存', 'success');
}

// 兼容旧函数名
function openMyGamesModal() {
  openProfileModal();
}

function closeMyGamesModal() {
  closeProfileModal();
}

// 加载我的游戏列表
async function loadMyGames() {
  const listContainer = document.getElementById('my-games-list');
  const statsContainer = document.getElementById('my-games-stats');
  
  listContainer.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const response = await fetch('/api/my-games', {
      headers: { 'X-Author-Token': getAuthorToken() }
    });
    const data = await response.json();
    
    if (data.success) {
      // 更新统计
      if (statsContainer && data.stats) {
        statsContainer.innerHTML = `
          <span class="stat-item">🎮 ${data.stats.count} 个游戏</span>
          <span class="stat-item">▶️ ${data.stats.plays} 次游玩</span>
          <span class="stat-item">❤️ ${data.stats.likes} 个喜欢</span>
        `;
      }
      
      // 渲染游戏列表
      if (data.games && data.games.length > 0) {
        listContainer.innerHTML = data.games.map(game => `
          <div class="my-game-item" data-id="${game.id}">
            <div class="my-game-info">
              <div class="my-game-title">${escapeHtml(game.title)}</div>
              <div class="my-game-prompt">${escapeHtml(game.prompt || '')}</div>
              <div class="my-game-meta">
                <span>▶️ ${game.play_count || 0}</span>
                <span>❤️ ${game.like_count || 0}</span>
                <span>📅 ${formatDate(game.created_at)}</span>
              </div>
            </div>
            <div class="my-game-actions">
              <button class="btn btn-small btn-primary" onclick="playMyGame('${game.id}')">
                ▶️ 游玩
              </button>
              <button class="btn btn-small btn-secondary" onclick="editMyGame('${game.id}')">
                ✏️ 编辑
              </button>
              <button class="btn btn-small btn-danger" onclick="deleteMyGame('${game.id}', '${escapeHtml(game.title)}')">
                🗑️ 删除
              </button>
            </div>
          </div>
        `).join('');
      } else {
        listContainer.innerHTML = `
          <div class="empty-games">
            <div class="empty-icon">🎮</div>
            <div class="empty-text">还没有创建任何游戏</div>
            <div class="empty-hint">使用上方的生成器开始创作吧！</div>
          </div>
        `;
      }
    } else {
      listContainer.innerHTML = '<div class="error-games">加载失败，请重试</div>';
    }
  } catch (error) {
    console.error('加载我的游戏失败:', error);
    listContainer.innerHTML = '<div class="error-games">加载失败，请重试</div>';
  }
}

// 加载我的点赞列表
async function loadMyLikes() {
  const listContainer = document.getElementById('my-likes-list');
  if (!listContainer) return;
  
  listContainer.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const response = await fetch('/api/my-likes', {
      headers: { 'X-User-Token': getAuthorToken() }
    });
    const data = await response.json();
    
    if (data.success && data.games && data.games.length > 0) {
      listContainer.innerHTML = data.games.map(game => `
        <div class="my-game-item" data-id="${game.id}">
          <div class="my-game-info">
            <div class="my-game-title">${escapeHtml(game.title)}</div>
            <div class="my-game-prompt">${escapeHtml(game.prompt || '')}</div>
            <div class="my-game-meta">
              <span>👤 ${escapeHtml(game.author_name || '匿名')}</span>
              <span>▶️ ${game.play_count || 0}</span>
              <span>❤️ ${game.like_count || 0}</span>
            </div>
          </div>
          <div class="my-game-actions">
            <button class="btn btn-small btn-primary" onclick="playMyGame('${game.id}')">
              ▶️ 游玩
            </button>
            <button class="btn btn-small btn-secondary" onclick="unlikeGame('${game.id}')">
              💔 取消点赞
            </button>
          </div>
        </div>
      `).join('');
    } else {
      listContainer.innerHTML = `
        <div class="empty-games">
          <div class="empty-icon">❤️</div>
          <div class="empty-text">还没有点赞任何游戏</div>
          <div class="empty-hint">浏览游戏广场，为喜欢的游戏点赞吧！</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('加载我的点赞失败:', error);
    listContainer.innerHTML = '<div class="error-games">加载失败，请重试</div>';
  }
}

// 加载我的收藏列表
async function loadMyFavorites() {
  const listContainer = document.getElementById('my-favorites-list');
  if (!listContainer) return;
  
  listContainer.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const response = await fetch('/api/my-favorites', {
      headers: { 'X-User-Token': getAuthorToken() }
    });
    const data = await response.json();
    
    if (data.success && data.games && data.games.length > 0) {
      listContainer.innerHTML = data.games.map(game => `
        <div class="my-game-item" data-id="${game.id}">
          <div class="my-game-info">
            <div class="my-game-title">${escapeHtml(game.title)}</div>
            <div class="my-game-prompt">${escapeHtml(game.prompt || '')}</div>
            <div class="my-game-meta">
              <span>👤 ${escapeHtml(game.author_name || '匿名')}</span>
              <span>▶️ ${game.play_count || 0}</span>
              <span>❤️ ${game.like_count || 0}</span>
            </div>
          </div>
          <div class="my-game-actions">
            <button class="btn btn-small btn-primary" onclick="playMyGame('${game.id}')">
              ▶️ 游玩
            </button>
            <button class="btn btn-small btn-secondary" onclick="unfavoriteGame('${game.id}')">
              ⭐ 取消收藏
            </button>
          </div>
        </div>
      `).join('');
    } else {
      listContainer.innerHTML = `
        <div class="empty-games">
          <div class="empty-icon">⭐</div>
          <div class="empty-text">还没有收藏任何游戏</div>
          <div class="empty-hint">浏览游戏广场，收藏你喜欢的游戏吧！</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('加载我的收藏失败:', error);
    listContainer.innerHTML = '<div class="error-games">加载失败，请重试</div>';
  }
}

// 取消点赞
async function unlikeGame(gameId) {
  try {
    const response = await fetch(`/api/games/${gameId}/like`, {
      method: 'POST',
      headers: { 'X-User-Token': getAuthorToken() }
    });
    const data = await response.json();
    if (data.success) {
      showToast('已取消点赞', 'info');
      loadMyLikes(); // 刷新列表
    }
  } catch (error) {
    console.error('取消点赞失败:', error);
    showToast('操作失败，请重试', 'error');
  }
}

// 取消收藏
async function unfavoriteGame(gameId) {
  try {
    const response = await fetch(`/api/games/${gameId}/favorite`, {
      method: 'POST',
      headers: { 'X-User-Token': getAuthorToken() }
    });
    const data = await response.json();
    if (data.success) {
      showToast('已取消收藏', 'info');
      loadMyFavorites(); // 刷新列表
    }
  } catch (error) {
    console.error('取消收藏失败:', error);
    showToast('操作失败，请重试', 'error');
  }
}

// 切换收藏状态
async function toggleFavorite() {
  if (!state.currentGameId) {
    showToast('请先打开一个游戏', 'warning');
    return;
  }
  
  console.log('[收藏] 正在切换收藏状态，游戏ID:', state.currentGameId);
  
  try {
    const response = await fetch(`/api/games/${state.currentGameId}/favorite`, {
      method: 'POST',
      headers: { 'X-User-Token': getAuthorToken() }
    });
    
    const data = await response.json();
    console.log('[收藏] 服务器响应:', data);
    
    if (data.success) {
      // 更新顶部操作栏收藏按钮状态（如果存在）
      const favoriteIcon = document.getElementById('favorite-icon');
      const favoriteBtn = document.getElementById('favorite-btn');
      if (favoriteIcon) favoriteIcon.textContent = data.favorited ? '⭐' : '☆';
      if (favoriteBtn) favoriteBtn.classList.toggle('favorited', data.favorited);
      
      // 更新统计条收藏按钮状态
      const statFavIcon = document.getElementById('stat-fav-icon');
      const statFavBtn = document.getElementById('stat-fav-btn');
      if (statFavIcon) statFavIcon.textContent = data.favorited ? '⭐' : '☆';
      if (statFavBtn) statFavBtn.classList.toggle('favorited', data.favorited);
      
      showToast(data.favorited ? '已添加到收藏 ⭐' : '已取消收藏', data.favorited ? 'success' : 'info');
    } else {
      showToast(data.error || '操作失败', 'error');
    }
  } catch (error) {
    console.error('收藏操作失败:', error);
    showToast('操作失败，请重试', 'error');
  }
}

// 加载游戏时检查收藏状态
async function checkFavoriteStatus(gameId) {
  try {
    const response = await fetch(`/api/games/${gameId}/favorite-status`, {
      headers: { 'X-User-Token': getAuthorToken() }
    });
    const data = await response.json();
    
    // 更新顶部操作栏
    const favoriteIcon = document.getElementById('favorite-icon');
    const favoriteBtn = document.getElementById('favorite-btn');
    if (favoriteIcon) favoriteIcon.textContent = data.favorited ? '⭐' : '☆';
    if (favoriteBtn) favoriteBtn.classList.toggle('favorited', data.favorited);
    
    // 更新统计条
    const statFavIcon = document.getElementById('stat-fav-icon');
    if (statFavIcon) statFavIcon.textContent = data.favorited ? '⭐' : '☆';
  } catch (error) {
    console.error('检查收藏状态失败:', error);
  }
}

// 加载游戏时检查点赞状态
async function checkLikeStatus(gameId) {
  try {
    const response = await fetch(`/api/games/${gameId}/like-status`, {
      headers: { 'X-User-Token': getAuthorToken() }
    });
    const data = await response.json();
    
    // 更新顶部操作栏
    const likeIcon = document.getElementById('like-icon');
    const likeBtn = document.getElementById('like-btn');
    if (likeIcon) likeIcon.textContent = data.liked ? '❤️' : '🤍';
    if (likeBtn) likeBtn.classList.toggle('liked', data.liked);
    
    // 更新统计条
    const statLikeIcon = document.getElementById('stat-like-icon');
    const statLikeBtn = document.getElementById('stat-like-btn');
    if (statLikeIcon) statLikeIcon.textContent = data.liked ? '❤️' : '🤍';
    if (statLikeBtn) statLikeBtn.classList.toggle('liked', data.liked);
  } catch (error) {
    console.error('检查点赞状态失败:', error);
  }
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
  
  return date.toLocaleDateString('zh-CN');
}

// 游玩我的游戏
function playMyGame(gameId) {
  closeMyGamesModal();
  window.location.href = `/play/${gameId}`;
}

// 编辑我的游戏
async function editMyGame(gameId) {
  try {
    const response = await fetch(`/api/games/${gameId}`);
    const data = await response.json();
    
    if (data.success && data.game) {
      closeMyGamesModal();
      
      // 设置当前游戏状态
      state.currentGameId = gameId;
      state.currentGame = {
        code: data.game.code,
        title: data.game.title,
        prompt: data.game.prompt,
        isEditing: true
      };
      state.currentGameCode = data.game.code;
      
      // 填充prompt到输入框
      const promptInput = document.getElementById('prompt-input');
      if (promptInput && data.game.prompt) {
        promptInput.value = data.game.prompt;
      }
      
      // 打开保存弹窗进行编辑
      const saveModal = document.getElementById('save-modal');
      const saveTitle = document.getElementById('save-title');
      const saveAuthor = document.getElementById('save-author');
      const previewFrame = document.getElementById('preview-frame');
      
      if (saveTitle) saveTitle.value = data.game.title || '';
      if (saveAuthor) saveAuthor.value = data.game.author_name || state.settings.authorName || '';
      
      // 加载游戏预览
      if (previewFrame && data.game.code) {
        previewFrame.srcdoc = data.game.code;
      }
      
      // 修改弹窗标题为编辑模式
      const modalHeader = saveModal.querySelector('.modal-header h3');
      if (modalHeader) {
        modalHeader.textContent = '✏️ 编辑游戏';
      }
      
      saveModal.classList.add('active');
      showToast('已加载游戏，可以修改后保存', 'success');
    } else {
      showToast('加载游戏失败', 'error');
    }
  } catch (error) {
    console.error('编辑游戏失败:', error);
    showToast('加载游戏失败', 'error');
  }
}

// 删除我的游戏
async function deleteMyGame(gameId, title) {
  if (!confirm(`确定要删除游戏「${title}」吗？\n\n此操作不可恢复！`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/games/${gameId}`, {
      method: 'DELETE',
      headers: { 'X-Author-Token': getAuthorToken() }
    });
    const data = await response.json();
    
    if (data.success) {
      showToast('游戏已删除', 'success');
      loadMyGames(); // 刷新列表
    } else {
      showToast(data.error || '删除失败', 'error');
    }
  } catch (error) {
    console.error('删除游戏失败:', error);
    showToast('删除失败', 'error');
  }
}

// HTML转义函数
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== 新模型选择系统 ====================

// 模型选择变化
function onModelSelectChange() {
  const select = document.getElementById('llm-model-select');
  if (!select) return;
  
  const modelId = select.value;
  const baseUrlGroup = document.getElementById('base-url-group');
  const customModelGroup = document.getElementById('custom-model-group');
  const modelHint = document.getElementById('model-hint');
  
  if (modelId === 'custom') {
    if (baseUrlGroup) baseUrlGroup.style.display = 'block';
    if (customModelGroup) customModelGroup.style.display = 'block';
    if (modelHint) modelHint.textContent = '输入自定义的 API 地址和模型名称';
  } else {
    if (baseUrlGroup) baseUrlGroup.style.display = 'none';
    if (customModelGroup) customModelGroup.style.display = 'none';
    
    // 从模型注册表获取提示信息
    const modelConfig = MODEL_REGISTRY[modelId];
    if (modelHint) {
      modelHint.textContent = modelConfig?.hint || '选择适合的 AI 模型';
    }
  }
  
  // 保存选择到 settings
  state.settings.llmProvider = modelId;
  state.settings.llmModelId = modelId;
}

// ==================== 体验模式系统 ====================

// 加载体验模式信息
async function loadTrialInfo() {
  try {
    const response = await fetch('/api/trial/status', {
      headers: { 'X-User-Token': getUserToken() }
    });
    const data = await response.json();
    
    if (data.success) {
      state.trialInfo = data;
      updateTrialBanner();
    }
  } catch (error) {
    console.error('加载体验模式信息失败:', error);
  }
}

// 更新体验模式横幅
function updateTrialBanner() {
  const banner = document.getElementById('trial-banner');
  const remaining = document.getElementById('trial-remaining');
  
  if (!banner || !state.trialInfo) return;
  
  // 只有没有API Key的用户才显示体验模式
  if (!state.settings.llmApiKey && state.trialInfo.enabled) {
    banner.style.display = 'inline-flex';
    remaining.textContent = state.trialInfo.userRemaining || 0;
  } else {
    banner.style.display = 'none';
  }
}

// 使用体验模式生成
async function generateWithTrial() {
  const prompt = document.getElementById('prompt-input').value.trim();
  
  if (!prompt) {
    showToast('请输入游戏描述', 'error');
    return false;
  }
  
  try {
    const response = await fetch('/api/trial/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      },
      body: JSON.stringify({ prompt })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 更新体验模式剩余次数
      if (state.trialInfo) {
        state.trialInfo.userRemaining = data.userRemaining;
        state.trialInfo.globalRemaining = data.globalRemaining;
        updateTrialBanner();
      }
      return data;
    } else {
      throw new Error(data.error || '体验生成失败');
    }
  } catch (error) {
    showToast(error.message, 'error');
    return null;
  }
}

// ==================== 邀请码系统 ====================

// 获取我的邀请码
async function getMyInviteCode() {
  try {
    const response = await fetch('/api/invite/my-code', {
      headers: { 'X-User-Token': getUserToken() }
    });
    const data = await response.json();
    
    if (data.success) {
      state.myInviteCode = data.code;
      return data.code;
    }
  } catch (error) {
    console.error('获取邀请码失败:', error);
  }
  return null;
}

// 使用邀请码
async function useInviteCode(code) {
  if (!code || code.length < 6) {
    showToast('请输入有效的邀请码', 'error');
    return false;
  }
  
  try {
    const response = await fetch('/api/invite/use', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      },
      body: JSON.stringify({ code: code.toUpperCase() })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(`🎉 ${data.message}`, 'success');
      state.credits = data.credits;
      updateCreditsDisplay();
      return true;
    } else {
      showToast(data.error || '邀请码无效', 'error');
      return false;
    }
  } catch (error) {
    showToast('使用邀请码失败', 'error');
    return false;
  }
}

// 复制邀请码
function copyInviteCode() {
  if (state.myInviteCode) {
    navigator.clipboard.writeText(state.myInviteCode).then(() => {
      showToast('邀请码已复制', 'success');
    }).catch(() => {
      // Fallback
      const input = document.createElement('input');
      input.value = state.myInviteCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast('邀请码已复制', 'success');
    });
  }
}

// 切换邀请码区域显示
async function toggleInviteSection() {
  const section = document.getElementById('invite-section');
  const isHidden = section.style.display === 'none';
  
  if (isHidden) {
    section.style.display = 'block';
    
    // 加载我的邀请码
    if (!state.myInviteCode) {
      const code = await getMyInviteCode();
      if (code) {
        document.getElementById('my-invite-code').textContent = code;
      } else {
        document.getElementById('my-invite-code').textContent = '获取失败';
      }
    } else {
      document.getElementById('my-invite-code').textContent = state.myInviteCode;
    }
  } else {
    section.style.display = 'none';
  }
}

// 提交使用邀请码
async function submitInviteCode() {
  const input = document.getElementById('invite-code-input');
  const code = input.value.trim();
  
  if (!code) {
    showToast('请输入邀请码', 'error');
    return;
  }
  
  const success = await useInviteCode(code);
  if (success) {
    input.value = '';
    // 关闭邀请区域
    document.getElementById('invite-section').style.display = 'none';
  }
}

// ==================== 本周挑战 ====================

// 加载本周挑战
async function loadWeeklyChallenge() {
  try {
    const response = await fetch('/api/challenge/current');
    const data = await response.json();
    
    if (data.success && data.challenge) {
      state.weeklyChallenge = data.challenge;
      updateChallengeDisplay();
    }
  } catch (error) {
    console.error('加载本周挑战失败:', error);
  }
}

// 更新挑战显示
function updateChallengeDisplay() {
  const themeEl = document.getElementById('challenge-theme');
  const descEl = document.getElementById('challenge-desc');
  const challengeBox = document.getElementById('weekly-challenge');
  
  if (!themeEl || !state.weeklyChallenge) return;
  
  themeEl.textContent = state.weeklyChallenge.theme;
  if (descEl) {
    descEl.textContent = state.weeklyChallenge.description || '';
  }
  
  // 点击挑战使用详细的prompt（如果有），否则使用theme
  if (challengeBox) {
    challengeBox.onclick = () => {
      const detailedPrompt = state.weeklyChallenge.prompt || state.weeklyChallenge.theme;
      setPrompt(detailedPrompt);
      showToast('已选择本周挑战主题，开始创作吧！', 'success');
    };
  }
}

// ==================== 排行榜 ====================

// 加载排行榜
async function loadLeaderboard(type = 'games') {
  try {
    const response = await fetch(`/api/leaderboard/${type}`);
    const data = await response.json();
    
    if (data.success) {
      return data.list || [];
    }
  } catch (error) {
    console.error('加载排行榜失败:', error);
  }
  return [];
}

// ==================== 增强版生成游戏 ====================

// 重写生成游戏函数，支持体验模式
const originalGenerateGame = generateGame;

async function generateGame() {
  const prompt = document.getElementById('prompt-input').value.trim();
  
  if (!prompt) {
    showToast('请输入游戏描述', 'error');
    return;
  }
  
  if (state.isGenerating) {
    return;
  }
  
  // 如果没有API Key，尝试使用体验模式
  if (!state.settings.llmApiKey) {
    // 检查体验模式是否可用
    if (state.trialInfo && state.trialInfo.enabled && state.trialInfo.userRemaining > 0) {
      state.isGenerating = true;
      state.abortController = new AbortController();
      
      const btn = document.querySelector('.btn-generate');
      btn.classList.add('loading');
      
      clearGeneratingLog();
      document.getElementById('generating-overlay').classList.add('active');
      
      log(`体验模式生成游戏: "${prompt}"`);
      updateGeneratingStatus('🎁 使用体验模式生成...');
      
      try {
        const data = await generateWithTrial();
        
        if (data && data.code) {
          log(`游戏生成成功: ${data.title}`, 'success');
          
          state.currentGame = {
            title: data.title,
            prompt: prompt,
            code: data.code,
            isNew: true
          };
          state.currentGameId = null;
          
          document.getElementById('generating-overlay').classList.remove('active');
          openSaveModal();
        } else {
          document.getElementById('generating-overlay').classList.remove('active');
        }
      } catch (error) {
        log('体验模式生成失败: ' + error.message, 'error');
        document.getElementById('generating-overlay').classList.remove('active');
      } finally {
        state.isGenerating = false;
        state.abortController = null;
        btn.classList.remove('loading');
      }
      return;
    }
    
    // 体验模式不可用，提示配置API Key
    showToast('体验次数已用完，请在设置中配置 API Key', 'error');
    openSettings();
    return;
  }
  
  // 有API Key，使用原版逻辑
  state.isGenerating = true;
  state.abortController = new AbortController();
  
  const btn = document.querySelector('.btn-generate');
  btn.classList.add('loading');
  
  clearGeneratingLog();
  document.getElementById('generating-overlay').classList.add('active');
  
  log(`开始生成游戏: "${prompt}"`);
  updateGeneratingStatus('正在连接 AI 服务...');
  
  try {
    // 构建LLM配置
    const llmConfig = {
      apiKey: state.settings.llmApiKey,
      modelId: state.settings.llmModelId || 'deepseek-v3'
    };
    
    // 根据模型ID确定provider和baseUrl
    const modelId = state.settings.llmModelId || 'deepseek-v3';
    if (modelId.startsWith('deepseek')) {
      llmConfig.provider = 'deepseek';
      llmConfig.baseUrl = 'https://api.deepseek.com';
      llmConfig.model = modelId === 'deepseek-r1' ? 'deepseek-reasoner' : 'deepseek-chat';
    } else if (modelId.startsWith('gpt')) {
      llmConfig.provider = 'openai';
      llmConfig.baseUrl = 'https://api.openai.com/v1';
      llmConfig.model = modelId;
    } else if (modelId.startsWith('claude')) {
      llmConfig.provider = 'anthropic';
      llmConfig.baseUrl = 'https://api.anthropic.com';
      llmConfig.model = modelId;
    } else if (modelId.startsWith('gemini')) {
      llmConfig.provider = 'google';
      llmConfig.model = modelId;
    } else if (modelId === 'custom') {
      llmConfig.provider = 'custom';
      llmConfig.baseUrl = state.settings.llmBaseUrl;
      llmConfig.model = state.settings.llmModel;
    } else {
      // 国产模型默认走代理
      llmConfig.provider = 'custom';
      llmConfig.model = modelId;
    }
    
    log(`使用 ${llmConfig.provider} (${llmConfig.model})`);
    updateGeneratingStatus('AI 正在思考创意...');
    
    const startTime = Date.now();
    
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      },
      body: JSON.stringify({ prompt, llmConfig }),
      signal: state.abortController.signal
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`API 响应完成，耗时 ${elapsed}秒`);
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || '生成失败');
    }
    
    log(`游戏生成成功: ${data.title}`, 'success');
    
    // 显示调试信息
    if (data.debug) {
      log(`代码长度: ${data.debug.codeLength} 字符`);
      if (data.debug.apiTime) {
        log(`服务端耗时: ${data.debug.apiTime}ms`);
      }
      if (data.debug.tokens) {
        log(`Token使用: 输入${data.debug.tokens.prompt_tokens}, 输出${data.debug.tokens.completion_tokens}`);
      }
    }
    
    // 保存游戏数据到状态
    state.currentGame = {
      title: data.title,
      prompt: prompt,
      code: data.code,
      isNew: true
    };
    state.currentGameId = null;
    
    // 隐藏生成遮罩
    document.getElementById('generating-overlay').classList.remove('active');
    
    // 显示保存弹窗并预览
    openSaveModal();
    
  } catch (error) {
    if (error.name === 'AbortError') {
      log('生成被用户取消', 'warn');
    } else {
      log('生成失败: ' + error.message, 'error');
      showToast(error.message || '生成失败，请重试', 'error');
    }
    document.getElementById('generating-overlay').classList.remove('active');
  } finally {
    state.isGenerating = false;
    state.abortController = null;
    btn.classList.remove('loading');
  }
}

// ==================== 社交统计系统 ====================

// 当前游戏统计缓存
let currentGameStats = null;
let playStartTime = null;

// 加载游戏统计
async function loadGameStats(gameId) {
  if (!gameId) return;
  
  try {
    const response = await fetch(`/api/games/${gameId}/stats`);
    const data = await response.json();
    
    if (data.success) {
      currentGameStats = data;
      updateStatsDisplay(data);
    }
  } catch (error) {
    console.error('加载游戏统计失败:', error);
  }
}

// 更新统计显示
function updateStatsDisplay(stats) {
  const statsBar = document.getElementById('game-stats-bar');
  if (!statsBar) return;
  
  // 显示统计栏
  statsBar.style.display = 'flex';
  
  // 更新各项数据
  animateStatValue('stat-plays', stats.plays || 0);
  animateStatValue('stat-likes', stats.likes || 0);
  animateStatValue('stat-shares', stats.shares || 0);
  animateStatValue('stat-hot', stats.hotScore || 0);
  
  // 更新点赞按钮状态
  updateLikeButtonState();
}

// 数字动画效果
function animateStatValue(elementId, newValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const currentValue = parseInt(el.textContent) || 0;
  
  if (newValue === currentValue) return;
  
  // 添加动画类
  el.classList.add('animating');
  
  // 数字递增动画
  const duration = 500;
  const startTime = Date.now();
  
  function updateValue() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // 使用缓动函数
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const displayValue = Math.round(currentValue + (newValue - currentValue) * easeOut);
    
    el.textContent = formatNumber(displayValue);
    
    if (progress < 1) {
      requestAnimationFrame(updateValue);
    } else {
      el.classList.remove('animating');
    }
  }
  
  requestAnimationFrame(updateValue);
}

// 格式化数字 (1000 -> 1k)
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

// 记录游戏开始
function recordPlayStart() {
  playStartTime = Date.now();
}

// 记录游戏结束/离开
async function recordPlayEnd() {
  if (!state.currentGameId || !playStartTime) return;
  
  const duration = Math.round((Date.now() - playStartTime) / 1000);
  playStartTime = null;
  
  // 只记录超过3秒的游戏时长
  if (duration < 3) return;
  
  try {
    const response = await fetch(`/api/games/${state.currentGameId}/play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      },
      body: JSON.stringify({ duration })
    });
    
    const data = await response.json();
    
    if (data.success && data.isNewPlay) {
      // 更新显示
      if (currentGameStats) {
        currentGameStats.plays = data.newPlayCount;
        updateStatsDisplay(currentGameStats);
      }
    }
  } catch (error) {
    console.error('记录游戏时长失败:', error);
  }
}

// 更新点赞按钮状态
function updateLikeButtonState() {
  const likeBtn = document.querySelector('.btn-like');
  if (!likeBtn) return;
  
  const likedGames = JSON.parse(localStorage.getItem('aigame-liked') || '[]');
  const isLiked = state.currentGameId && likedGames.includes(state.currentGameId);
  
  if (isLiked) {
    likeBtn.classList.add('liked');
    likeBtn.innerHTML = '<span class="like-icon">❤️</span> 已赞';
  } else {
    likeBtn.classList.remove('liked');
    likeBtn.innerHTML = '<span class="like-icon">🤍</span> 点赞';
  }
}


// 点赞动画
function showLikeAnimation() {
  const container = document.querySelector('.game-frame-container');
  if (!container) return;
  
  // 创建飘动的心形
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const heart = document.createElement('div');
      heart.textContent = '❤️';
      heart.style.cssText = `
        position: absolute;
        font-size: ${20 + Math.random() * 20}px;
        left: ${30 + Math.random() * 40}%;
        bottom: 20%;
        z-index: 1000;
        pointer-events: none;
        animation: floatUp 1.5s ease-out forwards;
      `;
      container.appendChild(heart);
      
      setTimeout(() => heart.remove(), 1500);
    }, i * 100);
  }
  
  // 添加CSS动画（如果不存在）
  if (!document.getElementById('like-animation-style')) {
    const style = document.createElement('style');
    style.id = 'like-animation-style';
    style.textContent = `
      @keyframes floatUp {
        0% { transform: translateY(0) scale(0); opacity: 1; }
        50% { transform: translateY(-100px) scale(1.2); opacity: 1; }
        100% { transform: translateY(-200px) scale(0.8); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

// 打开分享面板
function openSharePanel() {
  if (!state.currentGameId) {
    showToast('请先保存游戏', 'error');
    return;
  }
  
  const modal = document.getElementById('share-modal');
  
  // 更新分享预览
  const previewTitle = document.getElementById('share-game-title');
  const previewPlays = document.getElementById('share-play-count');
  const previewLikes = document.getElementById('share-like-count');
  const previewShares = document.getElementById('share-share-count');
  
  if (previewTitle) previewTitle.textContent = state.currentGame?.title || '我的游戏';
  if (previewPlays) previewPlays.textContent = currentGameStats?.plays || 0;
  if (previewLikes) previewLikes.textContent = currentGameStats?.likes || 0;
  if (previewShares) previewShares.textContent = currentGameStats?.shares || 0;
  
  // 设置分享链接
  const url = `${window.location.origin}/game/${state.currentGameId}`;
  document.getElementById('share-url').value = url;
  
  modal.classList.add('active');
}

// 分享到指定渠道
async function shareToChannel(platform) {
  const gameId = state.currentGameId;
  const gameTitle = state.currentGame?.title || '一句话生成的游戏';
  const gameUrl = `${window.location.origin}/game/${gameId}`;
  
  // 记录分享
  try {
    const response = await fetch(`/api/games/${gameId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      },
      body: JSON.stringify({ platform })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 更新统计
      if (currentGameStats) {
        currentGameStats.shares = data.shareCount;
        currentGameStats.hotScore = (currentGameStats.plays || 0) + 
                                     (currentGameStats.likes || 0) * 5 + 
                                     currentGameStats.shares * 3;
        updateStatsDisplay(currentGameStats);
      }
      
      // 如果获得积分奖励
      if (data.creditsAwarded) {
        showToast(`分享成功！获得 ${data.creditsAwarded} 积分 🎉`, 'success');
        state.credits += data.creditsAwarded;
        updateCreditsDisplay();
      }
    }
  } catch (error) {
    console.error('记录分享失败:', error);
  }
  
  // 执行实际分享
  switch (platform) {
    case 'wechat':
      // 微信需要通过截图分享
      showToast('请截图后分享到微信');
      break;
      
    case 'moments':
      // 朋友圈同样需要截图
      showToast('请截图后分享到朋友圈');
      break;
      
    case 'weibo':
      const weiboUrl = `http://service.weibo.com/share/share.php?url=${encodeURIComponent(gameUrl)}&title=${encodeURIComponent('我用一句话做了个游戏：' + gameTitle + ' 快来玩！')}`;
      window.open(weiboUrl, '_blank', 'width=600,height=400');
      break;
      
    case 'qq':
      const qqUrl = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(gameUrl)}&title=${encodeURIComponent(gameTitle)}&desc=${encodeURIComponent('一句话生成的AI游戏，快来玩！')}`;
      window.open(qqUrl, '_blank', 'width=600,height=400');
      break;
      
    case 'twitter':
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('I made a game with just one sentence: ' + gameTitle)}&url=${encodeURIComponent(gameUrl)}`;
      window.open(twitterUrl, '_blank', 'width=600,height=400');
      break;
      
    case 'copy':
    case 'link':
      copyShareUrl();
      break;
  }
  
  // 关闭分享面板
  closeShareModal();
}

// 重写 shareGame 函数
function shareGame() {
  openSharePanel();
}

// 加载热门游戏（按热度分数）
async function loadHotGames() {
  try {
    const response = await fetch('/api/games/hot');
    const data = await response.json();
    
    if (data.success && data.games) {
      renderHotGamesList(data.games);
    }
  } catch (error) {
    console.error('加载热门游戏失败:', error);
  }
}

// 渲染热门游戏列表
function renderHotGamesList(games) {
  const container = document.getElementById('hot-games');
  if (!container) return;
  
  container.innerHTML = '';
  
  games.forEach((game, index) => {
    const card = createGameCard(game);
    
    // 添加热门排名徽章
    if (index < 3) {
      const badge = document.createElement('div');
      badge.className = 'hot-badge';
      badge.textContent = ['🥇', '🥈', '🥉'][index];
      card.querySelector('.game-card-preview').appendChild(badge);
    }
    
    container.appendChild(card);
  });
}

// ==================== 初始化 ====================

// 初始化时加载所有数据
document.addEventListener('DOMContentLoaded', () => {
  loadCredits();
  loadTrialInfo();
  // loadWeeklyChallenge(); // 已移除本周挑战功能
  
  // 设置公众号点击事件
  const wayWechat = document.getElementById('way-wechat');
  if (wayWechat) {
    wayWechat.onclick = showWechatVerify;
  }
  
  // 页面离开时记录游戏时长
  window.addEventListener('beforeunload', () => {
    recordPlayEnd();
  });
});

// 在 loadGameById 后添加统计加载和播放记录
const originalLoadGameById = loadGameById;
loadGameById = async function(gameId) {
  // 先记录上一个游戏的时长
  await recordPlayEnd();
  
  // 调用原始加载函数
  await originalLoadGameById(gameId);
  
  // 加载统计并开始计时
  await loadGameStats(gameId);
  recordPlayStart();
  
  // 显示推广条（延迟显示）
  showPromoBarDelayed();
};

// ==================== 公众号推广系统 ====================

// 品牌配置
const BRAND_CONFIG = {
  name: '游戏开发技术教程',
  wechatId: 'GameDevLearning',
  slogan: '一句话，AI帮你写游戏',
  description: '网易十年游戏开发老兵｜聚焦Unity3D/UE4/UE5引擎、C#/C++语法，拆解图形渲染、物理动画、原理机制与源码',
  followReward: 3,
  // 替换为实际的公众号二维码图片URL
  qrcodeUrl: null  // 例如: '/images/wechat-qrcode.png'
};

// 显示品牌推广弹窗
function showBrandPromo() {
  const modal = document.getElementById('brand-promo-modal');
  if (modal) {
    modal.classList.add('active');
    
    // 如果有二维码图片，替换占位符
    if (BRAND_CONFIG.qrcodeUrl) {
      const qrPlaceholders = document.querySelectorAll('.qr-placeholder, .qrcode-placeholder');
      qrPlaceholders.forEach(el => {
        el.innerHTML = `<img src="${BRAND_CONFIG.qrcodeUrl}" alt="公众号二维码">`;
      });
    }
  }
}

// 关闭品牌推广弹窗
function closeBrandPromo() {
  const modal = document.getElementById('brand-promo-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// 关闭游戏页推广条
function closePromoBar() {
  const bar = document.getElementById('game-promo-bar');
  if (bar) {
    bar.classList.add('hidden');
    // 记住用户关闭了推广条，24小时内不再显示
    localStorage.setItem('aigame-promo-closed', Date.now().toString());
  }
}

// 延迟显示推广条
function showPromoBarDelayed() {
  const bar = document.getElementById('game-promo-bar');
  if (!bar) return;
  
  // 检查是否在24小时内关闭过
  const closedTime = localStorage.getItem('aigame-promo-closed');
  if (closedTime) {
    const hoursSinceClosed = (Date.now() - parseInt(closedTime)) / (1000 * 60 * 60);
    if (hoursSinceClosed < 24) {
      bar.classList.add('hidden');
      return;
    }
  }
  
  // 重置状态
  bar.classList.remove('hidden');
}

// 首次访问提示关注（可选：在用户第一次访问时弹出）
function checkFirstVisitPromo() {
  const hasVisited = localStorage.getItem('aigame-visited');
  if (!hasVisited) {
    localStorage.setItem('aigame-visited', 'true');
    // 首次访问，延迟5秒后显示关注提示
    setTimeout(() => {
      // 只在没有API Key的情况下提示
      if (!state.settings.llmApiKey) {
        showBrandPromo();
      }
    }, 5000);
  }
}

// 设置公众号二维码图片
function setWechatQRCode(imageUrl) {
  BRAND_CONFIG.qrcodeUrl = imageUrl;
  
  // 更新所有二维码占位符
  const qrPlaceholders = document.querySelectorAll('.qr-placeholder, .qrcode-placeholder');
  qrPlaceholders.forEach(el => {
    if (imageUrl) {
      el.innerHTML = `<img src="${imageUrl}" alt="公众号二维码">`;
    }
  });
}

// 在初始化时检查首次访问
document.addEventListener('DOMContentLoaded', () => {
  // 延迟检查首次访问提示
  setTimeout(checkFirstVisitPromo, 2000);
});
