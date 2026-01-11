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
  myInviteLink: null,  // 我的邀请链接
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

// 生成设备指纹（用于防白嫖）
function generateDeviceFingerprint() {
  try {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.platform,
      // Canvas 指纹
      (() => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillText('fingerprint', 2, 2);
          return canvas.toDataURL().slice(-50);
        } catch (e) {
          return 'no-canvas';
        }
      })(),
      // WebGL 渲染器信息
      (() => {
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl');
          if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
              return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
          }
          return 'no-webgl';
        } catch (e) {
          return 'no-webgl';
        }
      })()
    ];
    
    // 简单哈希
    const str = components.join('|||');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fp_' + Math.abs(hash).toString(36) + '_' + str.length.toString(36);
  } catch (e) {
    console.error('生成设备指纹失败:', e);
    return 'fp_unknown_' + Date.now().toString(36);
  }
}

// 获取设备指纹（缓存）
let cachedFingerprint = null;
function getDeviceFingerprint() {
  if (!cachedFingerprint) {
    cachedFingerprint = localStorage.getItem('aigame-device-fp');
    if (!cachedFingerprint) {
      cachedFingerprint = generateDeviceFingerprint();
      localStorage.setItem('aigame-device-fp', cachedFingerprint);
    }
  }
  return cachedFingerprint;
}

// 获取用户Token（可能为空，初始化时会从服务器获取）
function getUserToken() {
  let token = localStorage.getItem('aigame-author-token');
  if (!token) {
    token = localStorage.getItem('aigame-user-token');
  }
  return token;
}

// 保存用户Token
function saveUserToken(token) {
  localStorage.setItem('aigame-user-token', token);
  localStorage.setItem('aigame-author-token', token);
}

// 初始化账号（支持设备指纹自动恢复）
async function initAccount() {
  try {
    // 检查用户是否主动退出过，如果是则清除标记并创建新账号
    const loggedOut = localStorage.getItem('aigame-logged-out');
    if (loggedOut === 'true') {
      localStorage.removeItem('aigame-logged-out');
      // 不传设备指纹，创建全新账号
    }

    const currentToken = getUserToken();
    // 如果用户主动退出过，不使用设备指纹恢复
    const deviceFingerprint = loggedOut === 'true' ? null : getDeviceFingerprint();

    const response = await fetch('/api/account/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': currentToken || ''
      },
      body: JSON.stringify({ deviceFingerprint })
    });

    if (response.ok) {
      const data = await response.json();

      // 保存服务器返回的 token
      saveUserToken(data.userToken);

      // 更新状态
      state.account = {
        accountId: data.account.accountId,
        nickname: data.account.nickname || '',
        hasPassword: data.account.hasPassword,
        loaded: true
      };

      // 如果是恢复的账号，提示用户
      if (data.recovered) {
        console.log('🔄 账号已自动恢复:', data.account.accountId);
        showToast('欢迎回来！已自动恢复您的账号', 'success');
      }

      return data.userToken;
    } else {
      console.error('账号初始化失败');
      // 降级处理：生成本地 token
      const fallbackToken = generateUUID();
      saveUserToken(fallbackToken);
      return fallbackToken;
    }
  } catch (error) {
    console.error('账号初始化出错:', error);
    const fallbackToken = getUserToken() || generateUUID();
    saveUserToken(fallbackToken);
    return fallbackToken;
  }
}

// 获取或创建作者Token（现在返回与 getUserToken 相同的值）
function getAuthorToken() {
  return getUserToken();
}

// 恢复账号（换设备时使用，需要密码验证）
async function recoverAccount(accountId, password = null) {
  try {
    const deviceFingerprint = getDeviceFingerprint();
    
    // 使用安全恢复API
    const response = await fetch('/api/account/secure-recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, password, deviceFingerprint })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 保存恢复的 token
      saveUserToken(data.userToken);
      
      // 更新状态
      state.account = {
        accountId: data.account.accountId,
        nickname: data.account.nickname || '',
        hasPassword: data.account.hasPassword,
        loaded: true
      };

      // 如果有警告（如未设置密码），显示提示
      if (data.warning) {
        showToast(data.warning, 'info');
      } else {
        showToast('账号恢复成功！', 'success');
      }

      // 重新加载数据
      await initCredits();
      await loadGames();
      // 重新加载关注统计和我的页面数据
      loadUserFollowStats();
      loadProfilePageData();

      return true;
    } else {
      // 如果需要密码，提示用户输入密码
      if (data.needPassword) {
        showPasswordPrompt(accountId);
        return false;
      }
      showToast(data.error || '账号恢复失败', 'error');
      return false;
    }
  } catch (error) {
    showToast('网络错误', 'error');
    return false;
  }
}

// 显示密码输入提示
function showPasswordPrompt(accountId) {
  // 移除旧的对话框
  const oldDialog = document.getElementById('password-dialog');
  if (oldDialog) oldDialog.remove();
  
  const dialog = document.createElement('div');
  dialog.className = 'modal active';
  dialog.id = 'password-dialog';
  dialog.onclick = (e) => { if (e.target === dialog) dialog.remove(); };
  dialog.innerHTML = `
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h3>🔐 需要密码验证</h3>
        <button class="btn btn-icon btn-close" onclick="document.getElementById('password-dialog').remove()">×</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-muted); font-size: 0.8125rem; margin-bottom: 1rem; text-align: center;">
          该账号已设置密码保护，请输入密码
        </p>
        <div class="form-group">
          <label>密码</label>
          <input type="password" id="recover-password" placeholder="输入账号密码">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('password-dialog').remove()">取消</button>
        <button class="btn btn-primary" onclick="doPasswordRecover('${accountId}')">确认</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  document.body.classList.add('modal-open');
  
  setTimeout(() => {
    document.getElementById('recover-password')?.focus();
  }, 100);
}

// 使用密码恢复账号
async function doPasswordRecover(accountId) {
  const password = document.getElementById('recover-password').value;
  
  if (!password) {
    showToast('请输入密码', 'error');
    return;
  }
  
  const success = await recoverAccount(accountId, password);
  if (success) {
    const dialog = document.getElementById('password-dialog');
    if (dialog) dialog.remove();
    closeLoginDialog();
    updateProfileUI();
    document.body.classList.remove('modal-open');
  }
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

// 保存生成状态到localStorage，并在服务器端创建草稿
// 返回 draftId 供 generate API 使用
async function saveGeneratingState() {
  if (state.isGenerating && backgroundTask.isActive && backgroundTask.prompt) {
    // 检查是否已存在草稿ID（避免重复创建）
    const existingState = localStorage.getItem('aigame-generating-state');
    let existingDraftId = null;
    if (existingState) {
      try {
        const parsed = JSON.parse(existingState);
        if (parsed.draftId && parsed.prompt === backgroundTask.prompt) {
          existingDraftId = parsed.draftId;
        }
      } catch (e) {}
    }
    
    const generatingState = {
      isGenerating: true,
      prompt: backgroundTask.prompt,
      startTime: generatingStartTime || Date.now(),
      timestamp: Date.now(),
      draftId: existingDraftId
    };
    
    // 只有没有草稿ID时才在服务器端创建草稿记录
    if (!existingDraftId) {
      try {
        const authorToken = getAuthorToken();
        const authorName = state.settings.authorName || state.account.nickname || '匿名';
        
        const response = await fetch('/api/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: backgroundTask.prompt.slice(0, 50),
            prompt: backgroundTask.prompt,
            authorName,
            authorToken,
            status: 'draft'
          })
        });
        
        const data = await response.json();
        if (data.success && data.id) {
          generatingState.draftId = data.id;
          // 保存草稿ID的作者令牌映射
          saveGameAuthorToken(data.id, authorToken);
          log('草稿已保存到服务器: ' + data.id, 'info');
        }
      } catch (e) {
        console.error('创建草稿失败:', e);
      }
    }
    
    localStorage.setItem('aigame-generating-state', JSON.stringify(generatingState));
    log('保存生成状态到本地存储', 'info');
    
    // 返回草稿ID供后续使用
    return generatingState.draftId;
  }
  return null;
}

// 清除生成状态
function clearGeneratingState() {
  localStorage.removeItem('aigame-generating-state');
}

// 检查并恢复生成状态（不再弹出确认框，草稿已保存在服务器端"我的作品"中）
function checkAndRestoreGeneratingState() {
  const savedState = localStorage.getItem('aigame-generating-state');
  if (!savedState) return;
  
  try {
    const generatingState = JSON.parse(savedState);
    
    // 清除本地保存的生成状态
    clearGeneratingState();
    
    // 草稿已保存到服务器端，用户可以在"我的作品"中查看制作中的游戏
    // 不再弹出确认框打扰用户
    if (generatingState.draftId) {
      log('检测到未完成的草稿游戏，可在"我的作品"中查看', 'info');
    }
  } catch (e) {
    console.error('恢复生成状态失败:', e);
    clearGeneratingState();
  }
}

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
    // 阻止弹窗背景区域的触摸滚动穿透
    modal.addEventListener('touchmove', handleModalTouchMove, { passive: false });
  }
}

// 处理弹窗触摸移动事件（阻止背景滚动穿透）
function handleModalTouchMove(e) {
  // 如果触摸的是弹窗背景（而不是弹窗内容），则阻止默认行为
  if (e.target.classList.contains('modal')) {
    e.preventDefault();
  }
}

// 通用弹窗控制 - 关闭弹窗并恢复背景滚动
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    modal.removeEventListener('click', handleModalBackgroundClick);
    modal.removeEventListener('touchmove', handleModalTouchMove);
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
    e.target.removeEventListener('touchmove', handleModalTouchMove);
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
    modal.removeEventListener('touchmove', handleModalTouchMove);
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
document.addEventListener('DOMContentLoaded', async () => {
  log('页面加载完成，初始化应用...', 'info');
  loadSettings();
  
  // 初始化账号（等待完成，支持设备指纹自动恢复）
  await initAccount();
  
  // 账号初始化后更新UI显示
  updateAccountIdDisplay();
  log('账号信息加载成功: ' + state.account.accountId, 'info');
  
  // 账号初始化后再加载积分
  initCredits();
  
  // 处理邀请链接和分享链接参数
  await handleReferralParams();
  
  // 每日登录积分检查
  await checkDailyLoginCredit();
  
  // 加载模型预计生成时间配置
  await loadModelEstimatedTimes();
  
  // 加载Tips配置
  await loadTipsConfig();
  
  initMainTabs();  // 初始化主标签页
  handleRouting();
  initBetaBanner();
  
  // 检查是否有未完成的生成任务
  checkAndRestoreGeneratingState();
  
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
  
  // 监听页面可见性变化（手机切换后台再回来时恢复生成状态）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      log('页面重新可见，检查生成状态...', 'info');
      
      // 如果有正在进行的生成任务，确保UI状态正确
      if (state.isGenerating && backgroundTask.isActive) {
        log('恢复生成中状态显示', 'info');
        
        // 确保遮罩或浮动条显示正确
        const overlay = document.getElementById('generating-overlay');
        const floatBar = document.getElementById('generating-float');
        
        if (backgroundTask.isMinimized) {
          // 最小化状态：显示浮动条
          if (overlay) overlay.classList.remove('active');
          if (floatBar) floatBar.classList.add('active');
        } else {
          // 正常状态：显示遮罩
          if (overlay) overlay.classList.add('active');
          if (floatBar) floatBar.classList.remove('active');
        }
      }
    }
  });
});

// ==================== 内测横幅 ====================

// 初始化内测横幅
function initBetaBanner() {
  const betaBanner = document.getElementById('beta-banner');
  const dismissed = localStorage.getItem('aigame-beta-banner-dismissed');
  if (betaBanner && !dismissed) {
    betaBanner.style.display = 'flex';
    
    // 使用JS绑定事件，更可靠
    betaBanner.addEventListener('click', function(e) {
      // 检查是否点击的是关闭按钮
      if (e.target.classList.contains('beta-close') || e.target.closest('.beta-close')) {
        e.stopPropagation();
        e.preventDefault();
        closeBetaBanner();
        return;
      }
      // 点击其他区域，显示公众号
      showBrandPromo();
    });
    
    // 触摸事件（移动端）
    betaBanner.addEventListener('touchend', function(e) {
      if (e.target.classList.contains('beta-close') || e.target.closest('.beta-close')) {
        e.stopPropagation();
        e.preventDefault();
        closeBetaBanner();
        return;
      }
      e.preventDefault(); // 防止触发click
      showBrandPromo();
    }, { passive: false });
  }
}

// 关闭内测横幅
function closeBetaBanner(event) {
  // 阻止事件冒泡和默认行为
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const betaBanner = document.getElementById('beta-banner');
  if (betaBanner) {
    betaBanner.style.display = 'none';
    localStorage.setItem('aigame-beta-banner-dismissed', 'true');
  }
}

// 点击内测横幅（显示公众号）
function showBetaFeedback(event) {
  // 如果点击的是关闭按钮，不处理（通过检测target和其父元素）
  if (event) {
    const target = event.target;
    if (target.classList.contains('beta-close') || target.closest('.beta-close')) {
      return;
    }
  }
  showBrandPromo();
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

// 注意: initAccount 函数已移动到文件开头 (约281行)

// 更新所有账号ID显示
function updateAccountIdDisplay() {
  const accountId = state.account.accountId || '加载中...';
  
  // 更新各处的账号ID显示
  const elements = [
    document.getElementById('profile-account-id'),
    document.getElementById('settings-account-id'),
    document.getElementById('save-account-id')
  ];
  
  elements.forEach(el => {
    if (el) el.textContent = accountId;
  });
  
  // 更新账号状态显示（统一显示为已绑定设备）
  const statusElements = [
    document.getElementById('profile-account-status'),
    document.getElementById('settings-account-status')
  ];
  
  statusElements.forEach(el => {
    if (el) {
      if (state.account.loaded && state.account.accountId) {
        el.innerHTML = '<span class="status-tag protected">🔐 已绑定设备</span>';
      } else {
        el.innerHTML = '<span class="status-tag guest">加载中...</span>';
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
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Token': userToken
      },
      body: JSON.stringify({ nickname })
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
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Token': userToken
      },
      body: JSON.stringify({ password })
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
      body: JSON.stringify({ accountId, password })
    });
    if (response.ok) {
      const data = await response.json();
      // 更新本地 token（兼容两种字段名格式）
      const userToken = data.userToken || data.user_token;
      localStorage.setItem('aigame-user-token', userToken);
      localStorage.setItem('aigame-author-token', userToken);
      // 更新状态（兼容嵌套和扁平两种格式）
      const account = data.account || data;
      const nickname = account.nickname || '';
      state.account = {
        accountId: account.accountId || account.account_id || accountId,
        nickname: nickname,
        hasPassword: true,
        loaded: true
      };
      // 同步更新 settings 中的昵称
      state.settings.authorName = nickname;
      localStorage.setItem('aigame-author-name', nickname);
      // 更新账号ID显示
      updateAccountIdDisplay();
      // 更新我的页面昵称显示
      const usernameEl = document.getElementById('profile-page-username');
      if (usernameEl) usernameEl.textContent = nickname || '游戏创作者';

      showToast('登录成功');
      // 重新加载数据
      initCredits();
      loadGames();
      // 重新加载关注统计
      loadUserFollowStats();
      // 重新加载我的页面数据
      loadProfilePageData();
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

// 显示恢复账号对话框
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
        <h3>📲 恢复账号</h3>
        <button class="btn btn-icon btn-close" onclick="closeLoginDialog()">×</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-muted); font-size: 0.8125rem; margin-bottom: 1rem; text-align: center;">
          换设备了？输入之前的账号ID或昵称即可恢复数据
        </p>
        <div class="form-group">
          <label>账号ID 或 昵称</label>
          <input type="text" id="login-account-id" placeholder="例如: player_a3x9k2 或 MarsZhou">
        </div>
        <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.5rem;">
          💡 提示：账号ID可在「我的」页面查看并复制
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeLoginDialog()">取消</button>
        <button class="btn btn-primary" onclick="doRecover()">恢复</button>
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

// 退出当前账号
function logoutAccount() {
  // 移除旧确认框
  const oldConfirm = document.getElementById('logout-confirm');
  if (oldConfirm) oldConfirm.remove();
  
  const confirmDialog = document.createElement('div');
  confirmDialog.className = 'modal active';
  confirmDialog.id = 'logout-confirm';
  confirmDialog.onclick = (e) => { if (e.target === confirmDialog) confirmDialog.remove(); };
  confirmDialog.innerHTML = `
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h3>🚪 退出登录</h3>
        <button class="btn btn-icon btn-close" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <p style="text-align: center; margin-bottom: 1rem;">确定要退出当前账号吗？</p>
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem;">
          <p style="color: #ef4444; font-size: 0.8125rem; text-align: center; margin: 0;">
            ⚠️ 请确保已记住账号ID：<strong>${state.account.accountId || '未知'}</strong>
          </p>
        </div>
        <p style="color: var(--text-muted); font-size: 0.75rem; text-align: center;">
          退出后需要重新输入账号ID才能恢复数据
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
        <button class="btn btn-danger" onclick="confirmLogout()">确定退出</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmDialog);
  document.body.classList.add('modal-open');
}

