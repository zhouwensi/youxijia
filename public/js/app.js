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
const DEFAULT_CREDITS = 5;  // 初始积分

const state = {
  currentGame: null,
  currentGameId: null,
  recentGamesOffset: 0,
  isGenerating: false,
  abortController: null,
  debugMode: false,
  credits: DEFAULT_CREDITS,
  creditsConfig: null,
  modelsConfig: null,
  trialInfo: null,  // 游客模式信息
  myInviteCode: null,  // 我的邀请码
  weeklyChallenge: null,  // 本周挑战
  isFirstGeneration: true,  // 是否为首次生成（不消耗积分）
  userEmail: '',  // 用户邮箱
  userEmailVerified: false,  // 邮箱是否已绑定
  // 主标签页状态
  mainTab: {
    current: 'recent',  // 当前选中的标签
    tabs: ['recent', 'hot', 'likes', 'favorites', 'featured'],
    offsets: { recent: 0, hot: 0, likes: 0, favorites: 0, featured: 0 },
    hasMore: { recent: true, hot: true, likes: true, favorites: true, featured: true },
    isLoading: { recent: false, hot: false, likes: false, favorites: false, featured: false },
    loaded: { recent: false, hot: false, likes: false, favorites: false, featured: false },
    pageSize: 20
  },
  // 账号系统
  account: {
    accountId: '',      // 系统生成的唯一账号
    nickname: '',       // 用户昵称（可中文）
    hasPassword: false, // 是否设置了密码
    loaded: false       // 是否已加载
  },
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

// 设置所有生成按钮的loading状态
function setGenerateButtonLoading(isLoading) {
  document.querySelectorAll('.btn-generate').forEach(btn => {
    if (isLoading) {
      btn.classList.add('loading');
    } else {
      btn.classList.remove('loading');
    }
  });
}

// 通用弹窗控制 - 打开弹窗并禁用背景滚动
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    // 阻止弹窗背景点击事件传播
    modal.addEventListener('click', handleModalBackgroundClick);
  }
}

// 通用弹窗控制 - 关闭弹窗并恢复背景滚动
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    modal.removeEventListener('click', handleModalBackgroundClick);
    // 检查是否还有其他弹窗打开
    const hasOpenModals = document.querySelector('.modal.active');
    if (!hasOpenModals) {
      document.body.classList.remove('modal-open');
    }
  }
}

// 处理弹窗背景点击（点击背景关闭弹窗）
function handleModalBackgroundClick(e) {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
    e.target.removeEventListener('click', handleModalBackgroundClick);
    const hasOpenModals = document.querySelector('.modal.active');
    if (!hasOpenModals) {
      document.body.classList.remove('modal-open');
    }
  }
}

// 关闭所有弹窗
function closeAllModals() {
  document.querySelectorAll('.modal.active').forEach(modal => {
    modal.classList.remove('active');
    modal.removeEventListener('click', handleModalBackgroundClick);
  });
  document.body.classList.remove('modal-open');
}

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
  initCredits();
  initAccount();  // 初始化账号
  initMainTabs();  // 初始化主标签页
  handleRouting();
  initBetaBanner();
  
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

// ==================== 内测横幅 ====================

// 初始化内测横幅
function initBetaBanner() {
  const betaBanner = document.getElementById('beta-banner');
  const dismissed = localStorage.getItem('aigame-beta-banner-dismissed');
  if (betaBanner && !dismissed) {
    betaBanner.style.display = 'flex';
  }
}

// 关闭内测横幅
function closeBetaBanner() {
  const betaBanner = document.getElementById('beta-banner');
  if (betaBanner) {
    betaBanner.style.display = 'none';
    localStorage.setItem('aigame-beta-banner-dismissed', 'true');
  }
}

// ==================== 积分初始化 ====================

// 初始化积分系统
function initCredits() {
  // 从localStorage加载积分
  const savedCredits = localStorage.getItem('aigame-credits');
  const isFirstGen = localStorage.getItem('aigame-first-generation');
  const savedEmail = localStorage.getItem('aigame-email');
  const emailVerified = localStorage.getItem('aigame-email-verified');
  
  if (savedCredits !== null) {
    state.credits = parseInt(savedCredits) || 0;
  } else {
    // 新用户初始积分
    state.credits = DEFAULT_CREDITS;
    localStorage.setItem('aigame-credits', state.credits.toString());
  }
  
  state.isFirstGeneration = isFirstGen !== 'false';
  state.userEmail = savedEmail || '';
  state.userEmailVerified = emailVerified === 'true';
  
  updateCreditsDisplay();
}

// 保存积分
function saveCredits() {
  localStorage.setItem('aigame-credits', state.credits.toString());
  updateCreditsDisplay();
}

// ==================== 账号系统 ====================

// 初始化账号
async function initAccount() {
  try {
    const userToken = getUserToken();
    const response = await fetch(`/api/account?token=${userToken}`);
    if (response.ok) {
      const data = await response.json();
      state.account = {
        accountId: data.account_id,
        nickname: data.nickname || '',
        hasPassword: data.has_password || false,
        loaded: true
      };
      // 同步昵称到设置中的作者名
      if (data.nickname && !state.settings.authorName) {
        state.settings.authorName = data.nickname;
      }
      log('账号信息加载成功: ' + data.account_id, 'info');
      
      // 立即更新所有账号ID显示的地方
      updateAccountIdDisplay();
    } else {
      // API请求失败时，使用本地生成的token作为账号ID
      state.account = {
        accountId: userToken.substring(0, 12),
        nickname: '',
        hasPassword: false,
        loaded: true
      };
      updateAccountIdDisplay();
    }
  } catch (error) {
    log('加载账号信息失败: ' + error.message, 'error');
    // 出错时也设置一个默认值
    const userToken = getUserToken();
    state.account = {
      accountId: userToken.substring(0, 12),
      nickname: '',
      hasPassword: false,
      loaded: true
    };
    updateAccountIdDisplay();
  }
}

// 更新所有账号ID显示
function updateAccountIdDisplay() {
  const accountId = state.account.accountId || '未知';
  const hasPassword = state.account.hasPassword;
  
  // 更新各处的账号ID显示
  const elements = [
    document.getElementById('profile-account-id'),
    document.getElementById('settings-account-id'),
    document.getElementById('save-account-id')
  ];
  
  elements.forEach(el => {
    if (el) el.textContent = accountId;
  });
  
  // 更新账号状态显示
  const statusElements = [
    document.getElementById('profile-account-status'),
    document.getElementById('settings-account-status')
  ];
  
  statusElements.forEach(el => {
    if (el) {
      if (hasPassword) {
        el.innerHTML = '<span class="status-tag protected">🔐 已保护</span>';
      } else {
        el.innerHTML = '<span class="status-tag guest">游客模式</span>';
      }
    }
  });
}