// 确认退出
function confirmLogout() {
  // 清除本地存储的账号信息
  localStorage.removeItem('aigame-user-token');
  localStorage.removeItem('aigame-author-token');
  localStorage.removeItem('aigame-account-id');
  localStorage.removeItem('aigame-author-name');
  // 清除设备指纹，防止自动恢复
  localStorage.removeItem('aigame-device-fingerprint');
  // 标记用户主动退出
  localStorage.setItem('aigame-logged-out', 'true');

  // 关闭确认框
  const confirmDialog = document.getElementById('logout-confirm');
  if (confirmDialog) confirmDialog.remove();

  // 关闭个人资料弹窗
  closeProfileModal();

  showToast('已退出登录', 'success');

  // 刷新页面重新初始化
  setTimeout(() => {
    window.location.reload();
  }, 500);
}

// 执行恢复账号
async function doRecover() {
  const accountId = document.getElementById('login-account-id').value.trim();
  
  if (!accountId) {
    showToast('请输入账号ID或昵称', 'error');
    return;
  }
  
  const success = await recoverAccount(accountId);
  if (success) {
    closeLoginDialog();
    // 刷新页面显示
    updateProfileUI();
  }
}

// 兼容旧的 doLogin 函数
async function doLogin() {
  return doRecover();
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
  // 如果在全屏模式，先退出
  if (isGameFullscreen) {
    exitFullscreenMode();
  }
  
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

  // 初始化下拉刷新
  initPullToRefresh('home-page', 'pull-refresh-indicator', async () => {
    // 重置当前标签页的offset
    state.mainTab.offsets[state.mainTab.current] = 0;
    state.mainTab.hasMore[state.mainTab.current] = true;
    // 清空列表并重新加载
    const listEl = document.getElementById(`list-${state.mainTab.current}`);
    if (listEl) listEl.innerHTML = '';
    await loadTabData(state.mainTab.current);
  });

  // 加载第一个标签页（最新）
  loadTabData('recent');
}

// 下拉刷新功能（支持触摸和鼠标）
function initPullToRefresh(pageId, indicatorId, refreshCallback) {
  const page = document.getElementById(pageId);
  const indicator = document.getElementById(indicatorId);
  if (!page || !indicator) return;

  let startY = 0;
  let currentY = 0;
  let isPulling = false;
  let isRefreshing = false;
  const threshold = 60; // 触发刷新的阈值

  // 获取页面实际滚动位置
  function getScrollTop() {
    // 检查页面本身是否可滚动
    if (page.scrollTop > 0) return page.scrollTop;
    // 检查main-content
    const mainContent = page.querySelector('.main-content');
    if (mainContent && mainContent.scrollTop > 0) return mainContent.scrollTop;
    // 检查window滚动
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  // 开始拖动
  function handleStart(clientY) {
    if (getScrollTop() > 0 || isRefreshing) return;
    startY = clientY;
    currentY = clientY;
    isPulling = true;
  }

  // 拖动中
  function handleMove(clientY, preventDefault) {
    if (!isPulling || isRefreshing) return;
    if (getScrollTop() > 0) {
      isPulling = false;
      return;
    }

    currentY = clientY;
    const pullDistance = currentY - startY;

    if (pullDistance > 0) {
      // 阻止默认滚动
      if (preventDefault) preventDefault();
      // 计算实际移动距离（带阻尼效果）
      const moveDistance = Math.min(pullDistance * 0.5, 100);
      indicator.style.transform = `translateY(${moveDistance}px)`;
      indicator.classList.add('pulling');

      if (pullDistance > threshold) {
        indicator.classList.add('ready');
        indicator.querySelector('.pull-refresh-text').textContent = '释放刷新';
      } else {
        indicator.classList.remove('ready');
        indicator.querySelector('.pull-refresh-text').textContent = '下拉刷新';
      }
    }
  }

  // 结束拖动
  async function handleEnd() {
    if (!isPulling || isRefreshing) return;
    isPulling = false;

    const pullDistance = currentY - startY;

    if (pullDistance > threshold) {
      // 触发刷新
      isRefreshing = true;
      indicator.classList.remove('ready');
      indicator.classList.add('refreshing');
      indicator.querySelector('.pull-refresh-text').textContent = '刷新中...';
      indicator.style.transform = 'translateY(50px)';

      try {
        await refreshCallback();
        showToast('刷新成功', 'success');
      } catch (e) {
        showToast('刷新失败', 'error');
      }

      // 重置状态
      setTimeout(() => {
        indicator.style.transform = 'translateY(0)';
        indicator.classList.remove('pulling', 'refreshing');
        isRefreshing = false;
      }, 300);
    } else {
      // 未达到阈值，恢复原位
      indicator.style.transform = 'translateY(0)';
      indicator.classList.remove('pulling', 'ready');
    }
  }

  // ===== 触摸事件（移动端） =====
  page.addEventListener('touchstart', (e) => {
    handleStart(e.touches[0].clientY);
  }, { passive: true });

  page.addEventListener('touchmove', (e) => {
    handleMove(e.touches[0].clientY, () => e.preventDefault());
  }, { passive: false });

  page.addEventListener('touchend', handleEnd, { passive: true });

  // ===== 鼠标事件（PC端） =====
  page.addEventListener('mousedown', (e) => {
    // 只响应左键
    if (e.button !== 0) return;
    handleStart(e.clientY);
  });

  page.addEventListener('mousemove', (e) => {
    if (!isPulling) return;
    handleMove(e.clientY, () => e.preventDefault());
  });

  page.addEventListener('mouseup', handleEnd);
  
  // 鼠标离开页面时也要结束
  page.addEventListener('mouseleave', () => {
    if (isPulling && !isRefreshing) {
      isPulling = false;
      indicator.style.transform = 'translateY(0)';
      indicator.classList.remove('pulling', 'ready');
    }
    startY = 0;
    currentY = 0;
  });
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
  const settingsBtn = document.getElementById('profile-settings-btn');
  
  if (navName === 'home') {
    document.getElementById('home-page').classList.add('active');
    history.pushState(null, '', '/');
    if (settingsBtn) settingsBtn.classList.remove('visible');
  } else if (navName === 'create') {
    document.getElementById('create-page').classList.add('active');
    // 更新积分显示
    const creditsEl = document.getElementById('create-credits-count');
    if (creditsEl) creditsEl.textContent = state.credits || 0;
    // 更新当前模型显示
    updateCreateModelDisplay();
    // 初始化Tips滚动
    initCreateTips();
    if (settingsBtn) settingsBtn.classList.remove('visible');
  } else if (navName === 'profile') {
    document.getElementById('profile-page').classList.add('active');
    loadProfilePageData();
    // 初始化我的页面下拉刷新（只初始化一次）
    if (!state.profilePullRefreshInited) {
      initPullToRefresh('profile-page', 'profile-pull-refresh-indicator', async () => {
        await loadProfilePageData();
      });
      state.profilePullRefreshInited = true;
    }
    // 显示设置按钮
    if (settingsBtn) settingsBtn.classList.add('visible');
  }
  
  // 显示底部导航
  document.getElementById('bottom-nav').style.display = 'flex';
}

// ==================== 创作页面 ====================

// 默认Tips列表
const DEFAULT_CREATE_TIPS = [
  "💡 描述越具体，游戏越精确！例如：「贪吃蛇，有围墙，吃到食物加10分」",
  "🎮 可以指定操作方式：「用方向键控制」或「点击屏幕跳跃」",
  "🎨 可以描述画面风格：「像素风格」「简约黑白」「霓虹灯效果」",
  "⚡ 想让游戏更刺激？试试：「速度逐渐加快」「有Boss战」",
  "🏆 加入成就系统：「得分超过100分显示胜利画面」",
  "🎵 可以要求音效：「碰撞时播放音效」「背景音乐」",
  "📱 默认支持手机触屏操作，也可以明确指定控制方式",
  "🔄 对生成结果不满意？点击重新生成或修改描述再试",
  "✨ 试试混搭：「俄罗斯方块 + 消消乐玩法」",
  "🌈 描述颜色主题：「蓝色系冷色调」「温暖的橙红配色」"
];

let CREATE_TIPS = [...DEFAULT_CREATE_TIPS];
let currentTipIndex = 0;
let tipInterval = null;

// 加载后台配置的Tips
async function loadTipsConfig() {
  try {
    const response = await fetch('/api/config/tips');
    const data = await response.json();
    
    if (data.success) {
      // 如果后台配置了tips，则使用后台配置
      if (data.generateTips && data.generateTips.length > 0) {
        CREATE_TIPS = data.generateTips;
      }
      // TODO: 首页tips可以在这里处理
    }
  } catch (error) {
    console.log('使用默认Tips配置');
  }
}

// 初始化创作Tips滚动
function initCreateTips() {
  const tipsContainer = document.getElementById('create-tips-text');
  if (!tipsContainer) return;
  
  // 显示第一条
  tipsContainer.textContent = CREATE_TIPS[0];
  
  // 清除旧定时器
  if (tipInterval) clearInterval(tipInterval);
  
  // 每5秒切换一条
  tipInterval = setInterval(() => {
    currentTipIndex = (currentTipIndex + 1) % CREATE_TIPS.length;
    tipsContainer.style.opacity = '0';
    setTimeout(() => {
      tipsContainer.textContent = CREATE_TIPS[currentTipIndex];
      tipsContainer.style.opacity = '1';
    }, 300);
  }, 5000);
}

// 获取模型显示名称
function getModelDisplayName(modelId) {
  const modelNames = {
    'deepseek-v3': 'DeepSeek V3',
    'deepseek-r1': 'DeepSeek R1',
    'deepseek-chat': 'DeepSeek Chat',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-5': 'GPT-5',
    'gpt-5.1': 'GPT-5.1',
    'gpt-5.1-codex': 'GPT-5.1 Codex',
    'claude-3.7-sonnet': 'Claude 3.7 Sonnet',
    'claude-4-sonnet': 'Claude 4 Sonnet',
    'claude-4.5-haiku': 'Claude 4.5 Haiku',
    'claude-4.5-sonnet': 'Claude 4.5 Sonnet',
    'claude-4.5-opus': 'Claude 4.5 Opus',
    'claude-3-5-sonnet': 'Claude 3.5',
    'qwen-max': '通义千问 Max',
    'qwen-plus': '通义千问 Plus',
    'glm-4-plus': 'GLM-4 Plus',
    'glm-4': 'GLM-4'
  };
  return modelNames[modelId] || modelId || '未知模型';
}

// 更新创作页面的模型显示
function updateCreateModelDisplay() {
  const modelDisplay = document.getElementById('create-model-display');
  if (!modelDisplay) return;
  
  const modelId = state.settings.llmModelId || 'deepseek-v3';
  modelDisplay.textContent = getModelDisplayName(modelId);
}

// 打开模型选择器
function openModelSelector() {
  // 检查是否设置了API Key
  if (!state.settings.llmApiKey) {
    // 没有API Key，提示去设置
    showToast('请先在个人中心设置API Key', 'info');
    // 延迟一下再跳转，让用户看到提示
    setTimeout(() => {
      switchBottomNav('profile');
      // 再延迟一下打开设置弹窗
      setTimeout(() => {
        openProfileSettings();
      }, 300);
    }, 500);
    return;
  }
  
  // 有API Key，打开设置弹窗并定位到模型选择
  openSettings();
  // 聚焦到模型选择器
  setTimeout(() => {
    const modelSelect = document.getElementById('llm-model-select');
    if (modelSelect) {
      modelSelect.focus();
      // 高亮显示模型选择区域
      const settingsSection = modelSelect.closest('.settings-section');
      if (settingsSection) {
        settingsSection.style.background = 'rgba(99, 102, 241, 0.1)';
        settingsSection.style.borderRadius = '8px';
        settingsSection.style.transition = 'background 0.3s ease';
        setTimeout(() => {
          settingsSection.style.background = '';
        }, 2000);
      }
    }
  }, 200);
}

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
  // 优先从服务器获取最新账号信息
  try {
    const accountResponse = await fetch('/api/account', {
      headers: { 'X-User-Token': getUserToken() }
    });
    const accountData = await accountResponse.json();
    if (accountData.success && accountData.account) {
      // 更新本地状态
      state.account.accountId = accountData.account.accountId || accountData.account.account_id;
      state.account.nickname = accountData.account.nickname || '';
      state.account.hasPassword = accountData.account.hasPassword || accountData.account.has_password;
    }
  } catch (e) {
    console.error('获取账号信息失败:', e);
  }

  // 设置用户名 - 优先使用服务器返回的昵称，如果没有则使用账号ID
  const nickname = state.account.nickname;
  const accountId = state.account.accountId;
  // 如果昵称为空或是默认值，则显示账号ID
  const displayName = (nickname && nickname !== '游戏玩家' && nickname !== '') ? nickname : (accountId || '游戏创作者');
  const usernameEl = document.getElementById('profile-page-username');
  if (usernameEl) usernameEl.textContent = displayName;

  // 设置账号ID显示
  const accountIdEl = document.getElementById('profile-page-account-id');
  if (accountIdEl && accountId) {
    accountIdEl.textContent = `ID: ${accountId}`;
  }

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

  // 竖向布局：同时加载所有类别
  loadProfilePageGames();
  loadProfilePageLikes();
  loadProfilePageFavorites();
}

// 显示更多游戏（打开全部列表）
function showMoreGames(category) {
  // 根据类别切换到对应的完整列表视图
  // 可以打开一个模态框或者新页面
  let title = '';
  let loadFunc = null;
  
  switch(category) {
    case 'my-games':
      title = '我的作品';
      openFullGameList(title, '/api/my-games', { 'X-Author-Token': getAuthorToken() });
      break;
    case 'my-likes':
      title = '我点赞的';
      openFullGameList(title, '/api/my-likes', { 'X-User-Token': getUserToken() });
      break;
    case 'my-favs':
      title = '我的收藏';
      openFullGameList(title, '/api/my-favorites', { 'X-User-Token': getUserToken() });
      break;
  }
}

// 打开完整游戏列表的弹窗
async function openFullGameList(title, apiUrl, headers) {
  // 创建模态框 - 使用正确的 modal class
  let modal = document.getElementById('full-game-list-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'full-game-list-modal';
    modal.className = 'modal'; // 使用正确的class
    modal.innerHTML = `
      <div class="modal-content full-game-list-content">
        <div class="modal-header">
          <h3 class="modal-title" id="full-list-title"></h3>
          <button class="modal-close" onclick="closeFullGameList()">×</button>
        </div>
        <div class="modal-body">
          <div class="full-game-list-grid" id="full-game-list-grid"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('full-list-title').textContent = title;
  const grid = document.getElementById('full-game-list-grid');
  grid.innerHTML = '<div class="loading-games">加载中...</div>';
  
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  try {
    const response = await fetch(apiUrl, { headers });
    const data = await response.json();
    
    if (data.success && data.games && data.games.length > 0) {
      grid.innerHTML = data.games.map(game => renderTiktokCard(game)).join('');
    } else {
      grid.innerHTML = '<div class="empty-games">暂无内容</div>';
    }
  } catch(e) {
    grid.innerHTML = '<div class="error-games">加载失败</div>';
  }
}

// 关闭完整游戏列表弹窗
function closeFullGameList() {
  const modal = document.getElementById('full-game-list-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// 根据屏幕宽度计算一行可显示的卡片数
function getProfileCardLimit() {
  // 获取实际容器宽度（减去padding）
  const container = document.querySelector('.profile-horizontal-list');
  const containerWidth = container ? container.offsetWidth : (window.innerWidth - 32);
  
  // 卡片最小宽度约80px，加上gap 12px
  const cardWidth = 92; // 80px min-width + 12px gap
  const maxCards = Math.floor(containerWidth / cardWidth);
  
  // 限制在合理范围内: 最少2个，最多8个
  return Math.max(2, Math.min(8, maxCards));
}

// 加载我的作品列表（横向布局 - 根据屏幕宽度只显示一行）
async function loadProfilePageGames() {
  const container = document.getElementById('profile-games-list');
  const countEl = document.getElementById('profile-games-count');
  const moreBtn = document.getElementById('profile-games-more');
  const DISPLAY_LIMIT = getProfileCardLimit(); // 根据屏幕宽度动态计算
  if (!container) return;
  
  container.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const response = await fetch('/api/my-games', {
      headers: { 'X-Author-Token': getAuthorToken() }
    });
    const data = await response.json();
    
    if (data.success && data.games && data.games.length > 0) {
      const total = data.games.length;
      // 更新section标题的数量
      const sectionCount = document.getElementById('section-count-games');
      if (sectionCount) sectionCount.textContent = total;
      // 只显示前4个
      const displayGames = data.games.slice(0, DISPLAY_LIMIT);
      container.innerHTML = displayGames.map(game => renderHorizontalCard(game)).join('');
      // 超过4个显示更多按钮
      if (moreBtn) moreBtn.style.display = total > DISPLAY_LIMIT ? 'inline-flex' : 'none';
    } else {
      container.innerHTML = '<div class="empty-games">还没有作品，去创作吧！</div>';
      const sectionCount = document.getElementById('section-count-games');
      if (sectionCount) sectionCount.textContent = '0';
      if (moreBtn) moreBtn.style.display = 'none';
    }
  } catch (e) {
    container.innerHTML = '<div class="error-games">加载失败</div>';
  }
}

// 渲染抖音风格卡片
function renderTiktokCard(game, type = 'works') {
  const emoji = getGameEmoji(game.title);
  const playCount = formatNumber(game.play_count || 0);
  const likeCount = formatNumber(game.like_count || 0);
  const author = type === 'works' ? '' : `<span>👤 ${escapeHtml(game.author_name || '匿名')}</span>`;
  
  return `
    <div class="tiktok-card" onclick="openGame('${game.id}')">
      <div class="tiktok-card-cover">${emoji}</div>
      <div class="tiktok-card-overlay">
        <div class="tiktok-card-title">${escapeHtml(game.title)}</div>
        <div class="tiktok-card-stats">
          <span>▶️ ${playCount}</span>
          <span>❤️ ${likeCount}</span>
          ${author}
        </div>
      </div>
    </div>
  `;
}

// 渲染横向小卡片（用于我的页面）- 带统计数据
function renderHorizontalCard(game) {
  const emoji = getGameEmoji(game.title);
  const plays = game.plays || game.play_count || 0;
  const likes = game.likes || game.like_count || 0;
  const isDraft = game.status === 'draft';

  return `
    <div class="profile-game-card-h ${isDraft ? 'draft-card' : ''}" onclick="openGame('${game.id}')">
      ${isDraft ? '<div class="draft-badge">创作中</div>' : ''}
      <div class="card-cover">${emoji}</div>
      <div class="card-title">${escapeHtml(game.title)}</div>
      <div class="card-stats">
        <span class="card-stat">
          <span class="stat-icon">🎮</span>
          <span>${formatNumber(plays)}</span>
        </span>
        <span class="card-stat">
          <span class="stat-icon">❤️</span>
          <span>${formatNumber(likes)}</span>
        </span>
      </div>
    </div>
  `;
}

// 根据游戏标题获取代表性emoji
function getGameEmoji(title) {
  const emojiMap = {
    '贪吃蛇': '🐍', '蛇': '🐍',
    '2048': '🔢', '数字': '🔢',
    '俄罗斯方块': '🧱', '方块': '🧱', '俄罗斯': '🧱',
    '打砖块': '🎯', '砖块': '🧱',
    '飞机': '🚀', '射击': '🔫', '大战': '⚔️',
    '翻牌': '🃏', '配对': '🎴', '记忆': '🧠',
    '跑酷': '🏃', '跳跃': '🦘',
    '小鸟': '🐦', 'flappy': '🐦', 'bird': '🐦',
    '消消乐': '💎', '消除': '✨',
    '迷宫': '🌀', '探险': '🗺️',
    '赛车': '🏎️', '汽车': '🚗',
    '足球': '⚽', '篮球': '🏀', '乒乓': '🏓',
    '钢琴': '🎹', '音乐': '🎵',
    '象棋': '♟️', '五子棋': '⚫', '棋': '♟️',
    '拼图': '🧩', '益智': '🧩',
    '塔防': '🏰', '防御': '🛡️',
    '扫雷': '💣', '地雷': '💣',
    '接水果': '🍎', '水果': '🍇',
    '打地鼠': '🐹', '地鼠': '🐹',
    '泡泡': '🫧', '气泡': '🫧'
  };
  
  const lowerTitle = title.toLowerCase();
  for (const [keyword, emoji] of Object.entries(emojiMap)) {
    if (lowerTitle.includes(keyword.toLowerCase())) {
      return emoji;
    }
  }
  return '🎮'; // 默认游戏emoji
}

// 格式化数字（1000 -> 1K）
function formatNumber(num) {
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

// 加载我的点赞（横向布局 - 根据屏幕宽度只显示一行）
async function loadProfilePageLikes() {
  const container = document.getElementById('profile-likes-list');
  const moreBtn = document.getElementById('profile-likes-more');
  const DISPLAY_LIMIT = getProfileCardLimit();
  if (!container) return;
  
  container.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const response = await fetch('/api/my-likes', {
      headers: { 'X-User-Token': getUserToken() }
    });
    const data = await response.json();
    
    if (data.success && data.games && data.games.length > 0) {
      const total = data.games.length;
      const sectionCount = document.getElementById('section-count-likes');
      if (sectionCount) sectionCount.textContent = total;
      const displayGames = data.games.slice(0, DISPLAY_LIMIT);
      container.innerHTML = displayGames.map(game => renderHorizontalCard(game)).join('');
      if (moreBtn) moreBtn.style.display = total > DISPLAY_LIMIT ? 'inline-flex' : 'none';
    } else {
      container.innerHTML = '<div class="empty-games">还没有点赞的游戏</div>';
      const sectionCount = document.getElementById('section-count-likes');
      if (sectionCount) sectionCount.textContent = '0';
      if (moreBtn) moreBtn.style.display = 'none';
    }
  } catch (e) {
    console.error('加载点赞列表失败:', e);
    container.innerHTML = '<div class="error-games">加载失败</div>';
  }
}

// 加载我的收藏（横向布局 - 根据屏幕宽度只显示一行）
async function loadProfilePageFavorites() {
  const container = document.getElementById('profile-favs-list');
  const moreBtn = document.getElementById('profile-favs-more');
  const DISPLAY_LIMIT = getProfileCardLimit();
  if (!container) return;
  
  container.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const response = await fetch('/api/my-favorites', {
      headers: { 'X-User-Token': getUserToken() }
    });
    const data = await response.json();
    
    if (data.success && data.games && data.games.length > 0) {
      const total = data.games.length;
      const sectionCount = document.getElementById('section-count-favs');
      if (sectionCount) sectionCount.textContent = total;
      const displayGames = data.games.slice(0, DISPLAY_LIMIT);
      container.innerHTML = displayGames.map(game => renderHorizontalCard(game)).join('');
      if (moreBtn) moreBtn.style.display = total > DISPLAY_LIMIT ? 'inline-flex' : 'none';
    } else {
      container.innerHTML = '<div class="empty-games">还没有收藏的游戏</div>';
      const sectionCount = document.getElementById('section-count-favs');
      if (sectionCount) sectionCount.textContent = '0';
      if (moreBtn) moreBtn.style.display = 'none';
    }
  } catch (e) {
    console.error('加载收藏列表失败:', e);
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

// 切换设置区域的展开/折叠（旧版，已废弃）
function toggleProfileSettings() {
  const content = document.getElementById('profile-settings-content');
  const arrow = document.getElementById('settings-arrow');
  
  if (content && arrow) {
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    arrow.classList.toggle('expanded', isHidden);
  }
}

// 打开个人中心设置弹窗（右上角设置按钮）
function openProfileSettings() {
  // 直接打开设置弹窗
  openSettings();
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
  // 隐藏所有其他页面
  document.getElementById('home-page').classList.remove('active');
  document.getElementById('create-page').classList.remove('active');
  document.getElementById('profile-page').classList.remove('active');
  // 显示游戏页面
  document.getElementById('game-page').classList.add('active');
  // 隐藏底部导航
  document.getElementById('bottom-nav').style.display = 'none';
  // 隐藏设置按钮
  const settingsBtn = document.getElementById('profile-settings-btn');
  if (settingsBtn) settingsBtn.classList.remove('visible');
  // 清除底部导航的选中状态
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.classList.remove('active');
  });
  // 隐藏草稿操作按钮（如果有）
  hideDraftActions();
}

// 显示草稿操作按钮（重新生成 / 删除）
function showDraftActions(gameId, prompt) {
  // 先移除已有的
  hideDraftActions();
  
  const container = document.querySelector('.game-frame-container');
  if (!container) return;
  
  const actionsDiv = document.createElement('div');
  actionsDiv.id = 'draft-actions';
  actionsDiv.className = 'draft-actions-overlay';
  actionsDiv.innerHTML = `
    <div class="draft-actions-buttons">
      <button class="btn btn-primary" onclick="regenerateDraft('${escapeHtml(prompt)}', '${gameId}')">
        🔄 重新生成
      </button>
      <button class="btn btn-danger" onclick="deleteDraft('${gameId}')">
        🗑️ 删除
      </button>
    </div>
  `;
  container.appendChild(actionsDiv);
}

// 隐藏草稿操作按钮
function hideDraftActions() {
  const existing = document.getElementById('draft-actions');
  if (existing) existing.remove();
}

// 重新生成草稿
async function regenerateDraft(prompt, draftId) {
  // 先删除旧草稿
  try {
    await fetch(`/api/games/${draftId}`, {
      method: 'DELETE',
      headers: { 'X-Author-Token': getAuthorToken() }
    });
  } catch (e) {
    console.error('删除旧草稿失败:', e);
  }
  
  // 返回首页并触发生成
  showHome();
  
  // 填入prompt并生成
  const input = document.getElementById('prompt-input');
  if (input) {
    input.value = prompt;
  }
  
  // 延迟一下再生成，确保页面已切换
  setTimeout(() => {
    generateGame();
  }, 100);
}

// 删除草稿
async function deleteDraft(draftId) {
  if (!confirm('确定要删除这个未完成的游戏吗？')) return;
  
  try {
    const response = await fetch(`/api/games/${draftId}`, {
      method: 'DELETE',
      headers: { 'X-Author-Token': getAuthorToken() }
    });
    
    const data = await response.json();
    if (data.success) {
      showToast('已删除', 'success');
      showHome();
    } else {
      showToast(data.error || '删除失败', 'error');
    }
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
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
  document.body.classList.add('modal-open');
  
  // 显示当前账号ID
  const accountIdEl = document.getElementById('settings-account-id');
  if (accountIdEl) {
    accountIdEl.textContent = getAccountId() || '未登录';
  }
  
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
  document.body.classList.remove('modal-open');
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
let currentModelEstimatedTime = 30; // 当前模型预计时间（秒），默认30秒
let modelEstimatedTimes = {}; // 各模型预计时间配置

// 从服务器加载模型预计生成时间配置
async function loadModelEstimatedTimes() {
  try {
    const response = await fetch('/api/config/model-times');
    if (response.ok) {
      const data = await response.json();
      modelEstimatedTimes = data.times || {};
      log(`已加载模型预计时间配置: ${Object.keys(modelEstimatedTimes).length}个模型`, 'info');
    }
  } catch (error) {
    log('加载模型时间配置失败，使用默认值', 'warn');
    // 使用默认值
    modelEstimatedTimes = {
      'deepseek-v3': 30,
      'deepseek-r1': 45,
      'gpt-4o': 40,
      'claude-sonnet-4': 35
    };
  }
}

// 更新生成时间显示
function updateGeneratingTime() {
  if (!generatingStartTime) return;
  
  const elapsed = Math.floor((Date.now() - generatingStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  
  const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  
  // 计算预计剩余时间
  const remaining = Math.max(0, currentModelEstimatedTime - elapsed);
  const remainingStr = remaining > 0 ? `预计剩余 ${remaining}秒` : '即将完成...';
  
  // 计算进度百分比
  const progress = Math.min(100, Math.floor((elapsed / currentModelEstimatedTime) * 100));
  
  const timeEl = document.getElementById('generating-time');
  if (timeEl) timeEl.textContent = `已用时: ${timeStr} | ${remainingStr}`;
  
  // 更新进度条
  const progressBar = document.getElementById('generating-progress-bar');
  if (progressBar) progressBar.style.width = `${progress}%`;
  
  const floatTimeEl = document.getElementById('float-time');
  if (floatTimeEl) floatTimeEl.textContent = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`;
}

// 生成中tips轮换相关
let generatingTipsTimer = null;
let generatingTipsIndex = 0;

// 生成中tips列表 (从CREATE_TIPS复用或独立定义)
const GENERATING_TIPS = [
  '添加具体的游戏玩法描述，效果会更好哦！',
  '尝试描述游戏的主题和风格，AI会更懂你',
  '可以指定游戏难度和关卡数量',
  '生成过程中可以最小化继续浏览',
  '保存游戏后可以分享给朋友一起玩',
  '关注公众号可以获得更多生成次数',
  '游戏生成后可以查看源码学习',
  '好的游戏描述 = 好的游戏效果',
];

// 开始计时
function startGeneratingTimer() {
  generatingStartTime = Date.now();
  updateGeneratingTime();
  generatingTimer = setInterval(updateGeneratingTime, 1000);
  
  // 启动tips轮换
  startGeneratingTips();
}

// 停止计时
function stopGeneratingTimer() {
  if (generatingTimer) {
    clearInterval(generatingTimer);
    generatingTimer = null;
  }
  generatingStartTime = null;
  
  // 停止tips轮换
  stopGeneratingTips();
}

// 启动生成中tips轮换
function startGeneratingTips() {
  generatingTipsIndex = 0;
  updateGeneratingTip();
  // 每5秒切换一次
  generatingTipsTimer = setInterval(updateGeneratingTip, 5000);
}

// 停止tips轮换
function stopGeneratingTips() {
  if (generatingTipsTimer) {
    clearInterval(generatingTipsTimer);
    generatingTipsTimer = null;
  }
}

// 更新当前tip
function updateGeneratingTip() {
  const tipText = document.getElementById('generating-tips-text');
  if (tipText) {
    // 使用配置的tips或默认的
    const tips = (typeof CREATE_TIPS !== 'undefined' && CREATE_TIPS.length > 0) 
      ? CREATE_TIPS 
      : GENERATING_TIPS;
    tipText.textContent = tips[generatingTipsIndex % tips.length];
    generatingTipsIndex++;
  }
}

// 最小化生成遮罩
function minimizeGenerating() {
  backgroundTask.isMinimized = true;

  // 隐藏遮罩
  hideGeneratingOverlay();

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
    showGeneratingOverlay();
  }
}