// 复制账号ID
function copyAccountId() {
  const accountId = state.account.accountId;
  if (accountId) {
    navigator.clipboard.writeText(accountId).then(() => {
      showToast('账号已复制到剪贴板');
    }).catch(() => {
      // 回退方案
      const input = document.createElement('input');
      input.value = accountId;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast('账号已复制到剪贴板');
    });
  }
}

// 更新昵称
async function updateNickname(nickname) {
  try {
    const userToken = getUserToken();
    const response = await fetch('/api/account/nickname', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: userToken, nickname })
    });
    if (response.ok) {
      state.account.nickname = nickname;
      state.settings.authorName = nickname;
      showToast('昵称更新成功');
      return true;
    } else {
      const data = await response.json();
      showToast(data.error || '昵称更新失败', 'error');
      return false;
    }
  } catch (error) {
    showToast('网络错误', 'error');
    return false;
  }
}

// 设置密码
async function setAccountPassword(password) {
  try {
    const userToken = getUserToken();
    const response = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: userToken, password })
    });
    if (response.ok) {
      state.account.hasPassword = true;
      showToast('密码设置成功');
      return true;
    } else {
      const data = await response.json();
      showToast(data.error || '密码设置失败', 'error');
      return false;
    }
  } catch (error) {
    showToast('网络错误', 'error');
    return false;
  }
}

// 账号登录
async function loginWithAccount(accountId, password) {
  try {
    const response = await fetch('/api/account/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: accountId, password })
    });
    if (response.ok) {
      const data = await response.json();
      // 更新本地 token
      localStorage.setItem('aigame-user-token', data.user_token);
      localStorage.setItem('aigame-author-token', data.user_token);
      // 更新状态
      state.account = {
        accountId: data.account_id,
        nickname: data.nickname || '',
        hasPassword: true,
        loaded: true
      };
      showToast('登录成功');
      // 重新加载数据
      initCredits();
      loadGames();
      return true;
    } else {
      const data = await response.json();
      showToast(data.error || '登录失败', 'error');
      return false;
    }
  } catch (error) {
    showToast('网络错误', 'error');
    return false;
  }
}

// 显示登录对话框
function showLoginDialog() {
  // 移除旧的对话框（如果有）
  const oldDialog = document.getElementById('login-dialog');
  if (oldDialog) oldDialog.remove();
  
  const dialog = document.createElement('div');
  dialog.className = 'modal active';
  dialog.id = 'login-dialog';
  dialog.onclick = (e) => { if (e.target === dialog) closeLoginDialog(); };
  dialog.innerHTML = `
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h3>🔐 账号登录</h3>
        <button class="btn btn-icon btn-close" onclick="closeLoginDialog()">×</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-muted); font-size: 0.8125rem; margin-bottom: 1rem; text-align: center;">
          如果你之前在其他设备上设置了密码，可以在这里登录恢复数据
        </p>
        <div class="form-group">
          <label>账号 ID</label>
          <input type="text" id="login-account-id" placeholder="例如: player_a3x9k2">
        </div>
        <div class="form-group">
          <label>密码</label>
          <input type="password" id="login-password" placeholder="请输入密码">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeLoginDialog()">取消</button>
        <button class="btn btn-primary" onclick="doLogin()">登录</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  document.body.classList.add('modal-open');
  
  // 聚焦账号输入框
  setTimeout(() => {
    document.getElementById('login-account-id')?.focus();
  }, 100);
}

// 关闭登录对话框
function closeLoginDialog() {
  const dialog = document.getElementById('login-dialog');
  if (dialog) {
    dialog.remove();
    // 检查是否还有其他弹窗
    const hasOpenModals = document.querySelector('.modal.active');
    if (!hasOpenModals) {
      document.body.classList.remove('modal-open');
    }
  }
}

// 执行登录
async function doLogin() {
  const accountId = document.getElementById('login-account-id').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!accountId) {
    showToast('请输入账号 ID', 'error');
    return;
  }
  if (!password) {
    showToast('请输入密码', 'error');
    return;
  }
  
  const success = await loginWithAccount(accountId, password);
  if (success) {
    closeLoginDialog();
  }
}

// 检查是否有足够积分或是否为免费操作
function checkCreditsForGeneration() {
  // 首次生成和编辑游戏都免费
  if (state.isFirstGeneration) {
    return { canGenerate: true, isFree: true, message: '首次生成免费！' };
  }
  
  if (state.currentGame && state.currentGame.isEditing) {
    return { canGenerate: true, isFree: true, message: '编辑游戏免费！' };
  }
  
  if (state.credits > 0) {
    return { canGenerate: true, isFree: false, message: `将消耗 1 积分，当前剩余 ${state.credits} 积分` };
  }
  
  return { canGenerate: false, isFree: false, message: '积分不足' };
}

// 打开无积分提示弹窗
function openNoCreditsModal() {
  showToast('积分不足，请获取更多积分', 'error');
  openCreditsModal();
}

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
  // 显示底部导航
  document.getElementById('bottom-nav').style.display = 'flex';
  // 只在当前不是首页时才更新URL
  if (window.location.pathname !== '/') {
    history.pushState(null, '', '/');
  }
}

// ==================== 主标签页切换 ====================

// 切换主标签页
function switchMainTab(tabName) {
  if (tabName === state.mainTab.current) return;
  
  state.mainTab.current = tabName;
  
  // 更新标签样式
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  // 切换面板
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabName}`);
  });
  
  // 如果该标签页还没有加载过数据，则加载
  if (!state.mainTab.loaded[tabName]) {
    loadTabData(tabName);
  }
}