// 显示生成遮罩
function showGeneratingOverlay() {
  const overlay = document.getElementById('generating-overlay');
  overlay.classList.add('active');
  document.body.classList.add('overlay-open');
}

// 隐藏生成遮罩
function hideGeneratingOverlay() {
  const overlay = document.getElementById('generating-overlay');
  overlay.classList.remove('active');
  document.body.classList.remove('overlay-open');
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
  
  // setGenerateButtonLoading(false);
  document.getElementById('generating-overlay').classList.remove('active');
  document.body.classList.remove('overlay-open');
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
      isNew: true,
      draftId: backgroundTask.result.draftId
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
  
  // 确保账号已初始化
  if (!state.account.loaded || !getUserToken()) {
    showToast('账号正在初始化，请稍候...', 'info');
    // 尝试重新初始化
    await initAccount();
    updateAccountIdDisplay();
    return;
  }
  
  // 检查积分（首次生成和编辑免费）
  const creditCheck = checkCreditsForGeneration();
  if (!creditCheck.canGenerate) {
    openNoCreditsModal();
    return;
  }
  
  // 立即扣除积分并刷新显示（在发起请求前）
  if (!creditCheck.isFree) {
    state.credits--;
    saveCredits();
    updateCreditsDisplay();
    showToast(`💎 消耗1积分，剩余: ${state.credits}`, 'info');
  } else {
    showToast(`💎 ${creditCheck.message} | 当前积分: ${state.credits}`, 'success');
    // 标记首次生成已使用
    if (state.isFirstGeneration) {
      state.isFirstGeneration = false;
      localStorage.setItem('aigame-first-generation', 'false');
    }
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
  
  // 不再禁用按钮，允许多任务生成
  // setGenerateButtonLoading(true);
  
  clearGeneratingLog();
  document.getElementById('generating-overlay').classList.add('active');
  document.body.classList.add('overlay-open');
  
  // 获取当前模型的预计生成时间
  const selectedModel = state.settings.llmProvider || 'deepseek-v3';
  currentModelEstimatedTime = modelEstimatedTimes[selectedModel] || 30; // 默认30秒
  
  startGeneratingTimer();
  
  // 保存生成状态到本地存储，并创建草稿（防止关闭浏览器丢失）
  // 这里必须 await，确保草稿已创建，后端可以在生成完成后更新它
  const createdDraftId = await saveGeneratingState();
  log(`草稿ID: ${createdDraftId || '无'}`);
  
  log(`开始生成游戏: "${prompt}"`);
  updateGeneratingStatus('正在连接 AI 服务...');
  
  try {
    // 构建LLM配置 - 使用模型注册表
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
    
    // 获取用户token和作者token
    const userToken = getUserToken();
    const authorToken = getAuthorToken();
    
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Token': userToken || '',
        'X-Author-Token': authorToken || ''
      },
      body: JSON.stringify({ 
        prompt, 
        llmConfig,
        draftId: createdDraftId  // 传递草稿ID，后端生成完成后会自动更新
      }),
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
    
    // 积分已在请求发起时扣除，这里只记录日志
    log(`当前剩余积分: ${state.credits}`, 'info');
    
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
    
    // 获取草稿ID（如果有）
    let draftId = null;
    try {
      const savedState = localStorage.getItem('aigame-generating-state');
      if (savedState) {
        const generatingState = JSON.parse(savedState);
        draftId = generatingState.draftId;
      }
    } catch (e) {
      console.error('获取草稿ID失败:', e);
    }
    
    // 如果有草稿ID，自动更新草稿状态为已完成
    if (draftId) {
      try {
        const authorToken = getAuthorToken();
        console.log('[DEBUG] 更新草稿状态:', { draftId, authorToken: authorToken?.slice(0,8) + '...' });
        
        const updateResponse = await fetch(`/api/games/${draftId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'X-Author-Token': authorToken
          },
          body: JSON.stringify({
            title: data.title,
            prompt: prompt,
            code: data.code,
            authorToken: authorToken,  // 也在body中传递token
            status: 'published'  // 生成完成后自动发布
          })
        });
        
        const updateResult = await updateResponse.json();
        if (updateResult.success) {
          log('草稿已自动更新为已发布', 'success');
          console.log('[INFO] 草稿更新成功:', draftId);
        } else {
          console.error('[ERROR] 草稿更新失败:', updateResult.error);
        }
      } catch (e) {
        console.error('[ERROR] 自动更新草稿异常:', e);
      }
    }
    
    // 判断是否在后台模式
    if (backgroundTask.isMinimized) {
      // 后台模式：保存结果，显示通知
      backgroundTask.result = {
        title: data.title,
        code: data.code,
        draftId: draftId
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
        isNew: true,
        draftId: draftId
      };
      state.currentGameId = draftId || null;  // 如果有草稿ID，设置为当前游戏ID
      
      // 隐藏生成遮罩和浮动提示
      document.getElementById('generating-overlay').classList.remove('active');
      document.body.classList.remove('overlay-open');
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
  document.body.classList.remove('overlay-open');
    document.getElementById('generating-float').classList.remove('active');
  } finally {
    state.isGenerating = false;
    state.abortController = null;
    backgroundTask.isActive = false;
    stopGeneratingTimer();
    // 清除保存的生成状态
    clearGeneratingState();
    // setGenerateButtonLoading(false);
  }
}

// 打开保存弹窗
function openSaveModal() {
  const modal = document.getElementById('save-modal');
  modal.classList.add('active');
  
  document.getElementById('save-title').value = state.currentGame?.title || '';
  document.getElementById('save-author').value = state.settings.authorName || state.account.nickname || '';
  
  // 生成成功后刷新积分显示（后端已扣除，前端同步）
  loadCredits().then(() => {
    updateCreditsDisplay();
  });
  
  // 显示账号信息
  const accountIdEl = document.getElementById('save-account-id');
  
  if (accountIdEl && state.account.loaded) {
    accountIdEl.textContent = state.account.accountId;
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

// 切换密码输入框显示（已废弃，保留空函数避免报错）
function togglePasswordField() {
  // 密码功能已移除
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
    
    // 检查是否为编辑模式（有currentGameId就是编辑/更新模式）
    const isEditing = state.currentGame?.isEditing && state.currentGameId;
    
    // 检查是否有草稿ID或已有游戏ID需要更新
    const draftId = state.currentGame?.draftId;
    const existingGameId = draftId || state.currentGameId;
    
    let response;
    if (isEditing) {
      // 编辑模式：更新现有游戏
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
    } else if (existingGameId) {
      // 更新已有游戏（草稿或已发布的游戏）
      response = await fetch(`/api/games/${existingGameId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Author-Token': authorToken
        },
        body: JSON.stringify({
          title,
          prompt: state.currentGame.prompt,
          code: state.currentGame.code,
          authorName,
          authorToken,
          status: 'published'
        })
      });
      // 确保当前游戏ID正确
      state.currentGameId = existingGameId;
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
  
  // 检测微信环境 - 直接跳转到静态页面以获得最佳体验
  const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
  if (isWeChat && !window.location.pathname.startsWith('/g/')) {
    // 微信浏览器中，如果不是已经在静态页面，则跳转到静态页面
    const staticUrl = `/g/${gameId.substring(0, 2)}/${gameId}.html`;
    log(`微信环境检测到，跳转到静态页面: ${staticUrl}`);
    window.location.href = staticUrl;
    return;
  }
  
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
    
    // 检查是否是草稿（制作中的游戏）
    if (data.game.status === 'draft') {
      showGameLoading(false);
      
      // 检查草稿是否已过期（超过2分钟可能是失败了）
      const createdAt = new Date(data.game.created_at).getTime();
      const now = Date.now();
      const isStale = (now - createdAt) > 2 * 60 * 1000; // 2分钟
      
      // 检查是否是当前用户的草稿
      const authorToken = getAuthorToken();
      const isOwner = data.game.author_token === authorToken;
      
      // 显示制作中提示
      const gameFrame = document.getElementById('game-frame');
      if (gameFrame) {
        const statusIcon = isStale ? '⚠️' : '🎨';
        const statusTitle = isStale ? '生成可能已中断' : '游戏制作中...';
        const statusDesc = isStale 
          ? '这个游戏的生成可能已经中断<br>请尝试重新生成或删除'
          : 'AI正在努力创作这个游戏<br>完成后即可游玩';
        const loaderHtml = isStale ? '' : '<div class="loader"></div>';
        const hintText = isStale ? '💡 点击下方按钮处理' : '💡 稍后刷新页面查看';
        
        const draftHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color: white;
                text-align: center;
                padding: 20px;
                box-sizing: border-box;
              }
              .draft-icon { font-size: 64px; margin-bottom: 20px; ${isStale ? '' : 'animation: pulse 2s infinite;'} }
              @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
              .draft-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; color: ${isStale ? '#ff6b6b' : 'white'}; }
              .draft-desc { font-size: 16px; color: rgba(255,255,255,0.7); max-width: 300px; line-height: 1.5; }
              .draft-prompt { font-size: 14px; color: #ffa500; margin-top: 20px; padding: 12px 20px; background: rgba(255,165,0,0.1); border-radius: 8px; max-width: 280px; word-break: break-all; }
              .draft-hint { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 30px; }
              .loader { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #ffa500; border-radius: 50%; animation: spin 1s linear infinite; margin-top: 20px; }
              @keyframes spin { to { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="draft-icon">${statusIcon}</div>
            <div class="draft-title">${statusTitle}</div>
            <div class="draft-desc">${statusDesc}</div>
            <div class="draft-prompt">"${escapeHtml(data.game.prompt || data.game.title)}"</div>
            ${loaderHtml}
            <div class="draft-hint">${hintText}</div>
          </body>
          </html>
        `;
        // 使用 Blob URL 方式加载，兼容微信浏览器
        const blob = new Blob([draftHtml], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        gameFrame.src = blobUrl;
        // 清理旧的 blob URL
        gameFrame.onload = () => {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        };
      }
      // 更新页面标题
      const titleEl = document.getElementById('game-title');
      if (titleEl) titleEl.textContent = data.game.title + (isStale ? ' (生成中断)' : ' (制作中)');
      
      // 隐藏互动按钮（制作中的游戏不能互动）
      const sidebar = document.getElementById('tiktok-sidebar');
      if (sidebar) sidebar.style.display = 'none';
      const authorInfo = document.getElementById('tiktok-author-info');
      if (authorInfo) authorInfo.style.display = 'none';
      
      // 如果是作者且草稿已过期，显示操作按钮
      if (isOwner && isStale) {
        showDraftActions(gameId, data.game.prompt || data.game.title);
      }
      return;
    }
    
    log(`游戏加载成功: ${data.game.title}`, 'success');
    log(`代码长度: ${data.game.code?.length || 0} 字符`);
    
    displayGame(data.game.code, data.game.title, data.game.author_name, data.game.llm_model);
    
    // 设置作者关注按钮
    setupAuthorFollowButton(data.game.author_token, data.game.author_name);
    
    // 检查是否为作者
    checkIsAuthor(gameId);
    
    // 更新点赞数（使用正确的元素ID）
    const statLikesEl = document.getElementById('stat-likes');
    if (statLikesEl) statLikesEl.textContent = data.game.like_count || 0;
    
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
function displayGame(code, title, authorName, llmModel) {
  showGamePage();
  showGameLoading(true);
  
  document.getElementById('game-title').textContent = title || '未命名游戏';
  
  // 显示模型标签
  const modelTag = document.getElementById('game-model-tag');
  if (modelTag) {
    if (llmModel) {
      modelTag.textContent = `🤖 ${getModelDisplayName(llmModel)}`;
      modelTag.style.display = 'inline-block';
    } else {
      modelTag.style.display = 'none';
    }
  }
  
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
  
  // 检测浏览器环境
  const isWechat = /MicroMessenger/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  log(`浏览器环境: 微信=${isWechat}, iOS=${isIOS}, Android=${isAndroid}`);
  
  if (isWechat) {
    // 微信浏览器特殊处理
    log('检测到微信浏览器，使用兼容模式加载');
    
    if (isIOS) {
      // iOS 微信使用 srcdoc（iOS WKWebView 对 Blob URL 支持差）
      log('iOS微信: 使用srcdoc方式加载');
      iframe.srcdoc = processedCode;
    } else {
      // Android 微信尝试使用 Blob URL，失败则回退
      try {
        const blob = new Blob([processedCode], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        
        // 保存原始onload处理函数
        const originalOnload = iframe.onload;
        
        iframe.src = blobUrl;
        
        // 不覆盖原有的onload逻辑，只添加清理逻辑
        const cleanupBlobUrl = () => {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        };
        
        // 设置超时检测，如果5秒内未加载成功则回退到srcdoc
        const loadTimeout = setTimeout(() => {
          log('Blob URL加载超时，回退到srcdoc', 'warn');
          URL.revokeObjectURL(blobUrl);
          iframe.srcdoc = processedCode;
        }, 5000);
        
        // 增强onload处理
        const enhancedOnload = iframe.onload;
        iframe.onload = () => {
          clearTimeout(loadTimeout);
          cleanupBlobUrl();
          if (enhancedOnload) enhancedOnload();
        };
        
        log('Android微信: 使用Blob URL方式加载');
      } catch (e) {
        log('Blob URL创建失败，回退到srcdoc: ' + e.message, 'warn');
        iframe.srcdoc = processedCode;
      }
    }
  } else {
    // 其他浏览器使用srcdoc
    iframe.srcdoc = processedCode;
  }
}

// 查看游戏源代码（改进版 - 支持返回和编辑）
function viewGameSource() {
  if (!state.currentGameCode) {
    showToast('没有可查看的代码', 'error');
    return;
  }

  // 创建源码查看弹窗
  const existingModal = document.getElementById('source-code-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'source-code-modal';
  modal.onclick = (e) => { if (e.target === modal) closeSourceCodeModal(); };

  modal.innerHTML = `
    <div class="modal-content modal-xlarge source-code-modal-content">
      <div class="modal-header">
        <h3>📄 游戏源代码</h3>
        <div class="source-code-actions">
          <button class="btn btn-secondary btn-small" onclick="copySourceCode()">📋 复制代码</button>
          <button class="btn btn-icon btn-close" onclick="closeSourceCodeModal()">×</button>
        </div>
      </div>
      <div class="modal-body source-code-body">
        <textarea id="source-code-editor" class="source-code-editor" spellcheck="false">${escapeHtml(state.currentGameCode)}</textarea>
      </div>
      <div class="modal-footer source-code-footer">
        <button class="btn btn-secondary" onclick="closeSourceCodeModal()">返回游戏</button>
        <button class="btn btn-primary" onclick="applySourceCodeChanges()">💾 应用修改</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
}

// 关闭源码弹窗
function closeSourceCodeModal() {
  const modal = document.getElementById('source-code-modal');
  if (modal) {
    modal.remove();
    document.body.classList.remove('modal-open');
  }
}

// 复制源代码
function copySourceCode() {
  const editor = document.getElementById('source-code-editor');
  if (editor) {
    navigator.clipboard.writeText(editor.value).then(() => {
      showToast('代码已复制到剪贴板');
    }).catch(() => {
      editor.select();
      document.execCommand('copy');
      showToast('代码已复制到剪贴板');
    });
  }
}

// 应用源代码修改
function applySourceCodeChanges() {
  const editor = document.getElementById('source-code-editor');
  if (editor) {
    const newCode = editor.value;
    state.currentGameCode = newCode;

    // 重新加载游戏
    const iframe = document.getElementById('game-frame');
    if (iframe) {
      iframe.srcdoc = newCode;
    }

    closeSourceCodeModal();
    showToast('代码已应用，游戏已重新加载');
  }
}

// 检查是否为作者（编辑功能已禁用，因为已生成的游戏无法继续对话编辑）
async function checkIsAuthor(gameId) {
  const editBtn = document.getElementById('edit-btn');
  // 编辑功能已禁用 - 始终隐藏编辑按钮
  if (editBtn) {
    editBtn.style.display = 'none';
  }
  return false;
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
      headers: { 'X-User-Token': getUserToken() }
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

// 复制分享链接（直接使用预览区的文字）
async function copyShareUrl() {
  // 直接获取预览区显示的分享文案
  const textPreview = document.getElementById('share-text-preview');
  const shareText = textPreview ? textPreview.value : '';
  
  if (!shareText) {
    showToast('分享内容为空', 'error');
    return;
  }
  
  // 复制到剪贴板
  try {
    await navigator.clipboard.writeText(shareText);
    showToast('分享内容已复制', 'success');
  } catch (e) {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = shareText;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('分享内容已复制', 'success');
  }
}

// 复制文本到剪贴板
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      // 降级方案
      fallbackCopyToClipboard(text);
    });
  } else {
    fallbackCopyToClipboard(text);
  }
}

function fallbackCopyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
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
      
      // 更新积分获取方式的已完成状态
      updateCreditWaysStatus(data);
    }
  } catch (error) {
    console.error('加载积分失败:', error);
  }
}

// 更新积分获取方式的已完成状态
function updateCreditWaysStatus(creditsData) {
  // 公众号关注 - 已完成则禁用
  const wayWechat = document.getElementById('way-wechat');
  if (wayWechat) {
    if (creditsData.followedWechat) {
      wayWechat.classList.add('completed');
      wayWechat.onclick = null;
      const desc = document.getElementById('way-wechat-desc');
      if (desc) desc.textContent = '已领取奖励';
      const reward = document.getElementById('way-wechat-reward');
      if (reward) reward.textContent = '+3次';
    } else {
      wayWechat.classList.remove('completed');
    }
  }
  
  // 分享和邀请可以多次使用，不设置完成状态
}

// 更新积分显示（全局所有位置）
function updateCreditsDisplay() {
  const credits = state.credits;
  
  // 底部导航积分
  const navCount = document.getElementById('nav-credits-count');
  if (navCount) navCount.textContent = credits;
  
  // 积分弹窗
  const modalCount = document.getElementById('credits-count');
  if (modalCount) modalCount.textContent = credits;
  
  // 创作页面积分
  const createCount = document.getElementById('create-credits-count');
  if (createCount) createCount.textContent = credits;
  
  // 个人中心积分
  const profileCredits = document.getElementById('profile-page-credits');
  if (profileCredits) profileCredits.textContent = credits;
  
  // 个人弹窗积分
  const profileModalCredits = document.getElementById('profile-credits');
  if (profileModalCredits) profileModalCredits.textContent = credits;
  
  // 设置页积分
  const profileCreditsValue = document.getElementById('profile-credits-value');
  if (profileCreditsValue) profileCreditsValue.textContent = credits;
  
  log(`积分显示已更新: ${credits}`, 'info');
}