// 加载标签页数据
async function loadTabData(tabName, append = false) {
  const list = document.getElementById(`list-${tabName}`);
  const loading = document.getElementById(`loading-${tabName}`);
  if (!list) return;
  
  // 如果正在加载或没有更多数据，则返回
  if (state.mainTab.isLoading[tabName]) return;
  if (append && !state.mainTab.hasMore[tabName]) return;
  
  state.mainTab.isLoading[tabName] = true;
  
  if (!append) {
    list.innerHTML = '<div class="list-loading"><div class="loading-spinner-small"></div><span>加载中...</span></div>';
    state.mainTab.offsets[tabName] = 0;
    state.mainTab.hasMore[tabName] = true;
  } else if (loading) {
    loading.style.display = 'flex';
  }
  
  try {
    const offset = state.mainTab.offsets[tabName];
    const limit = state.mainTab.pageSize;
    
    // 根据标签类型构建API请求
    let apiUrl;
    switch(tabName) {
      case 'recent':
        apiUrl = `/api/games?sort=newest&limit=${limit}&offset=${offset}`;
        break;
      case 'hot':
        apiUrl = `/api/leaderboard/hot?limit=${limit}&offset=${offset}`;
        break;
      case 'likes':
        apiUrl = `/api/leaderboard/likes?limit=${limit}&offset=${offset}`;
        break;
      case 'favorites':
        apiUrl = `/api/leaderboard/favorites?limit=${limit}&offset=${offset}`;
        break;
      case 'featured':
        apiUrl = `/api/games/featured?limit=${limit}&offset=${offset}`;
        break;
      default:
        apiUrl = `/api/games?sort=newest&limit=${limit}&offset=${offset}`;
    }
    
    const res = await fetch(apiUrl);
    const data = await res.json();
    
    if (data.success && data.games && data.games.length > 0) {
      renderGameList(list, data.games, tabName, append, offset);
      state.mainTab.offsets[tabName] += data.games.length;
      state.mainTab.loaded[tabName] = true;
      
      // 如果返回的数据少于请求的数量，说明没有更多了
      if (data.games.length < limit) {
        state.mainTab.hasMore[tabName] = false;
      }
    } else {
      if (!append) {
        list.innerHTML = '<div class="list-empty"><div class="list-empty-icon">📭</div><p>暂无数据</p></div>';
      }
      state.mainTab.hasMore[tabName] = false;
    }
  } catch (error) {
    console.error(`加载${tabName}列表失败:`, error);
    if (!append) {
      list.innerHTML = '<div class="list-empty"><div class="list-empty-icon">😢</div><p>加载失败</p></div>';
    }
  } finally {
    state.mainTab.isLoading[tabName] = false;
    if (loading) {
      loading.style.display = 'none';
    }
  }
}

// 渲染游戏列表（卡片式）
function renderGameList(container, games, tabName, append = false, startOffset = 0) {
  if (!append) {
    container.innerHTML = '';
  }
  
  games.forEach((game, index) => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.onclick = () => openGame(game.id);
    
    // 提取游戏标题中的 emoji 作为图标
    const titleEmoji = extractEmoji(game.title) || '🎮';
    
    card.innerHTML = `
      <div class="game-card-preview">${titleEmoji}</div>
      <div class="game-card-content">
        <div class="game-card-title">${escapeHtml(game.title)}</div>
        <div class="game-card-prompt">${escapeHtml(game.prompt || '')}</div>
        <div class="game-card-meta">
          <span class="game-card-author">👤 ${escapeHtml(game.author_name || '匿名')}</span>
          <div class="game-card-stats">
            <span>🎮 ${game.play_count || 0}</span>
            <span>❤️ ${game.like_count || 0}</span>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// 从文本中提取第一个emoji
function extractEmoji(text) {
  if (!text) return null;
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/u;
  const match = text.match(emojiRegex);
  return match ? match[0] : null;
}

// 初始化主标签页
function initMainTabs() {
  // 监听页面滚动加载更多
  window.addEventListener('scroll', () => {
    // 检查是否滚动到底部附近
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
      loadTabData(state.mainTab.current, true);
    }
  });
  
  // 加载第一个标签页（最新）
  loadTabData('recent');
}

// ==================== 底部导航切换 ====================

function switchBottomNav(navName) {
  // 先关闭所有弹窗
  closeAllModals();
  
  // 同时关闭生成遮罩（如果有）
  const overlay = document.getElementById('generating-overlay');
  if (overlay && overlay.classList.contains('active')) {
    // 不关闭生成遮罩，因为后台可能还在生成
    // 而是将其最小化
    minimizeGenerating();
  }
  
  // 更新导航样式
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.nav === navName);
  });
  
  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  // 显示对应页面
  if (navName === 'home') {
    document.getElementById('home-page').classList.add('active');
    history.pushState(null, '', '/');
  } else if (navName === 'create') {
    document.getElementById('create-page').classList.add('active');
    // 更新积分显示
    const creditsEl = document.getElementById('create-credits-count');
    if (creditsEl) creditsEl.textContent = state.credits || 0;
  } else if (navName === 'profile') {
    document.getElementById('profile-page').classList.add('active');
    loadProfilePageData();
  }
  
  // 显示底部导航
  document.getElementById('bottom-nav').style.display = 'flex';
}

// ==================== 创作页面 ====================

// 设置创作页面的prompt
function setCreatePrompt(text) {
  const input = document.getElementById('create-page-input');
  if (input) {
    input.value = text;
    input.focus();
  }
}

// 从创作页面生成游戏
function generateFromCreatePage() {
  const input = document.getElementById('create-page-input');
  const mainInput = document.getElementById('prompt-input');
  
  if (input && mainInput) {
    mainInput.value = input.value;
  }
  
  generateGame();
}

// ==================== 我的页面 ====================

// 切换我的页面标签
function switchProfilePageTab(tabName) {
  // 切换标签按钮状态
  document.querySelectorAll('.profile-page-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  // 切换内容区域
  document.querySelectorAll('.profile-page-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `profile-panel-${tabName}`);
  });
  
  // 加载对应数据
  switch(tabName) {
    case 'my-games':
      loadProfilePageGames();
      break;
    case 'my-likes':
      loadProfilePageLikes();
      break;
    case 'my-favs':
      loadProfilePageFavorites();
      break;
    case 'my-settings':
      loadProfilePageSettings();
      break;
  }
}

// 加载我的页面数据
async function loadProfilePageData() {
  // 设置用户名
  const username = state.settings.authorName || state.account.nickname || '游戏创作者';
  const usernameEl = document.getElementById('profile-page-username');
  if (usernameEl) usernameEl.textContent = username;
  
  // 加载积分
  const creditsEl = document.getElementById('profile-page-credits');
  if (creditsEl) creditsEl.textContent = state.credits || 0;
  
  // 加载游戏统计
  try {
    const response = await fetch('/api/my-games', {
      headers: { 'X-Author-Token': getAuthorToken() }
    });
    const data = await response.json();
    if (data.success) {
      const gamesEl = document.getElementById('profile-page-games');
      const likesEl = document.getElementById('profile-page-likes');
      if (gamesEl) gamesEl.textContent = data.stats?.count || 0;
      if (likesEl) likesEl.textContent = data.stats?.likes || 0;
    }
  } catch (e) {
    console.error('加载个人统计失败:', e);
  }
  
  // 默认加载我的作品
  loadProfilePageGames();
}

// 加载我的作品列表
async function loadProfilePageGames() {
  const container = document.getElementById('profile-games-list');
  if (!container) return;
  
  container.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const response = await fetch('/api/my-games', {
      headers: { 'X-Author-Token': getAuthorToken() }
    });
    const data = await response.json();
    
    if (data.success && data.games && data.games.length > 0) {
      container.innerHTML = data.games.map(game => `
        <div class="my-game-item" onclick="openGame('${game.id}')">
          <div class="my-game-info">
            <div class="my-game-title">${escapeHtml(game.title)}</div>
            <div class="my-game-meta">
              <span>▶️ ${game.play_count || 0}</span>
              <span>❤️ ${game.like_count || 0}</span>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div class="empty-games"><div class="empty-icon">🎮</div><p>还没有作品</p><p class="empty-hint">去创作你的第一个游戏吧！</p></div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="error-games">加载失败</div>';
  }
}