// 打开积分弹窗
function openCreditsModal() {
  loadCredits().then(() => {
    openModal('credits-modal');
    
    // 更新广告次数显示
    if (state.creditsConfig) {
      const adLimit = document.getElementById('ad-daily-limit');
      if (adLimit) adLimit.textContent = state.creditsConfig.dailyLimit;
    }
  });
}

// 关闭积分弹窗
function closeCreditsModal() {
  closeModal('credits-modal');
}

// 显示/切换公众号验证
function showWechatVerify() {
  const wayWechat = document.getElementById('way-wechat');
  // 如果已完成，不执行任何操作
  if (wayWechat && wayWechat.classList.contains('completed')) {
    showToast('已领取关注公众号奖励', 'info');
    return;
  }
  
  const section = document.getElementById('wechat-verify-section');
  const isHidden = section.style.display === 'none';
  section.style.display = isHidden ? 'block' : 'none';
  
  // 展开时滚动到可见位置并高亮
  if (isHidden) {
    setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 添加高亮动画
      section.classList.add('highlight-animation');
      setTimeout(() => section.classList.remove('highlight-animation'), 1500);
    }, 100);
  }
}

// 兼容别名
function toggleWechatVerify() {
  showWechatVerify();
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

// 从公众号弹窗验证
async function verifyWechatFromPromo() {
  const code = document.getElementById('promo-verify-code').value.trim();

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
      closeBrandPromo();

      // 同步更新积分弹窗中的状态
      const wayWechat = document.getElementById('way-wechat');
      if (wayWechat) {
        wayWechat.classList.add('completed');
        const desc = document.getElementById('way-wechat-desc');
        if (desc) desc.textContent = '已领取奖励';
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
    accountStatusEl.innerHTML = '<span class="status-badge status-protected">🔐 已绑定设备</span>';
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
  
  // 密码设置已移除，改用设备指纹自动恢复机制
  
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
        listContainer.innerHTML = data.games.map(game => {
          const isDraft = game.status === 'draft';
          const createdTime = new Date(game.created_at).getTime();
          const now = Date.now();
          const ageMinutes = (now - createdTime) / 1000 / 60;
          const isStale = isDraft && ageMinutes > 2; // 超过2分钟可能失败
          
          if (isDraft) {
            // 制作中的游戏 - 特殊UI
            return `
              <div class="my-game-item my-game-draft ${isStale ? 'stale' : ''}" data-id="${game.id}">
                <div class="my-game-info">
                  <div class="my-game-title">
                    ${isStale ? '⚠️' : '⏳'} ${escapeHtml(game.title)}
                    <span class="draft-badge">${isStale ? '可能失败' : '制作中'}</span>
                  </div>
                  <div class="my-game-prompt">${escapeHtml(game.prompt || '')}</div>
                  <div class="my-game-meta">
                    <span>📅 ${formatDate(game.created_at)}</span>
                    ${isStale ? '<span class="stale-hint">生成超时，请重试或删除</span>' : '<span class="making-hint">正在生成中...</span>'}
                  </div>
                </div>
                <div class="my-game-actions">
                  <button class="btn btn-small btn-primary" onclick="regenerateDraft('${escapeHtml(game.prompt || game.title)}', '${game.id}')">
                    🔄 重试
                  </button>
                  <button class="btn btn-small btn-danger" onclick="deleteDraft('${game.id}')">
                    🗑️ 删除
                  </button>
                </div>
              </div>
            `;
          } else {
            // 已完成的游戏 - 正常UI
            return `
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
                  <button class="btn btn-small btn-danger" onclick="deleteMyGame('${game.id}', '${escapeHtml(game.title)}')">
                    🗑️ 删除
                  </button>
                </div>
              </div>
            `;
          }
        }).join('');
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
      headers: { 'X-User-Token': getUserToken() }
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
      headers: { 'X-User-Token': getUserToken() }
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
      headers: { 'X-User-Token': getUserToken() }
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
      headers: { 'X-User-Token': getUserToken() }
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
      headers: { 'X-User-Token': getUserToken() }
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
      headers: { 'X-User-Token': getUserToken() }
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
      headers: { 'X-User-Token': getUserToken() }
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
async function generateWithTrial(draftId = null) {
  const prompt = document.getElementById('prompt-input').value.trim();
  
  if (!prompt) {
    showToast('请输入游戏描述', 'error');
    return false;
  }
  
  try {
    const authorToken = getAuthorToken();
    const response = await fetch('/api/trial/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken(),
        'X-Author-Token': authorToken || ''
      },
      body: JSON.stringify({ prompt, draftId })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 更新游客模式剩余次数
      if (state.trialInfo) {
        state.trialInfo.userRemaining = data.userRemaining;
        state.trialInfo.globalRemaining = data.globalRemaining;
        updateTrialBanner();
      }
      return data;
    } else {
      throw new Error(data.error || '游客模式生成失败');
    }
  } catch (error) {
    showToast(error.message, 'error');
    return null;
  }
}

// ==================== 邀请链接系统 ====================

// 处理URL中的邀请和分享参数
async function handleReferralParams() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // 处理邀请链接 (?ref=XXXXXXXX)
  const refCode = urlParams.get('ref');
  if (refCode) {
    try {
      const response = await fetch('/api/invite/link-visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Token': getUserToken()
        },
        body: JSON.stringify({ refCode })
      });
      const data = await response.json();
      
      if (data.success && data.earned) {
        showToast(data.message, 'success', 5000);
        // 刷新积分显示
        await refreshCredits();
      }
      
      // 清理URL参数（不刷新页面）
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    } catch (error) {
      console.error('处理邀请链接失败:', error);
    }
  }
  
  // 处理游戏分享链接 (?sharer=XXXXXXXX&from=gameId)
  const sharerToken = urlParams.get('sharer');
  const fromGameId = urlParams.get('from');
  if (sharerToken && fromGameId) {
    try {
      await fetch('/api/invite/share-visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Token': getUserToken()
        },
        body: JSON.stringify({ gameId: fromGameId, sharerToken })
      });
      // 不显示提示，静默处理
      
      // 清理分享参数，保留游戏路由
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    } catch (error) {
      console.error('处理分享链接失败:', error);
    }
  }
}

// 每日登录积分检查
async function checkDailyLoginCredit() {
  try {
    const response = await fetch('/api/credits/daily-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      }
    });
    const data = await response.json();
    
    if (data.success && data.awarded) {
      showToast(`🎁 每日登录奖励：+${data.awarded} 积分！`, 'success', 4000);
      await refreshCredits();
    }
  } catch (error) {
    console.error('每日登录检查失败:', error);
  }
}

// 获取我的邀请链接
async function getMyInviteLink() {
  try {
    const response = await fetch('/api/invite/my-link', {
      headers: { 'X-User-Token': getUserToken() }
    });
    const data = await response.json();
    
    if (data.success) {
      state.myInviteCode = data.code;
      state.myInviteLink = window.location.origin + data.link;
      return { code: data.code, link: state.myInviteLink };
    }
  } catch (error) {
    console.error('获取邀请链接失败:', error);
  }
  return null;
}

// 获取我的邀请码（兼容旧代码）
async function getMyInviteCode() {
  const result = await getMyInviteLink();
  return result?.code || null;
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

// 复制邀请链接
function copyInviteLink() {
  const linkInput = document.getElementById('my-invite-link');
  const link = linkInput?.value || state.myInviteLink;
  
  if (link && link !== '加载中...') {
    navigator.clipboard.writeText(link).then(() => {
      showToast('🔗 邀请链接已复制！', 'success');
    }).catch(() => {
      // Fallback
      linkInput.select();
      document.execCommand('copy');
      showToast('🔗 邀请链接已复制！', 'success');
    });
  } else {
    showToast('请等待链接加载', 'error');
  }
}

// 复制邀请码（兼容旧函数名）
function copyInviteCode() {
  copyInviteLink();
}

// 分享邀请链接到指定渠道
function shareInviteLinkTo(channel) {
  const link = state.myInviteLink;
  if (!link) {
    showToast('请等待链接加载', 'error');
    return;
  }
  
  const text = '🎮 一句话生成游戏！快来试试吧~';
  let shareUrl = '';
  
  switch(channel) {
    case 'wechat':
      // 微信需要复制链接
      copyInviteLink();
      showToast('链接已复制，请在微信中分享给好友', 'success');
      return;
    case 'qq':
      shareUrl = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(link)}&title=${encodeURIComponent(text)}`;
      break;
    case 'weibo':
      shareUrl = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(link)}&title=${encodeURIComponent(text)}`;
      break;
  }
  
  if (shareUrl) {
    window.open(shareUrl, '_blank', 'width=600,height=400');
  }
}

// 切换邀请链接区域显示
async function toggleInviteSection() {
  const section = document.getElementById('invite-section');
  const isHidden = section.style.display === 'none';
  
  if (isHidden) {
    section.style.display = 'block';
    
    // 加载我的邀请链接
    const linkInput = document.getElementById('my-invite-link');
    if (!state.myInviteLink) {
      linkInput.value = '加载中...';
      const result = await getMyInviteLink();
      if (result && result.link) {
        linkInput.value = result.link;
      } else {
        linkInput.value = '获取失败，请刷新重试';
      }
    } else {
      linkInput.value = state.myInviteLink;
    }
  } else {
    section.style.display = 'none';
  }
}

// 提交使用邀请码（保留兼容，但不再需要）
async function submitInviteCode() {
  showToast('现在使用邀请链接方式，无需输入邀请码', 'info');
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
  
  // 允许多任务生成：只要有积分就可以，不检查 state.isGenerating
  // 用户体验：刷新页面后也可以继续生成
  
  // 确保账号已初始化
  if (!state.account.loaded || !getUserToken()) {
    showToast('账号正在初始化，请稍候...', 'info');
    await initAccount();
    updateAccountIdDisplay();
    return;
  }
  
  // 检查积分
  if (state.credits <= 0 && !state.settings.llmApiKey) {
    showToast('积分不足，请获取更多积分', 'error');
    openCreditsModal();
    return;
  }
  
  // 立即扣除积分并刷新显示（在发起请求前）
  if (state.credits > 0) {
    state.credits--;
    saveCredits();
    updateCreditsDisplay();
    showToast(`💎 消耗1积分，剩余: ${state.credits}`, 'info');
  }
  
  // 如果没有API Key，尝试使用游客模式
  if (!state.settings.llmApiKey) {
    // 检查游客模式是否可用
    if (state.trialInfo && state.trialInfo.enabled && state.trialInfo.userRemaining > 0) {
      state.isGenerating = true;
      state.abortController = new AbortController();
      
      // 初始化后台任务状态
      backgroundTask.isActive = true;
      backgroundTask.isMinimized = false;
      backgroundTask.isCancelled = false;
      backgroundTask.prompt = prompt;
      backgroundTask.result = null;
      
      // 不再禁用按钮，允许多任务生成
      // setGenerateButtonLoading(true);
      
      clearGeneratingLog();
      document.getElementById('generating-overlay').classList.add('active');
      document.body.classList.add('overlay-open');
      startGeneratingTimer(); // 启动计时器
      
      // 保存生成状态，获取草稿ID
      const trialDraftId = await saveGeneratingState();
      log(`草稿ID: ${trialDraftId || '无'}`);
      
      log(`生成游戏: "${prompt}"`);
      updateGeneratingStatus('🎮 AI 正在创作中...');
      
      try {
        const data = await generateWithTrial(trialDraftId);
        
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
  document.body.classList.remove('overlay-open');
          document.getElementById('generating-float').classList.remove('active'); // 关闭浮动提示
          stopGeneratingTimer(); // 停止计时器
          openSaveModal();
        } else {
          document.getElementById('generating-overlay').classList.remove('active');
  document.body.classList.remove('overlay-open');
          document.getElementById('generating-float').classList.remove('active');
          stopGeneratingTimer();
        }
      } catch (error) {
        log('游客模式生成失败: ' + error.message, 'error');
        document.getElementById('generating-overlay').classList.remove('active');
  document.body.classList.remove('overlay-open');
        document.getElementById('generating-float').classList.remove('active');
        stopGeneratingTimer();
      } finally {
        state.isGenerating = false;
        state.abortController = null;
        backgroundTask.isActive = false;
        // 清除保存的生成状态
        clearGeneratingState();
        // setGenerateButtonLoading(false);
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
  
  // 不再禁用按钮，允许多任务生成
  // setGenerateButtonLoading(true);
  
  clearGeneratingLog();
  document.getElementById('generating-overlay').classList.add('active');
  document.body.classList.add('overlay-open');
  
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
    
    const authorToken = getAuthorToken();
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken(),
        'X-Author-Token': authorToken || ''
      },
      body: JSON.stringify({ 
        prompt, 
        llmConfig,
        draftId: trialDraftId  // 传递草稿ID，后端生成完成后会自动更新
      }),
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
  document.body.classList.remove('overlay-open');
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
  document.body.classList.remove('overlay-open');
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
  document.body.classList.remove('overlay-open');
    document.getElementById('generating-float').classList.remove('active');
    stopGeneratingTimer();
  } finally {
    state.isGenerating = false;
    state.abortController = null;
    // setGenerateButtonLoading(false);
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
function updateStatsDisplay(data) {
  const statsBar = document.getElementById('game-stats-bar');
  if (!statsBar) return;
  
  // 显示统计栏
  statsBar.style.display = 'flex';
  
  // 兼容两种数据格式：直接stats对象或嵌套在data.stats中
  const stats = data.stats || data;
  
  // 更新各项数据（兼容不同字段名）
  animateStatValue('stat-plays', stats.playCount || stats.plays || 0);
  animateStatValue('stat-likes', stats.likeCount || stats.likes || 0);
  animateStatValue('stat-shares', stats.shareCount || stats.shares || 0);
  animateStatValue('stat-hot', stats.hotScore || 0);
  
  // 更新点赞按钮状态
  if (stats.hasLiked !== undefined) {
    const statLikeIcon = document.getElementById('stat-like-icon');
    const statLikeBtn = document.getElementById('stat-like-btn');
    if (statLikeIcon) statLikeIcon.textContent = stats.hasLiked ? '❤️' : '🤍';
    if (statLikeBtn) statLikeBtn.classList.toggle('liked', stats.hasLiked);
  }
  
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

// 生成带有分享者信息的游戏链接
function generateShareUrl(gameId) {
  const userToken = getUserToken();
  // 使用用户token的前8位作为分享者标识
  const sharerCode = userToken ? userToken.substring(0, 8) : '';
  let url = `${window.location.origin}/game/${gameId}`;
  if (sharerCode) {
    url += `?sharer=${sharerCode}&from=${gameId}`;
  }
  return url;
}

// 打开分享面板
async function openSharePanel() {
  if (!state.currentGameId) {
    showToast('请先保存游戏', 'error');
    return;
  }

  const modal = document.getElementById('share-modal');

  // 更新分享预览
  const previewEmoji = document.getElementById('share-game-emoji');
  const previewTitle = document.getElementById('share-game-title');
  const previewPlays = document.getElementById('share-play-count');
  const previewLikes = document.getElementById('share-like-count');
  const previewShares = document.getElementById('share-share-count');

  const gameTitle = state.currentGame?.title || '我的游戏';
  if (previewEmoji) previewEmoji.textContent = getGameEmoji(gameTitle);
  if (previewTitle) previewTitle.textContent = gameTitle;
  if (previewPlays) previewPlays.textContent = currentGameStats?.plays || 0;
  if (previewLikes) previewLikes.textContent = currentGameStats?.likes || 0;
  if (previewShares) previewShares.textContent = currentGameStats?.shares || 0;

  // 设置带分享者信息的分享链接（分享后别人访问，分享者+1积分）
  const url = generateShareUrl(state.currentGameId);
  document.getElementById('share-url').value = url;

  // 生成完整分享文案并显示在预览区
  let shareTemplate = '🎮 我用一句话免费做了个游戏《{title}》，太好玩了！你也来试试吧👇\n{url}';
  try {
    const response = await fetch('/api/config/share-text');
    const data = await response.json();
    if (data.success && data.shareConfig && data.shareConfig.template) {
      shareTemplate = data.shareConfig.template + '\n{url}';
    }
  } catch (e) {
    console.error('获取分享文案配置失败:', e);
  }
  const shareText = shareTemplate.replace('{title}', gameTitle).replace('{url}', url);
  const textPreview = document.getElementById('share-text-preview');
  if (textPreview) {
    textPreview.value = shareText;
  }

  modal.classList.add('active');
  document.body.classList.add('modal-open');
}

// 分享到指定渠道
async function shareToChannel(platform) {
  const gameId = state.currentGameId;
  const gameTitle = state.currentGame?.title || '一句话生成的游戏';
  // 使用带分享者信息的链接
  const gameUrl = generateShareUrl(gameId);

  // 获取分享文案配置
  let shareConfig = {
    template: '🎮 我用一句话免费做了个游戏《{title}》，太好玩了！你也来试试吧👇',
    weibo: '🎮 我用一句话免费做了个游戏：{title}，你也来试试吧！#AI游戏# #一句话生成游戏#',
    qq: '一句话生成的AI游戏，快来玩！'
  };
  try {
    const configResponse = await fetch('/api/config/share-text');
    const configData = await configResponse.json();
    if (configData.success && configData.shareConfig) {
      shareConfig = configData.shareConfig;
    }
  } catch (e) {
    console.error('获取分享配置失败:', e);
  }

  // 替换模板变量
  const shareText = shareConfig.template.replace('{title}', gameTitle);
  const weiboText = shareConfig.weibo.replace('{title}', gameTitle);
  const qqDesc = shareConfig.qq.replace('{title}', gameTitle);

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
        showToast(`分享成功！获得 ${data.creditsAwarded} 积分`, 'success');
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
      // 微信需要通过截图分享，复制文字+链接
      const wechatShareText = `${shareText}\n${gameUrl}`;
      copyToClipboard(wechatShareText);
      showToast('分享文案已复制，请粘贴到微信');
      break;

    case 'moments':
      // 朋友圈同样复制文字+链接
      const momentsShareText = `${shareText}\n${gameUrl}`;
      copyToClipboard(momentsShareText);
      showToast('分享文案已复制，请粘贴到朋友圈');
      break;

    case 'weibo':
      const weiboUrl = `http://service.weibo.com/share/share.php?url=${encodeURIComponent(gameUrl)}&title=${encodeURIComponent(weiboText)}`;
      window.open(weiboUrl, '_blank', 'width=600,height=400');
      break;

    case 'qq':
      const qqUrl = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(gameUrl)}&title=${encodeURIComponent(gameTitle)}&desc=${encodeURIComponent(qqDesc)}`;
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
  
  // 页面离开时记录游戏时长和保存生成状态
  window.addEventListener('beforeunload', () => {
    recordPlayEnd();
    // 保存生成状态（如果正在生成中）
    if (state.isGenerating && backgroundTask.isActive) {
      saveGeneratingState();
    }
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
    document.body.classList.add('modal-open');

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
    document.body.classList.remove('modal-open');
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

// =============================================
// 关注系统功能
// =============================================

// 当前查看的用户（用于关注弹窗）
let currentViewingUserToken = null;
let currentFollowTab = 'following';

// 打开关注列表弹窗
// 支持两种调用方式：
// 1. openFollowModal('following') - 只传tab参数
// 2. openFollowModal(userToken, 'following') - 传用户token和tab
async function openFollowModal(userTokenOrTab, tab) {
  // 判断第一个参数是tab还是userToken
  if (userTokenOrTab === 'following' || userTokenOrTab === 'followers') {
    currentFollowTab = userTokenOrTab;
    currentViewingUserToken = getUserToken();
  } else {
    currentViewingUserToken = userTokenOrTab || getUserToken();
    currentFollowTab = tab || 'following';
  }

  const modal = document.getElementById('follow-modal');
  if (!modal) {
    console.error('关注弹窗元素不存在');
    return;
  }

  // 加载关注统计来更新标签计数
  try {
    const statsResponse = await fetch(`/api/users/${currentViewingUserToken}/follow-stats`, {
      headers: { 'X-User-Token': getUserToken() }
    });
    const statsData = await statsResponse.json();
    if (statsData.success) {
      // 兼容两种字段名格式
      const following = statsData.followingCount ?? statsData.following ?? 0;
      const followers = statsData.followerCount ?? statsData.followers ?? 0;

      const followingCountEl = document.getElementById('follow-tab-following-count');
      const followersCountEl = document.getElementById('follow-tab-followers-count');
      if (followingCountEl) followingCountEl.textContent = following;
      if (followersCountEl) followersCountEl.textContent = followers;
    }
  } catch (e) {
    console.error('加载关注统计失败:', e);
  }

  // 显示弹窗
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // 激活对应标签并加载数据
  await switchFollowTab(currentFollowTab);
}

// 关闭关注弹窗
function closeFollowModal() {
  const modal = document.getElementById('follow-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  currentViewingUserToken = null;
}

// 切换关注/粉丝标签
async function switchFollowTab(tab) {
  currentFollowTab = tab;
  
  // 更新标签样式
  const followingBtn = document.getElementById('tab-following-btn');
  const followersBtn = document.getElementById('tab-followers-btn');
  
  if (followingBtn) followingBtn.classList.toggle('active', tab === 'following');
  if (followersBtn) followersBtn.classList.toggle('active', tab === 'followers');
  
  // 更新弹窗标题
  const modalTitle = document.getElementById('follow-modal-title');
  if (modalTitle) {
    modalTitle.textContent = tab === 'following' ? '👥 我的关注' : '🌟 我的粉丝';
  }
  
  // 加载对应列表
  await loadFollowList(tab);
}

// 加载关注/粉丝列表
async function loadFollowList(type) {
  const listContainer = document.getElementById('follow-list');
  if (!listContainer) return;
  
  // 显示加载状态
  listContainer.innerHTML = `
    <div class="follow-loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>
  `;
  
  try {
    const endpoint = type === 'following' 
      ? `/api/users/${currentViewingUserToken}/following`
      : `/api/users/${currentViewingUserToken}/followers`;
    
    const response = await fetch(endpoint, {
      headers: { 'X-User-Token': getUserToken() }
    });
    
    const data = await response.json();
    
    if (data.success && data.users && data.users.length > 0) {
      listContainer.innerHTML = data.users.map(user => `
        <div class="follow-user-item" data-token="${user.token}">
          <div class="follow-user-avatar" onclick="openUserProfile('${user.token}')">
            ${user.avatar || getAvatarEmoji(user.token)}
          </div>
          <div class="follow-user-info" onclick="openUserProfile('${user.token}')">
            <div class="follow-user-name">${user.nickname || '游戏家用户'}</div>
            <div class="follow-user-stats">
              <span>🎮 ${user.games_count || 0} 作品</span>
              <span>👥 ${user.followers_count || 0} 粉丝</span>
            </div>
          </div>
          <button class="follow-action-btn ${user.is_following ? 'following' : ''}"
                  onclick="event.stopPropagation(); toggleFollowUser('${user.token}', this)">
            ${user.is_following ? '已关注' : '关注'}
          </button>
        </div>
      `).join('');
    } else {
      listContainer.innerHTML = `
        <div class="follow-empty">
          <div class="follow-empty-icon">${type === 'following' ? '👤' : '🌟'}</div>
          <div class="follow-empty-text">
            ${type === 'following' ? '还没有关注任何人' : '还没有粉丝'}
          </div>
          ${type === 'followers' ? '<div class="follow-empty-hint">分享你的作品，吸引更多粉丝吧！</div>' : ''}
        </div>
      `;
    }
  } catch (error) {
    console.error('加载关注列表失败:', error);
    listContainer.innerHTML = `
      <div class="follow-empty">
        <div class="follow-empty-icon">😕</div>
        <div class="follow-empty-text">加载失败，请重试</div>
      </div>
    `;
  }
}

// 根据token生成头像emoji
function getAvatarEmoji(token) {
  const emojis = ['🎮', '🎯', '🎪', '🎨', '🎭', '🎲', '🎸', '🎺', '🎻', '🎼', '🎹', '🎤', '🎧', '🎬', '🎰'];
  const index = token ? token.charCodeAt(0) % emojis.length : 0;
  return emojis[index];
}

// 切换关注状态
async function toggleFollowUser(targetToken, buttonElement) {
  if (targetToken === getUserToken()) {
    showToast('不能关注自己哦', 'warning');
    return;
  }
  
  try {
    const response = await fetch(`/api/users/${targetToken}/follow`, {
      method: 'POST',
      headers: { 'X-User-Token': getUserToken() }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 更新按钮状态
      if (buttonElement) {
        buttonElement.classList.toggle('following', data.following);
        buttonElement.textContent = data.following ? '已关注' : '关注';
      }
      
      showToast(data.following ? '关注成功 ✨' : '已取消关注', data.following ? 'success' : 'info');
      
      // 如果在游戏详情页，更新作者关注按钮
      updateAuthorFollowButton(targetToken, data.following);
      
      // 刷新我的页面关注数显示
      loadUserFollowStats();
    } else {
      showToast(data.error || '操作失败', 'error');
    }
  } catch (error) {
    console.error('关注操作失败:', error);
    showToast('网络错误，请重试', 'error');
  }
}

// 更新作者关注按钮（在游戏详情页）
function updateAuthorFollowButton(authorToken, isFollowing) {
  const authorFollowBtn = document.querySelector(`.author-follow-btn[data-token="${authorToken}"]`);
  if (authorFollowBtn) {
    authorFollowBtn.classList.toggle('following', isFollowing);
    authorFollowBtn.textContent = isFollowing ? '已关注' : '+ 关注';
  }
}

// 当前游戏作者的token（用于关注按钮）
let currentGameAuthorToken = null;

// 设置游戏详情页的作者关注按钮（抖音风格，左下角）
async function setupAuthorFollowButton(authorToken, authorName) {
  currentGameAuthorToken = authorToken;
  
  const authorInfo = document.getElementById('tiktok-author-info');
  const authorNameEl = document.getElementById('tiktok-author-name');
  const followBtn = document.getElementById('tiktok-follow-btn');
  
  if (!authorInfo || !followBtn) return;
  
  // 设置作者名称
  if (authorNameEl) {
    authorNameEl.textContent = `@${authorName || '匿名'}`;
  }
  
  const userToken = getUserToken();
  
  // 检查是否启用了调试模式强制显示关注
  const forceShowFollow = localStorage.getItem('aigame-debug-force-follow') === 'true';
  
  // 如果是自己的游戏，添加特殊class隐藏关注按钮（除非调试模式）
  if (authorToken === userToken && !forceShowFollow) {
    authorInfo.classList.add('is-self');
    return;
  }
  
  // 不是自己的游戏，显示关注按钮
  authorInfo.classList.remove('is-self');
  followBtn.setAttribute('data-token', authorToken);
  
  // 检查是否已关注
  if (!authorToken) {
    console.warn('作者token为空');
    return;
  }
  
  try {
    const response = await fetch(`/api/users/${authorToken}/follow-status`, {
      headers: { 'X-User-Token': userToken }
    });
    const data = await response.json();
    
    if (data.success) {
      followBtn.classList.toggle('following', data.following);
      followBtn.innerHTML = data.following 
        ? '✓ 已关注' 
        : '<span class="follow-icon">+</span> 关注';
    }
  } catch (error) {
    console.error('检查关注状态失败:', error);
    followBtn.innerHTML = '<span class="follow-icon">+</span> 关注';
  }
}

// 打开当前游戏作者的主页
function openAuthorProfile() {
  if (!currentGameAuthorToken) {
    showToast('作者信息加载中...', 'warning');
    return;
  }
  openUserProfile(currentGameAuthorToken);
}

// 关注当前游戏的作者
async function followCurrentAuthor() {
  if (!currentGameAuthorToken) {
    showToast('请稍后再试', 'warning');
    return;
  }
  
  const userToken = getUserToken();
  if (currentGameAuthorToken === userToken) {
    showToast('不能关注自己哦', 'warning');
    return;
  }
  
  const followBtn = document.getElementById('tiktok-follow-btn');
  await toggleFollowUser(currentGameAuthorToken, followBtn);
  
  // 更新按钮状态
  if (followBtn) {
    const isFollowing = followBtn.classList.contains('following');
    followBtn.innerHTML = isFollowing 
      ? '✓ 已关注' 
      : '<span class="follow-icon">+</span> 关注';
  }
}

// 加载用户关注统计
async function loadUserFollowStats() {
  const userToken = getUserToken();
  if (!userToken) return;

  try {
    const response = await fetch(`/api/users/${userToken}/follow-stats`, {
      headers: { 'X-User-Token': userToken }
    });

    const data = await response.json();

    if (data.success) {
      // 兼容两种字段名格式
      const following = data.followingCount ?? data.following ?? 0;
      const followers = data.followerCount ?? data.followers ?? 0;

      // 更新我的页面弹窗的关注/粉丝数显示
      const followingCountEl = document.getElementById('followingCount');
      const followersCountEl = document.getElementById('followersCount');

      if (followingCountEl) followingCountEl.textContent = following;
      if (followersCountEl) followersCountEl.textContent = followers;

      // 更新"我的"独立页面的关注/粉丝数显示
      const pageFollowing = document.getElementById('profile-page-following');
      const pageFollowers = document.getElementById('profile-page-followers');

      if (pageFollowing) pageFollowing.textContent = following;
      if (pageFollowers) pageFollowers.textContent = followers;
    }
  } catch (error) {
    console.error('加载关注统计失败:', error);
  }
}

// 关注作者（从游戏详情页）
async function followAuthor(authorToken, buttonElement) {
  await toggleFollowUser(authorToken, buttonElement);
}

// 打开用户主页弹窗
async function openUserProfile(userToken) {
  if (!userToken) return;

  // 如果是自己，跳转到我的页面
  if (userToken === getUserToken()) {
    closeFollowModal();
    switchBottomNav('profile');
    return;
  }

  // 创建用户主页弹窗
  const existingModal = document.getElementById('user-profile-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'user-profile-modal';
  modal.onclick = (e) => { if (e.target === modal) closeUserProfileModal(); };

  modal.innerHTML = `
    <div class="modal-content modal-medium">
      <div class="modal-header">
        <h3>👤 用户主页</h3>
        <button class="btn btn-icon btn-close" onclick="closeUserProfileModal()">×</button>
      </div>
      <div class="modal-body user-profile-body">
        <div class="user-profile-loading">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add('modal-open');

  // 加载用户信息
  try {
    // 并行加载用户信息、关注统计和作品
    const [profileResponse, statsResponse, gamesResponse, followStatusResponse] = await Promise.all([
      fetch(`/api/users/${userToken}/profile`, {
        headers: { 'X-User-Token': getUserToken() }
      }),
      fetch(`/api/users/${userToken}/follow-stats`, {
        headers: { 'X-User-Token': getUserToken() }
      }),
      fetch(`/api/users/${userToken}/games`, {
        headers: { 'X-User-Token': getUserToken() }
      }),
      fetch(`/api/users/${userToken}/follow-status`, {
        headers: { 'X-User-Token': getUserToken() }
      })
    ]);

    const profileData = await profileResponse.json();
    const statsData = await statsResponse.json();
    const gamesData = await gamesResponse.json();
    const followStatusData = await followStatusResponse.json();

    const isFollowing = followStatusData.success && followStatusData.following;
    const following = statsData.followingCount ?? statsData.following ?? 0;
    const followers = statsData.followerCount ?? statsData.followers ?? 0;
    const games = gamesData.success ? gamesData.games || [] : [];

    // 优先使用profile API返回的昵称
    const nickname = profileData.success && profileData.profile?.nickname
      ? profileData.profile.nickname
      : (games.length > 0 ? (games[0].author_name || '游戏家用户') : '游戏家用户');
    const gamesCount = profileData.success ? profileData.profile?.gamesCount : games.length;
    const likesCount = profileData.success ? profileData.profile?.likesCount : 0;

    const modalBody = modal.querySelector('.user-profile-body');
    modalBody.innerHTML = `
      <div class="user-profile-header">
        <div class="user-profile-avatar">${getAvatarEmoji(userToken)}</div>
        <div class="user-profile-info">
          <div class="user-profile-name">${escapeHtml(nickname)}</div>
          <div class="user-profile-stats">
            <span class="user-stat-item" onclick="openFollowModal('${userToken}', 'following')">
              <strong>${following}</strong> 关注
            </span>
            <span class="user-stat-divider">|</span>
            <span class="user-stat-item" onclick="openFollowModal('${userToken}', 'followers')">
              <strong>${followers}</strong> 粉丝
            </span>
            <span class="user-stat-divider">|</span>
            <span class="user-stat-item">
              <strong>${gamesCount}</strong> 作品
            </span>
            <span class="user-stat-divider">|</span>
            <span class="user-stat-item">
              <strong>${likesCount}</strong> 获赞
            </span>
          </div>
        </div>
        <button class="btn ${isFollowing ? 'btn-secondary' : 'btn-primary'} user-profile-follow-btn"
                id="user-profile-follow-btn"
                onclick="toggleFollowFromProfile('${userToken}', this)">
          ${isFollowing ? '已关注' : '+ 关注'}
        </button>
      </div>
      <div class="user-profile-games">
        <h4>🎮 作品 (${games.length})</h4>
        ${games.length > 0 ? `
          <div class="user-games-grid">
            ${games.slice(0, 6).map(game => `
              <div class="user-game-card" onclick="closeUserProfileModal(); openGame('${game.id}')">
                <div class="user-game-emoji">${getGameEmoji(game.title)}</div>
                <div class="user-game-title">${escapeHtml(game.title)}</div>
                <div class="user-game-stats">
                  <span>🎮 ${formatNumber(game.play_count || 0)}</span>
                  <span>❤️ ${formatNumber(game.like_count || 0)}</span>
                </div>
              </div>
            `).join('')}
          </div>
          ${games.length > 6 ? `<p class="user-games-more">还有 ${games.length - 6} 个作品</p>` : ''}
        ` : '<div class="user-games-empty">暂无作品</div>'}
      </div>
    `;
  } catch (error) {
    console.error('加载用户信息失败:', error);
    const modalBody = modal.querySelector('.user-profile-body');
    modalBody.innerHTML = `
      <div class="user-profile-error">
        <div class="error-icon">😕</div>
        <div class="error-text">加载失败，请重试</div>
      </div>
    `;
  }
}

// 关闭用户主页弹窗
function closeUserProfileModal() {
  const modal = document.getElementById('user-profile-modal');
  if (modal) {
    modal.remove();
    // 检查是否还有其他弹窗
    const hasOpenModals = document.querySelector('.modal.active');
    if (!hasOpenModals) {
      document.body.classList.remove('modal-open');
    }
  }
}

// 从用户主页切换关注状态
async function toggleFollowFromProfile(targetToken, buttonElement) {
  await toggleFollowUser(targetToken, buttonElement);

  // 更新按钮样式
  if (buttonElement) {
    const isFollowing = buttonElement.classList.contains('following');
    buttonElement.classList.toggle('btn-primary', !isFollowing);
    buttonElement.classList.toggle('btn-secondary', isFollowing);
    buttonElement.textContent = isFollowing ? '已关注' : '+ 关注';
  }
}

// 点击弹窗背景关闭
document.addEventListener('click', (e) => {
  const modal = document.getElementById('follow-modal');
  if (modal && e.target === modal) {
    closeFollowModal();
  }
});

// 在页面加载时初始化关注统计
document.addEventListener('DOMContentLoaded', () => {
  // 延迟加载关注统计
  setTimeout(loadUserFollowStats, 1000);
});

// =============================================
// 游戏全屏模式功能
// =============================================

let isGameFullscreen = false;

// 切换全屏模式
function toggleFullscreenMode() {
  const gamePage = document.getElementById('game-page');
  if (!gamePage) return;
  
  if (isGameFullscreen) {
    exitFullscreenMode();
  } else {
    enterFullscreenMode();
  }
}

// 进入全屏模式
function enterFullscreenMode() {
  const gamePage = document.getElementById('game-page');
  if (!gamePage) return;
  
  isGameFullscreen = true;
  gamePage.classList.add('game-page-fullscreen');
  
  // 更新全屏按钮图标
  const toggleBtn = document.getElementById('fullscreen-toggle-btn');
  if (toggleBtn) {
    toggleBtn.textContent = '⛶'; // 退出全屏图标
    toggleBtn.title = '退出全屏';
  }
  
  // 隐藏底部导航栏
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.style.display = 'none';
  }
  
  // 尝试请求浏览器全屏
  requestBrowserFullscreen();
  
  // 锁定滚动
  document.body.style.overflow = 'hidden';
  
  console.log('[全屏] 进入全屏模式');
}

// 退出全屏模式
function exitFullscreenMode() {
  const gamePage = document.getElementById('game-page');
  if (!gamePage) return;
  
  isGameFullscreen = false;
  gamePage.classList.remove('game-page-fullscreen');
  
  // 更新全屏按钮图标
  const toggleBtn = document.getElementById('fullscreen-toggle-btn');
  if (toggleBtn) {
    toggleBtn.textContent = '⛶';
    toggleBtn.title = '全屏';
  }
  
  // 恢复底部导航栏
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.style.display = '';
  }
  
  // 退出浏览器全屏
  exitBrowserFullscreen();
  
  // 恢复滚动
  document.body.style.overflow = '';
  
  console.log('[全屏] 退出全屏模式');
}

// 请求浏览器全屏
function requestBrowserFullscreen() {
  const elem = document.documentElement;
  try {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  } catch (e) {
    console.log('[全屏] 浏览器全屏请求失败:', e);
  }
}

// 退出浏览器全屏
function exitBrowserFullscreen() {
  try {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  } catch (e) {
    console.log('[全屏] 退出浏览器全屏失败:', e);
  }
}

// 监听浏览器全屏变化事件
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function handleFullscreenChange() {
  const isFullscreen = document.fullscreenElement || 
                       document.webkitFullscreenElement || 
                       document.mozFullScreenElement || 
                       document.msFullscreenElement;
  
  // 如果浏览器全屏被退出（如按ESC），同步我们的全屏状态
  if (!isFullscreen && isGameFullscreen) {
    exitFullscreenMode();
  }
}

// 监听ESC键退出全屏
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isGameFullscreen) {
    exitFullscreenMode();
  }
});