// 加载我的点赞
async function loadProfilePageLikes() {
  const container = document.getElementById('profile-likes-list');
  if (!container) return;
  
  container.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const likedIds = JSON.parse(localStorage.getItem('aigame-liked-games') || '[]');
    if (likedIds.length === 0) {
      container.innerHTML = '<div class="empty-games"><div class="empty-icon">❤️</div><p>还没有点赞的游戏</p></div>';
      return;
    }
    
    // 批量获取游戏信息
    const games = [];
    for (const id of likedIds.slice(0, 20)) {
      try {
        const res = await fetch(`/api/games/${id}`);
        const data = await res.json();
        if (data.success && data.game) {
          games.push(data.game);
        }
      } catch (e) {}
    }
    
    if (games.length > 0) {
      container.innerHTML = games.map(game => `
        <div class="my-game-item" onclick="openGame('${game.id}')">
          <div class="my-game-info">
            <div class="my-game-title">${escapeHtml(game.title)}</div>
            <div class="my-game-meta">
              <span>👤 ${escapeHtml(game.author_name || '匿名')}</span>
              <span>❤️ ${game.like_count || 0}</span>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div class="empty-games"><div class="empty-icon">❤️</div><p>还没有点赞的游戏</p></div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="error-games">加载失败</div>';
  }
}

// 加载我的收藏
async function loadProfilePageFavorites() {
  const container = document.getElementById('profile-favs-list');
  if (!container) return;
  
  container.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const favIds = JSON.parse(localStorage.getItem('aigame-favorites') || '[]');
    if (favIds.length === 0) {
      container.innerHTML = '<div class="empty-games"><div class="empty-icon">⭐</div><p>还没有收藏的游戏</p></div>';
      return;
    }
    
    const games = [];
    for (const id of favIds.slice(0, 20)) {
      try {
        const res = await fetch(`/api/games/${id}`);
        const data = await res.json();
        if (data.success && data.game) {
          games.push(data.game);
        }
      } catch (e) {}
    }
    
    if (games.length > 0) {
      container.innerHTML = games.map(game => `
        <div class="my-game-item" onclick="openGame('${game.id}')">
          <div class="my-game-info">
            <div class="my-game-title">${escapeHtml(game.title)}</div>
            <div class="my-game-meta">
              <span>👤 ${escapeHtml(game.author_name || '匿名')}</span>
              <span>❤️ ${game.like_count || 0}</span>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div class="empty-games"><div class="empty-icon">⭐</div><p>还没有收藏的游戏</p></div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="error-games">加载失败</div>';
  }
}

// 加载设置页面数据
function loadProfilePageSettings() {
  // 更新账号ID显示（使用统一函数）
  updateAccountIdDisplay();
  
  // 如果账号还没加载完成，稍后再试
  if (!state.account.loaded) {
    setTimeout(loadProfilePageSettings, 500);
    return;
  }
  
  // 个人信息
  const nicknameEl = document.getElementById('settings-nickname');
  if (nicknameEl) nicknameEl.value = state.settings.authorName || '';
  
  const emailEl = document.getElementById('settings-email');
  if (emailEl) emailEl.value = state.userEmail || '';
  
  // 模型设置
  const modelEl = document.getElementById('settings-model');
  if (modelEl) modelEl.value = state.settings.llmModelId || 'deepseek-v3';
  
  const apiKeyEl = document.getElementById('settings-api-key');
  if (apiKeyEl) apiKeyEl.value = state.settings.llmApiKey || '';
}

// 保存设置页面
async function savePageSettings() {
  const nickname = document.getElementById('settings-nickname')?.value?.trim() || '';
  const email = document.getElementById('settings-email')?.value?.trim() || '';
  const password = document.getElementById('settings-password')?.value?.trim() || '';
  const model = document.getElementById('settings-model')?.value || 'deepseek-v3';
  const apiKey = document.getElementById('settings-api-key')?.value || '';
  
  // 更新状态
  state.settings.authorName = nickname;
  state.settings.llmModelId = model;
  state.settings.llmProvider = model;
  state.settings.llmApiKey = apiKey;
  
  localStorage.setItem('aigame-settings', JSON.stringify(state.settings));
  
  // 更新昵称到服务器
  if (nickname && nickname !== state.account.nickname) {
    await updateNickname(nickname);
  }
  
  // 处理密码设置
  if (password && !state.account.hasPassword) {
    if (password.length < 6) {
      showToast('密码至少需要6位', 'error');
      return;
    }
    await setAccountPassword(password);
    document.getElementById('settings-password').value = '';
    loadProfilePageSettings();
  }
  
  // 处理邮箱绑定
  if (email && email !== state.userEmail && isValidEmail(email)) {
    if (!state.userEmailVerified) {
      state.credits += 3;
      saveCredits();
      showToast('🎉 邮箱绑定成功！获得3积分奖励', 'success');
      state.userEmailVerified = true;
      localStorage.setItem('aigame-email-verified', 'true');
    }
    state.userEmail = email;
    localStorage.setItem('aigame-email', email);
  }
  
  showToast('设置已保存', 'success');
  
  // 更新显示
  const usernameEl = document.getElementById('profile-page-username');
  if (usernameEl) usernameEl.textContent = nickname || '游戏创作者';
}

// 显示游戏页面
function showGamePage() {
  document.getElementById('home-page').classList.remove('active');
  document.getElementById('game-page').classList.add('active');
  // 隐藏底部导航
  document.getElementById('bottom-nav').style.display = 'none';
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
  // 初始化榜单滑动功能
  initLeaderboardSwiper();
  // 只加载第一个榜单（热门榜），其他榜单切换时按需加载
  loadLeaderboardData('hot');
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

// 加载排行榜数据（支持分页）
async function loadLeaderboardData(type, append = false) {
  const container = document.getElementById(`leaderboard-${type}`);
  const loadingMore = document.getElementById(`loading-more-${type}`);
  if (!container) return;
  
  // 如果正在加载或没有更多数据，则返回
  if (state.leaderboard.isLoading[type]) return;
  if (append && !state.leaderboard.hasMore[type]) return;
  
  state.leaderboard.isLoading[type] = true;
  
  if (!append) {
    container.innerHTML = '<div class="leaderboard-empty">加载中...</div>';
    state.leaderboard.offsets[type] = 0;
    state.leaderboard.hasMore[type] = true;
  } else if (loadingMore) {
    loadingMore.style.display = 'flex';
  }
  
  try {
    const offset = state.leaderboard.offsets[type];
    const limit = state.leaderboard.pageSize;
    const res = await fetch(`/api/leaderboard/${type}?limit=${limit}&offset=${offset}`);
    const data = await res.json();
    
    if (data.success && data.games && data.games.length > 0) {
      renderLeaderboard(container, data.games, type, append, offset);
      state.leaderboard.offsets[type] += data.games.length;
      
      // 如果返回的数据少于请求的数量，说明没有更多了
      if (data.games.length < limit) {
        state.leaderboard.hasMore[type] = false;
      }
    } else {
      if (!append) {
        container.innerHTML = '<div class="leaderboard-empty">暂无数据</div>';
      }
      state.leaderboard.hasMore[type] = false;
    }
  } catch (error) {
    console.error(`加载${type}排行榜失败:`, error);
    if (!append) {
      container.innerHTML = '<div class="leaderboard-empty">加载失败</div>';
    }
  } finally {
    state.leaderboard.isLoading[type] = false;
    if (loadingMore) {
      loadingMore.style.display = 'none';
    }
  }
}

// 渲染排行榜
function renderLeaderboard(container, games, type, append = false, startOffset = 0) {
  if (!append) {
    container.innerHTML = '';
  }
  
  games.forEach((game, index) => {
    const rank = startOffset + index + 1;
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

// 切换榜单
function switchLeaderboard(index) {
  if (index === state.leaderboard.currentIndex) return;
  
  state.leaderboard.currentIndex = index;
  const wrapper = document.getElementById('leaderboard-swiper-wrapper');
  if (wrapper) {
    wrapper.style.transform = `translateX(-${index * 100}%)`;
  }
  
  // 更新标签状态
  document.querySelectorAll('.leaderboard-tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
  });
  
  // 如果该榜单还没有加载过数据，则加载
  const type = state.leaderboard.types[index];
  const container = document.getElementById(`leaderboard-${type}`);
  if (container && container.children.length === 0) {
    loadLeaderboardData(type);
  }
}

// 初始化榜单滑动功能
function initLeaderboardSwiper() {
  const container = document.getElementById('leaderboard-swiper-container');
  const wrapper = document.getElementById('leaderboard-swiper-wrapper');
  if (!container || !wrapper) return;
  
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let currentTranslate = 0;
  
  // 触摸开始
  container.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
    wrapper.style.transition = 'none';
  }, { passive: true });
  
  // 触摸移动
  container.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    
    const diffX = e.touches[0].clientX - startX;
    const diffY = e.touches[0].clientY - startY;
    
    // 如果垂直滑动大于水平滑动，不处理（允许页面滚动）
    if (Math.abs(diffY) > Math.abs(diffX)) {
      return;
    }
    
    const containerWidth = container.offsetWidth;
    const baseTranslate = -state.leaderboard.currentIndex * containerWidth;
    currentTranslate = baseTranslate + diffX;
    
    // 限制边界
    const minTranslate = -(state.leaderboard.types.length - 1) * containerWidth;
    currentTranslate = Math.max(minTranslate, Math.min(0, currentTranslate));
    
    wrapper.style.transform = `translateX(${currentTranslate}px)`;
  }, { passive: true });
  
  // 触摸结束
  container.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    
    const endX = e.changedTouches[0].clientX;
    const diffX = endX - startX;
    const containerWidth = container.offsetWidth;
    const threshold = containerWidth * 0.2;
    
    wrapper.style.transition = 'transform 0.3s ease';
    
    if (diffX > threshold && state.leaderboard.currentIndex > 0) {
      // 向右滑，切换到上一个
      switchLeaderboard(state.leaderboard.currentIndex - 1);
    } else if (diffX < -threshold && state.leaderboard.currentIndex < state.leaderboard.types.length - 1) {
      // 向左滑，切换到下一个
      switchLeaderboard(state.leaderboard.currentIndex + 1);
    } else {
      // 恢复原位
      wrapper.style.transform = `translateX(-${state.leaderboard.currentIndex * 100}%)`;
    }
  }, { passive: true });
  
  // 为每个榜单列表添加滚动加载更多
  state.leaderboard.types.forEach(type => {
    const list = document.getElementById(`leaderboard-${type}`);
    if (list) {
      list.addEventListener('scroll', () => {
        // 检查是否滚动到底部
        if (list.scrollTop + list.clientHeight >= list.scrollHeight - 50) {
          loadLeaderboardData(type, true);
        }
      });
    }
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
  const timeAgo = formatTimeAgo(game.updated_at || game.created_at);
  const updateTimeDisplay = game.updated_at ? formatTimeAgo(game.updated_at) : formatTimeAgo(game.created_at);
  
  card.innerHTML = `
    <div class="game-card-preview">${icon}</div>
    <div class="game-card-content">
      <div class="game-card-title">${escapeHtml(game.title)}</div>
      <div class="game-card-prompt">${escapeHtml(game.prompt)}</div>
      <div class="game-card-meta">
        <span class="game-card-author">👤 ${escapeHtml(game.author_name || '匿名')}</span>
        <span class="game-card-time">🕐 ${updateTimeDisplay}</span>
      </div>
      <div class="game-card-stats-row">
        <span>❤️ ${game.like_count || 0}</span>
        <span>👁️ ${game.play_count || 0}</span>
      </div>
    </div>
  `;
  
  return card;
}

// 设置提示词
function setPrompt(prompt) {
  const mainInput = document.getElementById('prompt-input');
  const panelInput = document.getElementById('panel-prompt-input');
  
  // 同时更新两个输入框
  if (mainInput) mainInput.value = prompt;
  if (panelInput) panelInput.value = prompt;
  
  // 聚焦到可见的输入框
  const createPanel = document.getElementById('create-panel');
  if (createPanel && createPanel.classList.contains('show') && panelInput) {
    panelInput.focus();
  } else if (mainInput) {
    mainInput.focus();
  }
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
  
  setGenerateButtonLoading(false);
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
  
  // 检查积分（首次生成和编辑免费）
  const creditCheck = checkCreditsForGeneration();
  if (!creditCheck.canGenerate) {
    openNoCreditsModal();
    return;
  }
  
  // 显示积分消耗提示
  if (creditCheck.isFree) {
    showToast(`💎 ${creditCheck.message} | 当前积分: ${state.credits}`, 'success');
  } else {
    showToast(`💎 ${creditCheck.message}`, 'info');
  }
  
  // 不再强制要求API Key，使用服务器默认配置
  
  state.isGenerating = true;
  state.abortController = new AbortController();
  
  // 初始化后台任务状态
  backgroundTask.isActive = true;
  backgroundTask.isMinimized = false;
  backgroundTask.isCancelled = false;
  backgroundTask.prompt = prompt;
  backgroundTask.result = null;
  
  setGenerateButtonLoading(true);
  
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
      // 检查是否是 API Key 相关错误
      const errorMsg = data.error || '生成失败';
      const isApiKeyError = errorMsg.includes('401') || 
                           errorMsg.includes('authentication') || 
                           errorMsg.includes('invalid') ||
                           errorMsg.includes('API Key') ||
                           errorMsg.includes('Unauthorized');
      
      if (isApiKeyError && state.settings.llmApiKey) {
        // 用户配置了自己的 Key 但出错了，提示使用游客模式
        showApiKeyErrorModal(errorMsg);
        throw new Error('API Key 验证失败');
      }
      
      throw new Error(errorMsg);
    }
    
    log(`游戏生成成功: ${data.title}`, 'success');
    
    // 处理积分消耗
    if (!creditCheck.isFree) {
      state.credits--;
      saveCredits();
      log(`消耗1积分，剩余: ${state.credits}`, 'info');
    } else if (state.isFirstGeneration) {
      // 标记首次生成已使用
      state.isFirstGeneration = false;
      localStorage.setItem('aigame-first-generation', 'false');
      log('首次免费生成已使用', 'info');
    }
    
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
      
      // 隐藏生成遮罩和浮动提示
      document.getElementById('generating-overlay').classList.remove('active');
      document.getElementById('generating-float').classList.remove('active');
      
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
    setGenerateButtonLoading(false);
  }
}

// 打开保存弹窗
function openSaveModal() {
  const modal = document.getElementById('save-modal');
  modal.classList.add('active');
  
  document.getElementById('save-title').value = state.currentGame?.title || '';
  document.getElementById('save-author').value = state.settings.authorName || state.account.nickname || '';
  
  // 显示账号信息
  const accountIdEl = document.getElementById('save-account-id');
  const enablePasswordCheckbox = document.getElementById('enable-password');
  const passwordField = document.getElementById('save-password-field');
  
  if (accountIdEl && state.account.loaded) {
    accountIdEl.textContent = state.account.accountId;
  }
  
  // 如果已设置密码，隐藏密码设置区域
  if (enablePasswordCheckbox && passwordField) {
    if (state.account.hasPassword) {
      enablePasswordCheckbox.closest('.password-toggle')?.style.setProperty('display', 'none');
      passwordField.style.display = 'none';
    } else {
      enablePasswordCheckbox.closest('.password-toggle')?.style.removeProperty('display');
      enablePasswordCheckbox.checked = false;
      passwordField.style.display = 'none';
    }
  }
  
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

// 切换密码输入框显示
function togglePasswordField() {
  const checkbox = document.getElementById('enable-password');
  const passwordField = document.getElementById('save-password-field');
  if (checkbox && passwordField) {
    passwordField.style.display = checkbox.checked ? 'block' : 'none';
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
  
  // 检查密码设置
  const enablePasswordCheckbox = document.getElementById('enable-password');
  const passwordInput = document.getElementById('save-password');
  const shouldSetPassword = enablePasswordCheckbox?.checked && passwordInput?.value;
  
  try {
    // 如果用户设置了密码，先保存密码
    if (shouldSetPassword && !state.account.hasPassword) {
      await setAccountPassword(passwordInput.value);
    }
    
    // 如果昵称有变化，更新昵称
    if (authorName && authorName !== state.account.nickname) {
      await updateNickname(authorName);
    }
    
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

// 显示 API Key 错误提示弹窗
function showApiKeyErrorModal(errorMsg) {
  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'api-key-error-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 420px;">
      <div class="modal-header">
        <h2>🔑 API Key 验证失败</h2>
        <button class="btn-close" onclick="closeApiKeyErrorModal()">×</button>
      </div>
      <div class="modal-body" style="text-align: center; padding: 1.5rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">😅</div>
        <p style="color: #f87171; margin-bottom: 1rem; font-size: 0.9rem; word-break: break-all;">
          ${escapeHtml(errorMsg.substring(0, 200))}
        </p>
        <p style="color: #94a3b8; margin-bottom: 1.5rem;">
          您配置的 API Key 似乎无效或已过期，请检查后重试。
        </p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button class="btn-primary" onclick="useTrialModeInstead()" style="width: 100%; padding: 0.75rem;">
            🎁 清除 Key，使用游客模式
          </button>
          <button class="btn-secondary" onclick="openSettingsFromError()" style="width: 100%; padding: 0.75rem;">
            ⚙️ 去设置中修改 API Key
          </button>
          <button class="btn-ghost" onclick="closeApiKeyErrorModal()" style="width: 100%; padding: 0.5rem; color: #64748b;">
            取消
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// 关闭 API Key 错误弹窗
function closeApiKeyErrorModal() {
  const modal = document.getElementById('api-key-error-modal');
  if (modal) {
    modal.remove();
  }
}

// 清除用户 Key，使用游客模式
function useTrialModeInstead() {
  state.settings.llmApiKey = '';
  localStorage.setItem('settings', JSON.stringify(state.settings));
  closeApiKeyErrorModal();
  showToast('已切换到游客模式，请重新生成', 'success');
  loadTrialInfo(); // 刷新游客模式状态
}

// 从错误弹窗打开设置
function openSettingsFromError() {
  closeApiKeyErrorModal();
  openSettings();
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

// 打开积分页面（改为独立页面）
function openCreditsModal() {
  loadCredits().then(() => {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });
    
    // 显示积分页面
    const creditsPage = document.getElementById('credits-page');
    creditsPage.classList.add('active');
    
    // 隐藏底部导航
    document.getElementById('bottom-nav').style.display = 'none';
    
    // 重置子区域显示状态
    document.getElementById('invite-section-page').style.display = 'none';
    document.getElementById('wechat-verify-section-page').style.display = 'none';
    
    // 更新积分显示
    const creditsCount = document.getElementById('credits-count');
    if (creditsCount) creditsCount.textContent = state.credits || 0;
  });
}

// 关闭积分页面，返回上一页
function closeCreditsPage() {
  // 隐藏积分页面
  document.getElementById('credits-page').classList.remove('active');
  
  // 显示首页
  document.getElementById('home-page').classList.add('active');
  
  // 显示底部导航
  document.getElementById('bottom-nav').style.display = 'flex';
  
  // 更新导航状态
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.nav === 'home');
  });
}

// 兼容旧函数名
function closeCreditsModal() {
  closeCreditsPage();
}

// 显示公众号验证（页面版）
function showWechatVerifyPage() {
  const section = document.getElementById('wechat-verify-section-page');
  const isHidden = section.style.display === 'none';
  
  // 先隐藏邀请码区域
  document.getElementById('invite-section-page').style.display = 'none';
  
  section.style.display = isHidden ? 'block' : 'none';
  
  if (isHidden) {
    setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

// 切换邀请码区域（页面版）
function toggleInviteSectionPage() {
  const section = document.getElementById('invite-section-page');
  const isHidden = section.style.display === 'none';
  
  // 先隐藏公众号验证区域
  document.getElementById('wechat-verify-section-page').style.display = 'none';
  
  section.style.display = isHidden ? 'block' : 'none';
  
  if (isHidden) {
    // 加载邀请码
    loadMyInviteCodePage();
    setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

// 加载我的邀请码（页面版）
async function loadMyInviteCodePage() {
  try {
    const response = await fetch('/api/invite/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      }
    });
    const data = await response.json();
    
    if (data.success) {
      const codeEl = document.getElementById('my-invite-code-page');
      if (codeEl) codeEl.textContent = data.code;
    }
  } catch (error) {
    console.error('加载邀请码失败:', error);
  }
}

// 复制邀请码（页面版）
function copyInviteCodePage() {
  const code = document.getElementById('my-invite-code-page').textContent;
  if (code && code !== '加载中...') {
    navigator.clipboard.writeText(code).then(() => {
      showToast('邀请码已复制', 'success');
    }).catch(() => {
      showToast('复制失败，请手动复制', 'error');
    });
  }
}

// 提交邀请码（页面版）
async function submitInviteCodePage() {
  const input = document.getElementById('invite-code-input-page');
  const code = input.value.trim().toUpperCase();
  
  if (!code) {
    showToast('请输入邀请码', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/invite/use', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      },
      body: JSON.stringify({ code })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(data.message || '邀请码使用成功！+2次生成机会', 'success');
      input.value = '';
      // 刷新积分
      loadCredits();
      loadTrialInfo();
    } else {
      showToast(data.error || '邀请码无效', 'error');
    }
  } catch (error) {
    showToast('网络错误，请重试', 'error');
  }
}

// 验证公众号关注（页面版）
async function verifyWechatFollowPage() {
  const code = document.getElementById('wechat-verify-code-page').value.trim();
  
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
      showToast(data.message || '验证成功！+3次生成机会', 'success');
      state.credits = data.credits;
      updateCreditsDisplay();
      document.getElementById('wechat-verify-code-page').value = '';
      document.getElementById('wechat-verify-section-page').style.display = 'none';
      // 更新积分页面显示
      const creditsCount = document.getElementById('credits-count');
      if (creditsCount) creditsCount.textContent = state.credits;
      // 刷新 trial 信息
      loadTrialInfo();
    } else {
      showToast(data.error || '验证失败', 'error');
    }
  } catch (error) {
    showToast('验证失败，请重试', 'error');
  }
}

// 显示公众号验证（旧版兼容）
function showWechatVerify() {
  showWechatVerifyPage();
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

// 看广告获取积分 (暂时关闭)
async function watchAd() {
  // 功能暂时关闭
  showToast('此功能暂时关闭，请通过其他方式获取积分', 'info');
  return;
  
  // 这里应该接入真实的广告SDK
  // 目前简单模拟广告观看
  // showToast('正在加载广告...', 'info');
  
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
  const username = state.settings.authorName || state.account.nickname || '游戏创作者';
  document.getElementById('profile-username').textContent = username;
  
  // 显示账号信息
  const accountIdEl = document.getElementById('profile-account-id');
  const accountStatusEl = document.getElementById('profile-account-status');
  
  if (accountIdEl && state.account.loaded) {
    accountIdEl.textContent = state.account.accountId;
  }
  
  if (accountStatusEl && state.account.loaded) {
    if (state.account.hasPassword) {
      accountStatusEl.innerHTML = '<span class="status-badge status-protected">🔐 已保护</span>';
    } else {
      accountStatusEl.innerHTML = '<span class="status-badge status-guest">游客模式</span>';
    }
  }
  
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
  const emailInput = document.getElementById('profile-email');
  
  if (modelSelect) modelSelect.value = state.settings.llmModelId || 'deepseek-v3';
  if (apiKeyInput) apiKeyInput.value = state.settings.llmApiKey || '';
  if (authorNameInput) authorNameInput.value = state.settings.authorName || '';
  if (debugMode) debugMode.checked = state.settings.debugMode || false;
  if (baseUrlInput) baseUrlInput.value = state.settings.llmBaseUrl || '';
  if (customModelInput) customModelInput.value = state.settings.llmModel || '';
  if (emailInput) emailInput.value = state.userEmail || '';
  
  // 更新邮箱和密码状态标签
  const emailBonusTag = document.getElementById('email-bonus-tag');
  const passwordBonusTag = document.getElementById('password-bonus-tag');
  
  if (emailBonusTag && state.userEmailVerified) {
    emailBonusTag.textContent = '已绑定';
    emailBonusTag.classList.add('verified');
  }
  
  // 使用账号系统的密码状态
  if (passwordBonusTag && state.account.hasPassword) {
    passwordBonusTag.textContent = '已设置';
    passwordBonusTag.classList.add('verified');
  }
  
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
async function saveProfileSettings() {
  const modelSelect = document.getElementById('profile-model-select');
  const apiKeyInput = document.getElementById('profile-api-key');
  const authorNameInput = document.getElementById('profile-author-name');
  const debugMode = document.getElementById('profile-debug-mode');
  const baseUrlInput = document.getElementById('profile-base-url');
  const customModelInput = document.getElementById('profile-custom-model');
  const emailInput = document.getElementById('profile-email');
  const passwordInput = document.getElementById('profile-password');
  
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
  
  // 处理昵称更新（同步到服务器账号系统）
  const newNickname = authorNameInput?.value?.trim() || '';
  if (newNickname && newNickname !== state.account.nickname) {
    await updateNickname(newNickname);
  }
  
  // 处理邮箱绑定（获得积分奖励）
  const newEmail = emailInput?.value?.trim() || '';
  if (newEmail && newEmail !== state.userEmail && isValidEmail(newEmail)) {
    // 新邮箱绑定，奖励3积分
    if (!state.userEmailVerified) {
      state.credits += 3;
      saveCredits();
      showToast('🎉 邮箱绑定成功！获得3积分奖励', 'success');
      state.userEmailVerified = true;
      localStorage.setItem('aigame-email-verified', 'true');
      
      // 更新UI标签
      const bonusTag = document.getElementById('email-bonus-tag');
      if (bonusTag) {
        bonusTag.textContent = '已绑定';
        bonusTag.classList.add('verified');
      }
    }
    state.userEmail = newEmail;
    localStorage.setItem('aigame-email', newEmail);
  }
  
  // 处理密码设置（使用账号系统API）
  const newPassword = passwordInput?.value?.trim() || '';
  if (newPassword && !state.account.hasPassword) {
    if (newPassword.length < 6) {
      showToast('密码至少需要6位', 'error');
      return;
    }
    const success = await setAccountPassword(newPassword);
    if (success) {
      // 更新UI标签
      const passwordTag = document.getElementById('password-bonus-tag');
      if (passwordTag) {
        passwordTag.textContent = '已设置';
        passwordTag.classList.add('verified');
      }
      // 更新账号状态显示
      const accountStatusEl = document.getElementById('profile-account-status');
      if (accountStatusEl) {
        accountStatusEl.innerHTML = '<span class="status-badge status-protected">🔐 已保护</span>';
      }
      // 清空密码输入框
      if (passwordInput) passwordInput.value = '';
    }
  }
  
  // 更新用户名显示
  document.getElementById('profile-username').textContent = state.settings.authorName || state.account.nickname || '游戏创作者';
  
  showToast('设置已保存', 'success');
  
  // 更新积分显示
  updateCreditsDisplay();
}

// 验证邮箱格式
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// 切换密码可见性
function toggleProfilePasswordVisibility() {
  const input = document.getElementById('profile-password');
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
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

// ==================== 游客模式系统 ====================

// 加载游客模式信息
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
    console.error('加载游客模式信息失败:', error);
  }
}

// 更新游客模式横幅
function updateTrialBanner() {
  const banner = document.getElementById('trial-banner');
  const remaining = document.getElementById('trial-remaining');
  
  if (!banner || !state.trialInfo) return;
  
  // 只有没有API Key的用户才显示游客模式
  if (!state.settings.llmApiKey && state.trialInfo.enabled) {
    banner.style.display = 'inline-flex';
    remaining.textContent = state.trialInfo.userRemaining || 0;
  } else {
    banner.style.display = 'none';
  }
}

// 使用游客模式生成
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
      // 更新游客模式剩余次数
      if (state.trialInfo) {
        state.trialInfo.userRemaining = data.userRemaining;
        state.trialInfo.globalRemaining = data.globalRemaining;
        updateTrialBanner();
      }
      // 同步刷新积分显示
      loadTrialInfo();
      loadCredits();
      return data;
    } else {
      // 生成失败后也要刷新积分状态（因为积分可能已被扣除）
      loadTrialInfo();
      loadCredits();
      throw new Error(data.error || '游客模式生成失败');
    }
  } catch (error) {
    // 确保异常时也刷新积分状态
    loadTrialInfo();
    loadCredits();
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

// 重写生成游戏函数，支持游客模式
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
  
  // 如果没有API Key，尝试使用游客模式
  if (!state.settings.llmApiKey) {
    // 生成前先刷新积分状态，确保数据最新
    await loadTrialInfo();
    
    // 检查游客模式是否可用
    if (state.trialInfo && state.trialInfo.enabled && state.trialInfo.userRemaining > 0) {
      state.isGenerating = true;
      state.abortController = new AbortController();
      
      setGenerateButtonLoading(true);
      
      clearGeneratingLog();
      document.getElementById('generating-overlay').classList.add('active');
      startGeneratingTimer(); // 启动计时器
      
      log(`游客模式生成游戏: "${prompt}"`);
      updateGeneratingStatus('🎁 使用游客模式生成...');
      
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
          document.getElementById('generating-float').classList.remove('active'); // 关闭浮动提示
          stopGeneratingTimer(); // 停止计时器
          openSaveModal();
        } else {
          document.getElementById('generating-overlay').classList.remove('active');
          document.getElementById('generating-float').classList.remove('active');
          stopGeneratingTimer();
        }
      } catch (error) {
        log('游客模式生成失败: ' + error.message, 'error');
        document.getElementById('generating-overlay').classList.remove('active');
        document.getElementById('generating-float').classList.remove('active');
        stopGeneratingTimer();
      } finally {
        state.isGenerating = false;
        state.abortController = null;
        setGenerateButtonLoading(false);
      }
      return;
    }
    
    // 游客模式不可用，引导获取积分或配置API Key
    showToast('生成次数已用完，获取更多积分或配置自己的API Key', 'error');
    openCreditsModal();
    return;
  }
  
  // 有API Key，使用原版逻辑
  state.isGenerating = true;
  state.abortController = new AbortController();
  
  setGenerateButtonLoading(true);
  
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
      // 检查是否是 API Key 相关错误
      const errorMsg = data.error || '生成失败';
      const isApiKeyError = errorMsg.toLowerCase().includes('401') || 
                           errorMsg.toLowerCase().includes('authentication') || 
                           errorMsg.toLowerCase().includes('invalid') ||
                           errorMsg.toLowerCase().includes('api key') ||
                           errorMsg.toLowerCase().includes('unauthorized') ||
                           errorMsg.toLowerCase().includes('apikey');
      
      if (isApiKeyError && state.settings.llmApiKey) {
        // 用户配置了自己的 Key 但出错了，提示使用游客模式
        document.getElementById('generating-overlay').classList.remove('active');
        showApiKeyErrorModal(errorMsg);
        throw new Error('API Key 验证失败');
      }
      
      throw new Error(errorMsg);
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
    
    // 隐藏生成遮罩和浮动提示
    document.getElementById('generating-overlay').classList.remove('active');
    document.getElementById('generating-float').classList.remove('active');
    stopGeneratingTimer();
    
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
    document.getElementById('generating-float').classList.remove('active');
    stopGeneratingTimer();
  } finally {
    state.isGenerating = false;
    state.abortController = null;
    setGenerateButtonLoading(false);
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

// 关闭游戏页推广浮动
function closePromoBar() {
  const bar = document.getElementById('game-promo-float');
  if (bar) {
    bar.classList.add('hidden');
    // 记住用户关闭了推广，24小时内不再显示
    localStorage.setItem('aigame-promo-closed', Date.now().toString());
  }
}

// 延迟显示推广浮动
function showPromoBarDelayed() {
  const bar = document.getElementById('game-promo-float');
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
