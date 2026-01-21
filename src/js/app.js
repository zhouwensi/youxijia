// ==================== 模型配置常量（统一定义） ====================

// 速度等级标签映射
const SPEED_LABELS = {
  'ultra': '极速',
  'fast': '快速',
  'normal': '普通',
  'slow': '较慢',
  'very-slow': '缓慢'
};

// 速度等级详细信息（用于加速弹窗显示）
const SPEED_INFO = {
  'ultra': { label: '极速', icon: '⚡', className: 'speed-ultra' },
  'fast': { label: '快速', icon: '⚡', className: 'speed-fast' },
  'normal': { label: '普通', icon: '🚀', className: 'speed-normal' },
  'slow': { label: '较慢', icon: '🐢', className: 'speed-slow' },
  'very-slow': { label: '缓慢', icon: '🐌', className: 'speed-very-slow' }
};

// 质量等级标签映射
const QUALITY_LABELS = {
  'medium': '标准',
  'high': '高',
  'very-high': '很高',
  'excellent': '极佳'
};

// 获取速度标签
function getSpeedLabelText(speedLevel) {
  return SPEED_LABELS[speedLevel] || SPEED_LABELS['normal'];
}

// 获取速度详细信息（含图标和样式类名）
function getSpeedInfo(speedLevel) {
  return SPEED_INFO[speedLevel] || SPEED_INFO['normal'];
}

// 获取质量标签
function getQualityLabelText(quality) {
  return QUALITY_LABELS[quality] || QUALITY_LABELS['medium'];
}

// ==================== 模型注册表（从后端动态加载） ====================
// 模型列表缓存，从后端 /api/turbo-models 获取
let MODEL_REGISTRY = {};
let modelsLoaded = false;
let serverDefaultModel = 'deepseek-v3';  // 后端配置的默认模型

// 加载模型注册表
async function loadModelRegistry() {
  if (modelsLoaded && Object.keys(MODEL_REGISTRY).length > 0) {
    return MODEL_REGISTRY;
  }
  
  try {
    const response = await fetch('/api/turbo-models');
    const data = await response.json();
    if (data.success && data.models) {
      // 将数组转换为对象格式
      MODEL_REGISTRY = {};
      data.models.forEach(model => {
        MODEL_REGISTRY[model.id] = {
          id: model.id,
          name: model.name,
          creditCost: model.creditCost,
          speedLevel: model.speedLevel,  // 速度等级（ultra/fast/normal/slow/very-slow）
          quality: model.quality,
          hasDefaultKey: model.hasDefaultKey,
          needsUserKey: model.needsUserKey,
          turboRecommended: model.turboRecommended
        };
      });
      
      // 添加自定义选项
      MODEL_REGISTRY['custom'] = {
        id: 'custom',
        name: '自定义接口',
        creditCost: 0,
        needsUserKey: true
      };
      
      // 保存后端默认模型设置
      if (data.defaultModel) {
        serverDefaultModel = data.defaultModel;
        console.log('[INFO] 后端默认模型:', serverDefaultModel);
        
        // 如果用户没有选择过模型，使用后端默认模型
        if (!state.llmModel && (!state.settings.llmProvider || state.settings.llmProvider === 'deepseek-v3')) {
          setUserDefaultModel(serverDefaultModel);
        }
      }
      
      modelsLoaded = true;
      console.log('[INFO] 模型列表已加载:', Object.keys(MODEL_REGISTRY).length, '个模型');
    }
  } catch (error) {
    console.error('加载模型列表失败:', error);
    // 回退到基础配置
    MODEL_REGISTRY = {
      'deepseek-v3': { id: 'deepseek-v3', name: 'DeepSeek V3', creditCost: 0 },
      'custom': { id: 'custom', name: '自定义接口', creditCost: 0, needsUserKey: true }
    };
  }
  
  return MODEL_REGISTRY;
}

// 获取后端默认模型
function getServerDefaultModel() {
  return serverDefaultModel;
}

// 获取用户设置的默认模型（统一入口）
function getUserDefaultModel() {
  return state.llmModel || state.settings.llmProvider || state.settings.llmModelId || serverDefaultModel || 'deepseek-v3';
}

// 设置用户默认模型（统一入口，确保所有属性同步）
function setUserDefaultModel(modelId) {
  state.llmModel = modelId;
  state.settings.llmProvider = modelId;
  state.settings.llmModelId = modelId;
  state.settings.llmModel = modelId;
  
  // 同步更新首页高级设置的模型下拉框（如果存在）
  const advModelSelect = document.getElementById('adv-llm-model');
  if (advModelSelect && advModelSelect.querySelector(`option[value="${modelId}"]`)) {
    advModelSelect.value = modelId;
  }
}

// 获取模型信息
function getModelInfo(modelId) {
  return MODEL_REGISTRY[modelId] || null;
}

// 填充高级设置的模型下拉框
function populateAdvancedModelSelect() {
  const select = document.getElementById('adv-llm-model');
  if (!select) return;
  
  // 清空现有选项
  select.innerHTML = '';
  
  // 获取已保存的模型选择
  const savedModel = getUserDefaultModel();
  
  // 判断用户是否有自己的 Key
  const userHasKey = state.settings.llmApiKey && state.settings.llmApiKey.trim().length > 0;
  
  // 添加 onchange 事件监听，选择需配Key的模型时跳转到设置
  select.onchange = function() {
    const selectedModelId = this.value;
    const modelInfo = MODEL_REGISTRY[selectedModelId];
    
    // 检查当前用户是否有Key（高级设置中的Key或全局设置中的Key）
    const advKeyInput = document.getElementById('adv-llm-key');
    const advKey = advKeyInput?.value?.trim();
    const currentUserHasKey = (advKey && advKey.length > 0) || (state.settings.llmApiKey && state.settings.llmApiKey.trim().length > 0);
    
    // 如果选择了需配Key的模型（后台没Key且用户也没Key）
    if (selectedModelId !== 'custom' && modelInfo && !modelInfo.hasDefaultKey && !currentUserHasKey) {
      // 延迟一点执行，让下拉框先关闭
      setTimeout(() => {
        showToast(`${modelInfo.name} 需要配置 API Key`, 'info');
        openSettings(selectedModelId);
      }, 100);
    }
    
    // 自定义接口也需要配置
    if (selectedModelId === 'custom' && !currentUserHasKey) {
      setTimeout(() => {
        showToast('自定义接口需要配置 API Key', 'info');
        openSettings('custom');
      }, 100);
    }
  };
  
  // 添加模型选项
  Object.keys(MODEL_REGISTRY).forEach(modelId => {
    const model = MODEL_REGISTRY[modelId];
    if (modelId === 'custom') return; // 自定义选项最后添加
    
    const option = document.createElement('option');
    option.value = modelId;
    
    // 构建显示名称
    let displayName = model.name;
    
    // 标记默认模型
    if (modelId === serverDefaultModel) {
      displayName += ' 🌟';
    }
    
    // 添加状态标识
    // 规则：用户有Key=免费，后台有Key=消耗积分，都没有=需配Key
    if (userHasKey) {
      // 用户有自己的Key，所有模型都免费
      displayName += ' 🆓';
    } else if (model.hasDefaultKey) {
      // 后台有Key，显示积分消耗
      if (model.creditCost > 0) {
        displayName += ` (${model.creditCost}积分)`;
      } else {
        displayName += ' 🆓';
      }
    } else {
      // 后台没Key，需要用户配置
      displayName += ' 🔑需配Key';
    }
    
    // 添加速度和质量标识 [速度|质量]
    displayName += ` [${getSpeedLabelText(model.speedLevel)}|${getQualityLabelText(model.quality)}]`;
    
    option.textContent = displayName;
    select.appendChild(option);
  });
  
  // 添加自定义接口选项
  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = '🔧 自定义接口（需配Key）';
  select.appendChild(customOption);
  
  // 恢复选中的值：优先用户保存的，否则用后端默认
  if (savedModel && select.querySelector(`option[value="${savedModel}"]`)) {
    select.value = savedModel;
  } else if (serverDefaultModel && select.querySelector(`option[value="${serverDefaultModel}"]`)) {
    select.value = serverDefaultModel;
  } else if (Object.keys(MODEL_REGISTRY).length > 0) {
    // 如果都不在列表中，选择第一个非custom的模型
    const firstModel = Object.keys(MODEL_REGISTRY).find(id => id !== 'custom');
    if (firstModel) {
      select.value = firstModel;
    }
  }
  
  // 注意：这里不更新默认模型，只是填充下拉框的初始值
  // 用户在高级设置中选择的模型只用于本次生成，不会改变默认设置
  
  console.log('[INFO] 高级设置模型下拉框已填充，当前选择:', select.value);
}

// ==================== 应用状态 ====================
const DEFAULT_CREDITS = 5;  // 初始积分

const state = {
  currentGame: null,
  currentGameId: null,
  recentGamesOffset: 0,
  isGenerating: false,
  abortController: null,
  currentRequestId: null, // 当前生成请求的唯一ID，用于取消功能
  debugMode: false,
  llmModel: 'deepseek-v3', // 默认使用的 LLM 模型
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

/**
 * 格式化积分显示，保留最多1位小数，避免浮点数精度问题
 * @param {number} credits - 积分数值
 * @returns {string} 格式化后的积分字符串
 */
function formatCredits(credits) {
  if (typeof credits !== 'number' || isNaN(credits)) {
    return '0';
  }
  // 使用 Math.round 解决浮点数精度问题，保留1位小数
  const rounded = Math.round(credits * 10) / 10;
  // 如果是整数，不显示小数点
  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }
  return rounded.toFixed(1);
}

/**
 * 获取有效的作者名
 * 优先使用设置的作者名，其次是账号昵称，如果是默认值'游戏玩家'则使用账号ID
 */
function getEffectiveAuthorName() {
  const nickname = state.settings.authorName || state.account.nickname;
  if (nickname && nickname !== '游戏玩家' && nickname !== '') {
    return nickname;
  }
  return state.account.accountId || '匿名';
}

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

      // 账号初始化后，重新加载积分和游客模式信息
      loadCredits();
      loadTrialInfo();

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
      // 刷新游客模式信息
      loadTrialInfo();

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
    updateAccountIdDisplay();
    updateCreditsDisplay();
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
        const authorName = getEffectiveAuthorName();
        
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
          console.log('[DEBUG] 草稿已保存到服务器:', data.id);  // 仅控制台输出，不显示给用户
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

// 草稿状态轮询定时器
let draftPollingTimer = null;
let draftPollingId = null;

// 开始轮询草稿状态（用于页面刷新后检测草稿是否已完成）
function startDraftPolling(draftId) {
  if (draftPollingTimer) {
    clearInterval(draftPollingTimer);
  }
  
  draftPollingId = draftId;
  let pollCount = 0;
  const maxPolls = 60; // 最多轮询60次（约5分钟）
  
  console.log(`[轮询] 开始轮询草稿状态: ${draftId}`);
  
  draftPollingTimer = setInterval(async () => {
    pollCount++;
    
    if (pollCount > maxPolls) {
      console.log('[轮询] 已超过最大轮询次数，停止轮询');
      stopDraftPolling();
      return;
    }
    
    try {
      const response = await fetch(`/api/games/${draftId}`);
      const data = await response.json();
      
      if (data.success && data.game) {
        if (data.game.status !== 'draft') {
          // 草稿已完成！
          console.log('[轮询] 草稿已完成生成！', draftId);
          stopDraftPolling();
          
          // 关闭草稿进度弹窗（如果打开）
          const draftModal = document.getElementById('draft-progress-modal');
          if (draftModal) {
            draftModal.remove();
            document.body.classList.remove('modal-open');
          }
          
          showToast('🎮 游戏生成完成！点击查看', 'success');
          
          // 如果当前在"我的"页面，刷新列表
          if (document.getElementById('profile-page')?.classList.contains('active')) {
            loadProfilePageGames();
          }
          
          // 刷新主页列表（最新标签）
          if (state.mainTab.loaded['recent']) {
            state.mainTab.loaded['recent'] = false;
            if (state.mainTab.current === 'recent') {
              loadTabData('recent');
            }
          }
        }
      }
    } catch (e) {
      console.error('[轮询] 检查草稿状态失败:', e);
    }
  }, 5000); // 每5秒检查一次
}

// 停止轮询草稿状态
function stopDraftPolling() {
  if (draftPollingTimer) {
    clearInterval(draftPollingTimer);
    draftPollingTimer = null;
    draftPollingId = null;
  }
}

// 检查并恢复生成状态（页面刷新后检测未完成的草稿）
function checkAndRestoreGeneratingState() {
  const savedState = localStorage.getItem('aigame-generating-state');
  if (!savedState) return;
  
  try {
    const generatingState = JSON.parse(savedState);
    
    // 清除本地保存的生成状态
    clearGeneratingState();
    
    // 如果有草稿ID，开始轮询检查草稿状态
    if (generatingState.draftId) {
      log('检测到未完成的草稿游戏，开始后台轮询检查状态...', 'info');
      showToast('🎨 有一个游戏正在生成中...', 'info');
      
      // 开始轮询，检测服务端是否已完成生成
      startDraftPolling(generatingState.draftId);
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

// ==================== 封禁状态检查 ====================

// 用户封禁状态缓存
let userBanStatus = { banned: false, type: null, reason: null, expireAt: null };

// 检查用户封禁状态
async function checkUserBanStatus() {
  try {
    const response = await fetch('/api/check-ban', {
      headers: {
        'X-User-Token': state.token || ''
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      userBanStatus = data;
      
      if (data.banned) {
        console.warn('[警告] 当前用户/IP已被封禁:', data);
        // 显示封禁提示（可选：弹窗或顶部横幅）
        showBanWarning(data);
      }
    }
  } catch (e) {
    console.error('[ERROR] 检查封禁状态失败:', e);
  }
}

// 显示封禁警告
function showBanWarning(banData) {
  // 在页面顶部显示封禁警告横幅
  let banner = document.getElementById('ban-warning-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'ban-warning-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      padding: 12px 20px;
      text-align: center;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    document.body.prepend(banner);
    // 调整页面顶部间距
    document.body.style.paddingTop = '48px';
  }
  
  const expireText = banData.expireAt 
    ? `（解封时间：${new Date(banData.expireAt).toLocaleString()}）` 
    : '（永久封禁）';
  
  banner.innerHTML = `
    🚫 您的${banData.type === 'account' ? '账号' : 'IP'}已被封禁，部分功能受限。
    原因：${banData.reason || '违规'}${expireText}
  `;
}

// 检查是否被封禁（供其他函数调用）
function isUserBanned() {
  return userBanStatus.banned;
}

// 获取封禁原因
function getBanReason() {
  return userBanStatus.reason || '账号或IP已被封禁';
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
  
  // 检查封禁状态
  await checkUserBanStatus();
  
  // 账号初始化后再加载积分
  initCredits();
  
  // 处理邀请链接和分享链接参数
  await handleReferralParams();
  
  // 检测URL中的文章推广参数
  checkArticlePromoFromURL();
  
  // 每日登录积分检查
  await checkDailyLoginCredit();
  
  // 加载模型预计生成时间配置
  await loadModelEstimatedTimes();
  
  // 加载模型列表（从后端获取）
  await loadModelRegistry();
  
  // 填充高级设置的模型下拉框
  populateAdvancedModelSelect();
  
  // 加载Tips配置
  await loadTipsConfig();
  
  // 先检查路由，决定显示哪个页面（避免先显示首页再切换的闪烁）
  handleRouting();
  
  // 初始化主标签页数据（如果当前在首页才加载首页数据）
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab');
  if (!initialTab) {
    initMainTabs();  // 只有默认显示首页时才初始化首页数据
  }
  
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
    
    // 防抖标志，避免 touch 和 click 重复触发
    let lastTapTime = 0;
    const TAP_DELAY = 300;
    
    // 统一处理点击逻辑
    function handleBannerTap(e) {
      const now = Date.now();
      // 防止短时间内重复触发
      if (now - lastTapTime < TAP_DELAY) {
        return;
      }
      lastTapTime = now;
      
      // 检查是否点击的是关闭按钮
      if (e.target.classList.contains('beta-close') || e.target.closest('.beta-close')) {
        e.stopPropagation();
        e.preventDefault();
        closeBetaBanner();
        return;
      }
      // 点击其他区域，显示公众号
      showBrandPromo();
    }
    
    // 使用 click 事件，在移动端和桌面端都能可靠工作
    betaBanner.addEventListener('click', handleBannerTap);
    
    // 关闭按钮单独处理，确保更可靠
    const closeBtn = betaBanner.querySelector('.beta-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        closeBetaBanner();
      });
      closeBtn.addEventListener('touchend', function(e) {
        e.stopPropagation();
        e.preventDefault();
        closeBetaBanner();
      }, { passive: false });
    }
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
    // 检查 clipboard API 是否可用（需要HTTPS或localhost）
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(accountId).then(() => {
        showToast('账号已复制到剪贴板');
      }).catch(() => {
        fallbackCopy(accountId);
      });
    } else {
      fallbackCopy(accountId);
    }
  }
}

// 回退复制方案（用于非HTTPS环境）
function fallbackCopy(text) {
  const input = document.createElement('input');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  try {
    document.execCommand('copy');
    showToast('账号已复制到剪贴板');
  } catch (e) {
    showToast('复制失败，请手动复制: ' + text, 'error');
  }
  document.body.removeChild(input);
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
      const data = await response.json();
      state.account.nickname = nickname;
      state.settings.authorName = nickname;
      localStorage.setItem('aigame-author-name', nickname);
      
      // 更新"我的"页面的用户名显示（使用有效作者名函数确保一致性）
      const usernameEl = document.getElementById('profile-page-username');
      if (usernameEl) usernameEl.textContent = getEffectiveAuthorName();
      
      // 刷新"我的作品"列表以显示最新的作者名
      if (typeof loadProfilePageGames === 'function') {
        loadProfilePageGames();
      }
      
      // 刷新首页游戏列表（确保作者名更新）
      if (typeof loadHomeSections === 'function') {
        loadHomeSections();
      }
      
      // 关闭设置弹窗（如果打开）
      const settingsModal = document.getElementById('settings-modal');
      if (settingsModal && settingsModal.classList.contains('active')) {
        closeSettings();
      }
      
      const updatedCount = data.updatedGamesCount || 0;
      showToast(`昵称更新成功${updatedCount > 0 ? '，已同步更新' + updatedCount + '个游戏' : ''}`);
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

// 修改密码
async function changeAccountPassword(oldPassword, newPassword) {
  try {
    const userToken = getUserToken();
    const response = await fetch('/api/account/change-password', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Token': userToken
      },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      showToast('密码修改成功');
      return true;
    } else {
      showToast(data.error || '密码修改失败', 'error');
      return false;
    }
  } catch (error) {
    showToast('网络错误', 'error');
    return false;
  }
}

// 显示设置/修改密码对话框
function showChangePasswordDialog() {
  // 移除旧的对话框（如果有）
  const oldDialog = document.getElementById('change-password-dialog');
  if (oldDialog) oldDialog.remove();
  
  const hasPassword = state.account.hasPassword;
  const title = hasPassword ? '🔐 修改密码' : '🔐 设置密码';
  const submitText = hasPassword ? '确认修改' : '设置密码';
  const submitFunc = hasPassword ? 'submitChangePassword()' : 'submitSetPassword()';
  
  // 根据是否已有密码显示不同的表单
  const oldPasswordField = hasPassword ? `
        <div class="form-group">
          <label>原密码</label>
          <div class="input-with-toggle">
            <input type="password" id="change-pwd-old" placeholder="请输入原密码">
            <button class="btn-toggle-pwd" onclick="togglePasswordVisibility('change-pwd-old', this)">👁️</button>
          </div>
        </div>` : '';
  
  const dialog = document.createElement('div');
  dialog.className = 'modal active';
  dialog.id = 'change-password-dialog';
  dialog.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="btn btn-icon btn-close" onclick="closeChangePasswordDialog()">×</button>
      </div>
      <div class="modal-body">
        ${oldPasswordField}
        <div class="form-group">
          <label>${hasPassword ? '新密码' : '密码'}</label>
          <div class="input-with-toggle">
            <input type="password" id="change-pwd-new" placeholder="请输入${hasPassword ? '新' : ''}密码（至少6位）">
            <button class="btn-toggle-pwd" onclick="togglePasswordVisibility('change-pwd-new', this)">👁️</button>
          </div>
        </div>
        <div class="form-group">
          <label>确认密码</label>
          <div class="input-with-toggle">
            <input type="password" id="change-pwd-confirm" placeholder="请再次输入密码">
            <button class="btn-toggle-pwd" onclick="togglePasswordVisibility('change-pwd-confirm', this)">👁️</button>
          </div>
        </div>
        ${!hasPassword ? '<p class="form-hint" style="margin-bottom: 1rem;">💡 设置密码后，换设备登录时需要输入密码验证身份</p>' : ''}
        <button class="btn btn-primary btn-block" onclick="${submitFunc}">${submitText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  
  // 聚焦到第一个输入框
  setTimeout(() => {
    const firstInput = hasPassword ? 'change-pwd-old' : 'change-pwd-new';
    document.getElementById(firstInput)?.focus();
  }, 100);
}

// 切换密码可见性
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input) {
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🔒';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  }
}

// 关闭修改密码对话框
function closeChangePasswordDialog() {
  const dialog = document.getElementById('change-password-dialog');
  if (dialog) {
    dialog.classList.remove('active');
    setTimeout(() => dialog.remove(), 300);
  }
}

// 提交修改密码
async function submitChangePassword() {
  const oldPassword = document.getElementById('change-pwd-old')?.value?.trim();
  const newPassword = document.getElementById('change-pwd-new')?.value?.trim();
  const confirmPassword = document.getElementById('change-pwd-confirm')?.value?.trim();
  
  if (!oldPassword) {
    showToast('请输入原密码', 'error');
    return;
  }
  
  if (!newPassword) {
    showToast('请输入新密码', 'error');
    return;
  }
  
  if (newPassword.length < 6) {
    showToast('新密码至少6位', 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showToast('两次输入的新密码不一致', 'error');
    return;
  }
  
  if (oldPassword === newPassword) {
    showToast('新密码不能与原密码相同', 'error');
    return;
  }
  
  const success = await changeAccountPassword(oldPassword, newPassword);
  if (success) {
    closeChangePasswordDialog();
  }
}

// 提交设置密码（首次设置）
async function submitSetPassword() {
  const newPassword = document.getElementById('change-pwd-new')?.value?.trim();
  const confirmPassword = document.getElementById('change-pwd-confirm')?.value?.trim();
  
  if (!newPassword) {
    showToast('请输入密码', 'error');
    return;
  }
  
  if (newPassword.length < 6) {
    showToast('密码至少6位', 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showToast('两次输入的密码不一致', 'error');
    return;
  }
  
  const success = await setAccountPassword(newPassword);
  if (success) {
    closeChangePasswordDialog();
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
      // 更新我的页面昵称显示（使用有效作者名函数确保一致性）
      const usernameEl = document.getElementById('profile-page-username');
      if (usernameEl) usernameEl.textContent = getEffectiveAuthorName();

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
  // 首次生成免费
  if (state.isFirstGeneration) {
    return { canGenerate: true, isFree: true, message: '首次生成免费！' };
  }

  if (state.credits > 0) {
    return { canGenerate: true, isFree: false, message: `将消耗 1 积分，当前剩余 ${formatCredits(state.credits)} 积分` };
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
    // 检查URL参数中是否指定了tab或edit
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const editGameId = urlParams.get('edit');
    
    // 如果有edit参数，打开游戏编辑器
    if (editGameId) {
      // 清除URL中的edit参数
      history.replaceState(null, '', '/');
      // 隐藏所有页面，避免闪烁
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('bottom-nav').style.display = 'none';
      // 延迟打开编辑器，确保页面加载完成
      setTimeout(() => {
        openGameEditor(editGameId);
      }, 100);
      return;
    }
    
    if (tab === 'profile' || tab === 'create') {
      // 立即隐藏首页，避免闪烁
      const homePage = document.getElementById('home-page');
      if (homePage) homePage.classList.remove('active');
      
      // 直接切换到对应标签页
      directSwitchToTab(tab);
      // 清除URL中的tab参数，保持干净的URL
      history.replaceState(null, '', '/');
    } else {
      showHome();
    }
  }
}

// 直接切换到指定标签页（无动画，用于页面初始加载时）
function directSwitchToTab(tabName) {
  // 更新导航样式
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.nav === tabName);
  });
  
  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  // 显示对应页面
  const settingsBtn = document.getElementById('profile-settings-btn');
  
  if (tabName === 'home') {
    document.getElementById('home-page').classList.add('active');
    if (settingsBtn) settingsBtn.classList.remove('visible');
  } else if (tabName === 'create') {
    document.getElementById('create-page').classList.add('active');
    // 更新积分显示
    const creditsEl = document.getElementById('create-credits-count');
    if (creditsEl) creditsEl.textContent = formatCredits(state.credits || 0);
    // 更新当前模型显示
    updateCreateModelDisplay();
    // 初始化Tips滚动
    initCreateTips();
    if (settingsBtn) settingsBtn.classList.remove('visible');
  } else if (tabName === 'profile') {
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

// 显示首页（或返回上一层级）
function showHome() {
  // 如果在全屏模式，先退出
  if (isGameFullscreen) {
    exitFullscreenMode();
  }
  
  // 隐藏游戏页面
  document.getElementById('game-page').classList.remove('active');
  document.body.classList.remove('fullscreen');
  
  // 如果列表页面是打开的，返回列表页面
  const listPage = document.getElementById('game-list-page');
  if (listPage && listPage.classList.contains('active')) {
    // 列表页面已打开，保持在列表页面
    document.getElementById('bottom-nav').style.display = 'none';
    return;
  }
  
  // 否则返回首页
  document.getElementById('home-page').classList.add('active');
  // 显示底部导航
  document.getElementById('bottom-nav').style.display = 'flex';
  // 只在当前不是首页时才更新URL
  if (window.location.pathname !== '/') {
    history.pushState(null, '', '/');
  }
}

// ==================== 首页分类展示 ====================

// 首页每个分类显示的游戏数量（3行2列=6个）
const HOME_SECTION_LIMIT = 6;

// 加载首页所有分类数据
async function loadHomeSections() {
  const sections = ['recent', 'featured', 'hot', 'likes', 'favorites', 'comments'];
  
  // 并行加载所有分类
  await Promise.all(sections.map(section => loadHomeSection(section)));
}

// 加载单个分类数据
async function loadHomeSection(sectionName) {
  const list = document.getElementById(`list-${sectionName}`);
  if (!list) return;
  
  list.innerHTML = '<div class="list-loading"><div class="loading-spinner-small"></div><span>加载中...</span></div>';
  
  try {
    // 根据分类类型构建API请求，只请求6个
    let apiUrl;
    switch(sectionName) {
      case 'recent':
        apiUrl = `/api/games?sort=newest&limit=${HOME_SECTION_LIMIT}&offset=0`;
        break;
      case 'hot':
        apiUrl = `/api/leaderboard/hot?limit=${HOME_SECTION_LIMIT}&offset=0`;
        break;
      case 'likes':
        apiUrl = `/api/leaderboard/likes?limit=${HOME_SECTION_LIMIT}&offset=0`;
        break;
      case 'favorites':
        apiUrl = `/api/leaderboard/favorites?limit=${HOME_SECTION_LIMIT}&offset=0`;
        break;
      case 'featured':
        apiUrl = `/api/games/featured?limit=${HOME_SECTION_LIMIT}&offset=0`;
        break;
      case 'comments':
        apiUrl = `/api/leaderboard/comments?limit=${HOME_SECTION_LIMIT}&offset=0`;
        break;
      default:
        apiUrl = `/api/games?sort=newest&limit=${HOME_SECTION_LIMIT}&offset=0`;
    }
    
    const res = await fetch(apiUrl);
    const data = await res.json();
    
    if (data.success && data.games && data.games.length > 0) {
      renderHomeGameList(list, data.games);
    } else {
      list.innerHTML = '<div class="list-empty"><div class="list-empty-icon">📭</div><p>暂无数据</p></div>';
    }
  } catch (error) {
    console.error(`加载${sectionName}列表失败:`, error);
    list.innerHTML = '<div class="list-empty"><div class="list-empty-icon">😢</div><p>加载失败</p></div>';
  }
}

// 渲染首页游戏列表（紧凑卡片式，3行2列）
function renderHomeGameList(container, games) {
  container.innerHTML = '';
  
  games.forEach((game) => {
    const card = document.createElement('div');
    card.className = 'game-card-home';
    card.onclick = () => openGame(game.id);
    
    // 提取游戏标题中的 emoji 作为图标
    const titleEmoji = extractEmoji(game.title) || '🎮';
    
    card.innerHTML = `
      <div class="game-card-icon">${titleEmoji}</div>
      <div class="game-card-info">
        <div class="game-card-name">${escapeHtml(game.title)}</div>
        <div class="game-card-author">👤 ${escapeHtml(game.author_name || '匿名')}</div>
        <div class="game-card-stats">
          <span>🎮 ${game.play_count || 0}</span>
          <span>❤️ ${game.like_count || 0}</span>
          <span>💬 ${game.comment_count || 0}</span>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// 兼容旧版调用
function switchMainTab(tabName) {
  // 新版首页不需要切换，直接跳转到更多页面
  showMoreGames(tabName);
}

// 兼容旧版调用
async function loadTabData(tabName, append = false) {
  // 新版首页使用 loadHomeSection
  if (!append) {
    await loadHomeSection(tabName);
  }
}

// 渲染游戏列表（用于弹窗等场景）
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
            <span>💬 ${game.comment_count || 0}</span>
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

// 初始化首页分类
function initMainTabs() {
  // 初始化下拉刷新
  initPullToRefresh('home-page', 'pull-refresh-indicator', async () => {
    // 刷新所有分类
    await loadHomeSections();
  });

  // 加载首页所有分类
  loadHomeSections();
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
    if (creditsEl) creditsEl.textContent = formatCredits(state.credits || 0);
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
  
  const modelId = getUserDefaultModel();
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

// 切换高级设置面板
function toggleAdvancedSettings() {
  const panel = document.getElementById('advanced-settings-panel');
  const btn = document.querySelector('.btn-advanced-toggle');
  
  if (panel && btn) {
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    btn.classList.toggle('active', isHidden);
  }
}

// 切换高级设置中的LLM部分
function toggleAdvancedLLM() {
  const content = document.getElementById('advanced-llm-content');
  const header = document.querySelector('.llm-section-header');
  
  if (content && header) {
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    header.classList.toggle('active', isHidden);
  }
}

// 获取高级设置参数
function getAdvancedSettings() {
  const panel = document.getElementById('advanced-settings-panel');
  if (!panel || panel.style.display === 'none') {
    return null; // 未启用高级设置
  }
  
  const settings = {
    gameName: document.getElementById('adv-game-name')?.value?.trim() || '',
    gameType: document.getElementById('adv-game-type')?.value || 'auto',
    artStyle: document.getElementById('adv-art-style')?.value || 'auto',
    orientation: document.getElementById('adv-orientation')?.value || 'auto',
    platform: document.getElementById('adv-platform')?.value || 'all',
    difficulty: document.getElementById('adv-difficulty')?.value || 'medium',
    soundEffect: document.getElementById('adv-sound')?.value || 'none',
    visibility: document.getElementById('adv-visibility')?.value || 'public'
  };
  
  // 检查LLM覆盖设置
  const llmContent = document.getElementById('advanced-llm-content');
  if (llmContent && llmContent.style.display !== 'none') {
    const overrideModel = document.getElementById('adv-llm-model')?.value?.trim();
    const overrideKey = document.getElementById('adv-llm-key')?.value?.trim();
    const overrideUrl = document.getElementById('adv-llm-url')?.value?.trim();
    
    if (overrideModel || overrideKey || overrideUrl) {
      settings.llmOverride = {
        model: overrideModel || null,
        apiKey: overrideKey || null,
        apiUrl: overrideUrl || null
      };
    }
  }
  
  return settings;
}

// 重置高级设置
function resetAdvancedSettings() {
  document.getElementById('adv-game-name').value = '';
  document.getElementById('adv-game-type').value = 'auto';
  document.getElementById('adv-art-style').value = 'auto';
  document.getElementById('adv-orientation').value = 'auto';
  document.getElementById('adv-platform').value = 'all';
  document.getElementById('adv-difficulty').value = 'medium';
  document.getElementById('adv-sound').value = 'none';
  document.getElementById('adv-visibility').value = 'public';
  document.getElementById('adv-llm-model').value = '';
  document.getElementById('adv-llm-key').value = '';
  document.getElementById('adv-llm-url').value = '';
  
  // 隐藏LLM内容区
  const llmContent = document.getElementById('advanced-llm-content');
  const llmHeader = document.querySelector('.llm-section-header');
  if (llmContent) llmContent.style.display = 'none';
  if (llmHeader) llmHeader.classList.remove('active');
}

// 从创作页面生成游戏
function generateFromCreatePage() {
  const input = document.getElementById('create-page-input');
  const mainInput = document.getElementById('prompt-input');
  
  if (input && mainInput) {
    mainInput.value = input.value;
  }
  
  // 收集高级设置
  const advancedSettings = getAdvancedSettings();
  
  generateGame(advancedSettings);
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
  if (creditsEl) creditsEl.textContent = formatCredits(state.credits || 0);

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
  loadProfilePageComments();
}


// ==================== 游戏列表页面 ====================

// 当前列表页面状态
let currentListCategory = '';
let currentListApiUrl = '';
let currentListHeaders = {};
let currentListIsMyGames = false;
let currentListOffset = 0;
const LIST_PAGE_LIMIT = 20;

// 显示更多游戏（打开独立列表页面）
function showMoreGames(category) {
  // 首页分类跳转到 games.html 页面
  const homeCategoryMap = {
    'recent': 'newest',
    'featured': 'recommended',
    'hot': 'hot',
    'likes': 'likes',
    'favorites': 'favorites',
    'comments': 'comments'
  };
  
  if (homeCategoryMap[category]) {
    window.location.href = `games.html?sort=${homeCategoryMap[category]}`;
    return;
  }
  
  // 个人页面分类也跳转到 games.html 页面，使用 source 参数
  const mySourceMap = {
    'my-games': 'my-games',
    'my-likes': 'my-likes',
    'my-favs': 'my-favorites'
  };
  
  if (mySourceMap[category]) {
    window.location.href = `games.html?source=${mySourceMap[category]}`;
    return;
  }
}

// 打开游戏列表页面
async function openGameListPage(title, apiUrl, headers, isMyGames, category) {
  // 保存当前状态
  currentListCategory = category;
  currentListApiUrl = apiUrl;
  currentListHeaders = headers;
  currentListIsMyGames = isMyGames;
  currentListOffset = 0;
  
  // 设置标题
  document.getElementById('list-page-title').textContent = title;
  
  // 显示页面
  const listPage = document.getElementById('game-list-page');
  listPage.classList.add('active');
  document.getElementById('bottom-nav').style.display = 'none';
  
  // 初始化下拉刷新
  initListPagePullRefresh();
  
  // 初始化滚动监听（回到顶部按钮）
  initListScrollListener();
  
  // 加载数据
  await loadGameListData(true);
}

// 列表是否还有更多数据
let listHasMore = true;
let listIsLoading = false;

// 加载游戏列表数据
async function loadGameListData(isRefresh = false) {
  const grid = document.getElementById('game-list-grid');
  const loadingMore = document.getElementById('list-loading-more');
  const noMore = document.getElementById('list-no-more');
  
  if (listIsLoading) return;
  listIsLoading = true;
  
  if (isRefresh) {
    currentListOffset = 0;
    listHasMore = true;
    grid.innerHTML = '<div class="loading-games">加载中...</div>';
    if (noMore) noMore.style.display = 'none';
  } else {
    if (loadingMore) loadingMore.style.display = 'flex';
  }
  
  try {
    const separator = currentListApiUrl.includes('?') ? '&' : '?';
    const url = `${currentListApiUrl}${separator}limit=${LIST_PAGE_LIMIT}&offset=${currentListOffset}`;
    const response = await fetch(url, { headers: currentListHeaders });
    const data = await response.json();
    
    if (data.success && data.games && data.games.length > 0) {
      const cardsHtml = data.games.map(game => renderListGameCard(game, currentListIsMyGames)).join('');
      
      if (isRefresh) {
        grid.innerHTML = cardsHtml;
      } else {
        grid.insertAdjacentHTML('beforeend', cardsHtml);
      }
      
      // 初始化长按事件（仅我的作品）
      if (currentListIsMyGames) {
        initLongPressMenu(grid);
      }
      
      currentListOffset += data.games.length;
      listHasMore = data.games.length >= LIST_PAGE_LIMIT;
      
      // 如果没有更多了，显示提示
      if (!listHasMore && noMore) {
        noMore.style.display = 'block';
      }
    } else {
      if (isRefresh) {
        grid.innerHTML = '<div class="empty-games">暂无内容</div>';
      }
      listHasMore = false;
      if (noMore) noMore.style.display = 'block';
    }
  } catch(e) {
    console.error('加载游戏列表失败:', e);
    if (isRefresh) {
      grid.innerHTML = '<div class="error-games">加载失败，下拉刷新重试</div>';
    }
  } finally {
    listIsLoading = false;
    if (loadingMore) loadingMore.style.display = 'none';
  }
}

// 渲染列表页面的游戏卡片（统一每行2个）
function renderListGameCard(game, isMyGames = false) {
  const emoji = getGameEmoji(game.title);
  const plays = game.plays || game.play_count || 0;
  const likes = game.likes || game.like_count || 0;
  const comments = game.comment_count || 0;
  const isPrivate = game.visibility === 'private';
  
  // 长按数据属性（仅我的作品）
  const longPressData = isMyGames ? `data-game-id="${game.id}" data-game-title="${escapeHtml(game.title)}" data-game-visibility="${game.visibility || 'public'}"` : '';
  
  return `
    <div class="list-game-card ${isPrivate ? 'private-card' : ''}" 
         onclick="openGame('${game.id}')" ${longPressData}>
      ${isPrivate ? '<div class="private-badge">🔒</div>' : ''}
      <div class="list-card-cover">${emoji}</div>
      <div class="list-card-info">
        <div class="list-card-title">${escapeHtml(game.title)}</div>
        <div class="list-card-stats">
          <span>🎮 ${formatNumber(plays)}</span>
          <span>❤️ ${formatNumber(likes)}</span>
          <span>💬 ${formatNumber(comments)}</span>
        </div>
        ${!isMyGames && game.author_name ? `<div class="list-card-author">👤 ${escapeHtml(game.author_name)}</div>` : ''}
      </div>
    </div>
  `;
}

// 加载更多列表游戏
function loadMoreListGames() {
  loadGameListData(false);
}

// 关闭游戏列表页面
function closeGameListPage() {
  const listPage = document.getElementById('game-list-page');
  listPage.classList.remove('active');
  document.getElementById('bottom-nav').style.display = '';
  
  // 刷新对应的数据
  if (currentListCategory.startsWith('my-')) {
    loadProfilePageData();
  }
}

// 初始化列表页面下拉刷新（简化版：直接拉到顶再下拉时刷新）
function initListPagePullRefresh() {
  const content = document.getElementById('list-page-content');
  if (!content) return;
  
  // 避免重复绑定
  if (content.dataset.pullRefreshInitialized) return;
  content.dataset.pullRefreshInitialized = 'true';
  
  let startY = 0;
  let isPulling = false;
  let pullDistance = 0;
  const PULL_THRESHOLD = 60;
  
  content.addEventListener('touchstart', (e) => {
    if (content.scrollTop <= 0) {
      startY = e.touches[0].pageY;
      isPulling = true;
      pullDistance = 0;
    }
  }, { passive: true });
  
  content.addEventListener('touchmove', (e) => {
    if (!isPulling || content.scrollTop > 0) return;
    
    const currentY = e.touches[0].pageY;
    pullDistance = currentY - startY;
    
    if (pullDistance > 0) {
      // 视觉反馈：稍微偏移内容
      content.style.transform = `translateY(${Math.min(pullDistance * 0.4, 50)}px)`;
    }
  }, { passive: true });
  
  content.addEventListener('touchend', async () => {
    if (!isPulling) return;
    isPulling = false;
    
    // 复位
    content.style.transform = '';
    content.style.transition = 'transform 0.2s ease';
    setTimeout(() => { content.style.transition = ''; }, 200);
    
    // 检查是否达到刷新阈值
    if (pullDistance > PULL_THRESHOLD) {
      showToast('刷新中...', 'info');
      await loadGameListData(true);
      showToast('刷新完成', 'success');
    }
    
    pullDistance = 0;
  });
}

// 初始化列表滚动监听（含自动加载更多）
function initListScrollListener() {
  const content = document.getElementById('list-page-content');
  const scrollTopBtn = document.getElementById('list-scroll-top-btn');
  
  if (!content || !scrollTopBtn) return;
  
  // 避免重复绑定
  if (content.dataset.scrollInitialized) return;
  content.dataset.scrollInitialized = 'true';
  
  content.addEventListener('scroll', () => {
    // 显示/隐藏回到顶部按钮
    if (content.scrollTop > 300) {
      scrollTopBtn.classList.add('visible');
    } else {
      scrollTopBtn.classList.remove('visible');
    }
    
    // 自动加载更多：距离底部 100px 时触发
    const scrollHeight = content.scrollHeight;
    const clientHeight = content.clientHeight;
    const scrollTop = content.scrollTop;
    
    if (scrollHeight - scrollTop - clientHeight < 100) {
      if (listHasMore && !listIsLoading) {
        loadGameListData(false);
      }
    }
  });
}

// 滚动到列表顶部
function scrollListToTop() {
  const content = document.getElementById('list-page-content');
  if (content) {
    content.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// 兼容旧的关闭函数
function closeFullGameList() {
  closeGameListPage();
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
      // 只显示前N个
      const displayGames = data.games.slice(0, DISPLAY_LIMIT);
      container.innerHTML = displayGames.map(game => renderHorizontalCard(game, true)).join('');
      // 超过N个显示更多按钮
      if (moreBtn) moreBtn.style.display = total > DISPLAY_LIMIT ? 'inline-flex' : 'none';
      // 初始化长按事件
      initLongPressMenu(container);
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
  const commentCount = formatNumber(game.comment_count || 0);
  const author = type === 'works' ? '' : `<span>👤 ${escapeHtml(game.author_name || '匿名')}</span>`;
  
  return `
    <div class="tiktok-card" onclick="openGame('${game.id}')">
      <div class="tiktok-card-cover">${emoji}</div>
      <div class="tiktok-card-overlay">
        <div class="tiktok-card-title">${escapeHtml(game.title)}</div>
        <div class="tiktok-card-stats">
          <span>▶️ ${playCount}</span>
          <span>❤️ ${likeCount}</span>
          <span>💬 ${commentCount}</span>
          ${author}
        </div>
      </div>
    </div>
  `;
}

// 渲染横向小卡片（用于我的页面）- 带统计数据和长按菜单
function renderHorizontalCard(game, enableLongPress = true) {
  const emoji = getGameEmoji(game.title);
  const plays = game.plays || game.play_count || 0;
  const likes = game.likes || game.like_count || 0;
  const isDraft = game.status === 'draft';
  const isPrivate = game.visibility === 'private';
  
  // 草稿点击处理方式不同
  const clickHandler = isDraft ? `handleDraftClick('${game.id}', '${escapeHtml(game.title || game.prompt)}')` : `openGame('${game.id}')`;
  
  // 长按事件数据（非草稿才支持长按操作）
  const longPressData = (!isDraft && enableLongPress) ? `data-game-id="${game.id}" data-game-title="${escapeHtml(game.title)}" data-game-visibility="${game.visibility || 'public'}"` : '';

  return `
    <div class="profile-game-card-h ${isDraft ? 'draft-card' : ''} ${isPrivate ? 'private-card' : ''}" 
         onclick="${clickHandler}" ${longPressData}>
      ${isDraft ? '<div class="draft-badge"><span class="draft-spinner"></span>生成中</div>' : ''}
      ${isPrivate ? '<div class="private-badge">🔒</div>' : ''}
      <div class="card-cover">${isDraft ? '🎨' : emoji}</div>
      <div class="card-title">${escapeHtml(game.title)}</div>
      ${isDraft ? `
        <div class="card-draft-status">
          <span class="draft-dots">正在生成<span class="dots"></span></span>
        </div>
      ` : `
        <div class="card-stats">
          <span class="card-stat">
            <span class="stat-icon">🎮</span>
            <span>${formatNumber(plays)}</span>
          </span>
          <span class="card-stat">
            <span class="stat-icon">❤️</span>
            <span>${formatNumber(likes)}</span>
          </span>
          <span class="card-stat">
            <span class="stat-icon">💬</span>
            <span>${formatNumber(game.comment_count || 0)}</span>
          </span>
        </div>
      `}
    </div>
  `;
}

// 处理草稿点击事件
function handleDraftClick(draftId, title) {
  // 显示生成中提示弹窗
  showDraftInProgressModal(draftId, title);
}

// 显示草稿生成中弹窗
function showDraftInProgressModal(draftId, title) {
  // 移除旧弹窗
  const oldModal = document.getElementById('draft-progress-modal');
  if (oldModal) oldModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'draft-progress-modal';
  modal.className = 'modal active';
  modal.onclick = (e) => { if (e.target === modal) closeDraftProgressModal(); };
  
  modal.innerHTML = `
    <div class="modal-content modal-small" style="text-align: center;">
      <div class="modal-header">
        <h3>🎨 游戏生成中</h3>
        <button class="btn btn-icon btn-close" onclick="closeDraftProgressModal()">×</button>
      </div>
      <div class="modal-body">
        <div style="font-size: 48px; margin-bottom: 16px; animation: pulse 2s infinite;">🎮</div>
        <div style="font-size: 1rem; color: var(--text-primary); margin-bottom: 8px; word-break: break-all;">
          "${title}"
        </div>
        <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 20px;">
          AI 正在努力创作这个游戏，请稍等...
        </div>
        <div class="draft-progress-loader" style="margin: 20px auto;">
          <div class="progress-spinner"></div>
        </div>
        <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 16px;">
          💡 生成完成后会自动通知您，也可稍后刷新页面查看
        </p>
      </div>
      <div class="modal-footer" style="justify-content: center; gap: 12px;">
        <button class="btn btn-secondary" onclick="closeDraftProgressModal()">知道了</button>
        <button class="btn btn-danger-outline" onclick="confirmDeleteDraft('${draftId}')">取消生成</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  
  // 如果还没有轮询这个草稿，开始轮询
  if (draftPollingId !== draftId) {
    startDraftPolling(draftId);
  }
}

// 关闭草稿进度弹窗
function closeDraftProgressModal() {
  const modal = document.getElementById('draft-progress-modal');
  if (modal) {
    modal.remove();
  }
  document.body.classList.remove('modal-open');
}

// 确认删除草稿
function confirmDeleteDraft(draftId) {
  if (confirm('确定要取消生成吗？这将删除该草稿。')) {
    deleteDraft(draftId);
  }
}

// 删除草稿
async function deleteDraft(draftId) {
  try {
    const response = await fetch(`/api/games/${draftId}`, {
      method: 'DELETE',
      headers: { 'X-Author-Token': getAuthorToken() }
    });
    
    const data = await response.json();
    if (data.success) {
      showToast('已取消生成', 'success');
      // 关闭弹窗
      const modal = document.getElementById('draft-progress-modal');
      if (modal) modal.remove();
      document.body.classList.remove('modal-open');
      // 停止轮询
      if (draftPollingId === draftId) {
        stopDraftPolling();
      }
      // 刷新列表
      loadProfilePageGames();
    } else {
      showToast(data.error || '删除失败', 'error');
    }
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
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

// 加载我的评论（竖向列表）
async function loadProfilePageComments() {
  const container = document.getElementById('profile-comments-list');
  const moreBtn = document.getElementById('profile-comments-more');
  const DISPLAY_LIMIT = 5; // 显示5条评论
  if (!container) return;
  
  container.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const response = await fetch('/api/my-comments', {
      headers: { 'X-User-Token': getUserToken() }
    });
    const data = await response.json();
    
    if (data.success && data.comments && data.comments.length > 0) {
      const total = data.comments.length;
      const sectionCount = document.getElementById('section-count-comments');
      if (sectionCount) sectionCount.textContent = total;
      const displayComments = data.comments.slice(0, DISPLAY_LIMIT);
      container.innerHTML = displayComments.map(comment => renderMyCommentCard(comment)).join('');
      if (moreBtn) moreBtn.style.display = total > DISPLAY_LIMIT ? 'inline-flex' : 'none';
    } else {
      container.innerHTML = '<div class="empty-games">还没有发表评论</div>';
      const sectionCount = document.getElementById('section-count-comments');
      if (sectionCount) sectionCount.textContent = '0';
      if (moreBtn) moreBtn.style.display = 'none';
    }
  } catch (e) {
    console.error('加载评论列表失败:', e);
    container.innerHTML = '<div class="error-games">加载失败</div>';
  }
}

// 渲染我的评论卡片
function renderMyCommentCard(comment) {
  const date = new Date(comment.created_at).toLocaleDateString('zh-CN');
  const statusClass = comment.is_hidden ? 'comment-hidden' : '';
  const statusText = comment.is_hidden ? '🔒 已隐藏' : '🌐 公开';
  const toggleBtnText = comment.is_hidden ? '公开' : '隐藏';
  
  return `
    <div class="my-comment-card ${statusClass}" data-comment-id="${comment.id}">
      <div class="my-comment-header">
        <span class="my-comment-game" onclick="openGame(${comment.game_id})">${escapeHtml(comment.game_title || '游戏')}</span>
        <span class="my-comment-status">${statusText}</span>
      </div>
      <div class="my-comment-content">${escapeHtml(comment.content)}</div>
      <div class="my-comment-footer">
        <span class="my-comment-date">${date}</span>
        <div class="my-comment-actions">
          <button class="btn-comment-action" onclick="toggleMyCommentHidden(${comment.id})">${toggleBtnText}</button>
          <button class="btn-comment-action btn-comment-delete" onclick="deleteMyComment(${comment.id})">删除</button>
        </div>
      </div>
    </div>
  `;
}

// 切换评论隐藏状态
async function toggleMyCommentHidden(commentId) {
  try {
    const response = await fetch(`/api/my-comments/${commentId}/toggle-hidden`, {
      method: 'POST',
      headers: { 'X-User-Token': getUserToken() }
    });
    const data = await response.json();
    
    if (data.success) {
      showToast(data.message, 'success');
      loadProfilePageComments(); // 刷新列表
    } else {
      showToast(data.error || '操作失败', 'error');
    }
  } catch (e) {
    console.error('切换评论状态失败:', e);
    showToast('操作失败', 'error');
  }
}

// 删除我的评论
async function deleteMyComment(commentId) {
  if (!confirm('确定要删除这条评论吗？')) return;
  
  try {
    const response = await fetch(`/api/my-comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'X-User-Token': getUserToken() }
    });
    const data = await response.json();
    
    if (data.success) {
      showToast('评论已删除', 'success');
      loadProfilePageComments(); // 刷新列表
    } else {
      showToast(data.error || '删除失败', 'error');
    }
  } catch (e) {
    console.error('删除评论失败:', e);
    showToast('删除失败', 'error');
  }
}

// 显示更多评论
function showMoreComments() {
  // 打开我的评论管理页面
  openMyCommentsPage();
}

// 打开我的评论管理页面
async function openMyCommentsPage() {
  const listPage = document.getElementById('game-list-page');
  document.getElementById('list-page-title').textContent = '💬 我的评论';
  listPage.classList.add('active');
  document.getElementById('bottom-nav').style.display = 'none';
  
  const grid = document.getElementById('game-list-grid');
  grid.innerHTML = '<div class="loading-games">加载中...</div>';
  
  try {
    const response = await fetch('/api/my-comments?limit=100', {
      headers: { 'X-User-Token': getUserToken() }
    });
    const data = await response.json();
    
    if (data.success && data.comments && data.comments.length > 0) {
      grid.innerHTML = data.comments.map(comment => renderMyCommentCard(comment)).join('');
    } else {
      grid.innerHTML = '<div class="list-empty"><div class="list-empty-icon">📭</div><p>还没有发表评论</p></div>';
    }
  } catch (e) {
    console.error('加载评论列表失败:', e);
    grid.innerHTML = '<div class="list-empty"><div class="list-empty-icon">😢</div><p>加载失败</p></div>';
  }
  
  // 隐藏加载更多
  const noMore = document.getElementById('list-no-more');
  if (noMore) noMore.style.display = 'flex';
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
  if (modelEl) modelEl.value = getUserDefaultModel();
  
  const apiKeyEl = document.getElementById('llm-api-key');
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
  setUserDefaultModel(model);
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
  
  // 更新显示（使用有效作者名函数确保一致性）
  const usernameEl = document.getElementById('profile-page-username');
  if (usernameEl) usernameEl.textContent = getEffectiveAuthorName();
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

// 加载设置
function loadSettings() {
  const saved = localStorage.getItem('aigame-settings');
  if (saved) {
    try {
      state.settings = { ...state.settings, ...JSON.parse(saved) };
      // 使用统一函数同步所有模型相关属性
      const savedModel = state.settings.llmModel || state.settings.llmProvider || state.settings.llmModelId;
      if (savedModel) {
        setUserDefaultModel(savedModel);
      }
      log('设置已从本地加载，默认模型: ' + getUserDefaultModel());
    } catch (e) {
      log('加载设置失败: ' + e.message, 'error');
    }
  }
  
  // 加载调试模式
  state.debugMode = localStorage.getItem('aigame-debug') === 'true';
}

// 保存设置
async function saveSettings() {
  try {
    // 获取默认模型 (从 radio 按钮获取)
    const selectedRadio = document.querySelector('input[name="default-llm-model"]:checked');
    const selectedModel = selectedRadio ? selectedRadio.value : (state.llmModel || 'deepseek-v3');
    
    // 获取模型配置信息
    const modelConfig = MODEL_REGISTRY[selectedModel] || {};
    
    const newNickname = document.getElementById('author-name')?.value?.trim() || '';
    
    // 保存各模型的 API Keys
    const llmKeys = {};
    document.querySelectorAll('.llm-key-item').forEach(item => {
      const modelId = item.dataset.modelId;
      const input = item.querySelector('input[type="password"]');
      if (modelId && input) {
        const keyValue = input.value.trim();
        if (keyValue) {
          llmKeys[modelId] = keyValue;
        }
      }
    });
    localStorage.setItem('llm-api-keys', JSON.stringify(llmKeys));
    
    // 获取当前选中模型的 Key
    const currentModelKey = llmKeys[selectedModel] || '';
    
    const settings = {
      llmProvider: selectedModel,
      llmModelId: selectedModel,
      llmApiKey: currentModelKey,
      llmBaseUrl: document.getElementById('llm-base-url')?.value || modelConfig.baseUrl || '',
      llmModel: selectedModel,
      authorName: newNickname
    };
    
    state.settings = settings;
    // 使用统一函数同步所有模型相关属性（会自动同步高级设置下拉框）
    setUserDefaultModel(selectedModel);
    localStorage.setItem('aigame-settings', JSON.stringify(settings));
    
    console.log('[INFO] 设置已保存，默认模型:', selectedModel);
    
    // 保存调试模式
    state.debugMode = document.getElementById('debug-mode')?.checked || false;
    localStorage.setItem('aigame-debug', state.debugMode);
    
    // 如果昵称发生变化，同步更新到服务器
    if (newNickname && newNickname !== state.account.nickname) {
      await updateNickname(newNickname);
    } else {
      closeSettings();
      showToast('设置已保存', 'success');
    }
    
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

// 动态加载设置弹窗的模型列表
async function loadSettingsModelList() {
  const modelSelect = document.getElementById('llm-model-select');
  if (!modelSelect) return;
  
  try {
    // 从 API 获取模型列表
    const models = await fetchTurboModels();
    if (!models || models.length === 0) {
      console.warn('未获取到模型列表，使用默认列表');
      return;
    }
    
    // 保存当前选中的值，优先用户设置，否则用后端默认
    const currentValue = getUserDefaultModel();
    
    // 判断用户是否有自己的 Key
    const userHasKey = state.settings.llmApiKey && state.settings.llmApiKey.trim().length > 0;
    
    // 清空现有选项
    modelSelect.innerHTML = '';
    
    // 添加模型选项
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      
      // 构建显示名称
      let displayName = model.name;
      
      // 标记默认模型
      if (model.id === serverDefaultModel) {
        displayName += ' 🌟';
      }
      
      // 规则：用户有Key=免费，后台有Key=消耗积分，都没有=需配Key
      if (userHasKey) {
        displayName += ' 🆓';
      } else if (model.hasDefaultKey) {
        if (model.creditCost > 0) {
          displayName += ` (${model.creditCost}积分)`;
        } else {
          displayName += ' 🆓';
        }
      } else {
        displayName += ' 🔑需配Key';
      }
      
      // 添加速度和质量标识 [速度|质量]
      displayName += ` [${getSpeedLabelText(model.speedLevel)}|${getQualityLabelText(model.quality)}]`;
      
      option.textContent = displayName;
      modelSelect.appendChild(option);
    });
    
    // 添加自定义接口选项
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = '🔧 自定义接口（需配Key）';
    modelSelect.appendChild(customOption);
    
    // 恢复选中的值：优先用户设置，否则用后端默认
    if (currentValue && modelSelect.querySelector(`option[value="${currentValue}"]`)) {
      modelSelect.value = currentValue;
    } else if (serverDefaultModel && modelSelect.querySelector(`option[value="${serverDefaultModel}"]`)) {
      modelSelect.value = serverDefaultModel;
    } else if (models.length > 0) {
      // 如果都不在列表中，选择第一个
      modelSelect.value = models[0].id;
    }
    
  } catch (error) {
    console.error('加载模型列表失败:', error);
  }
}

// 更新密码按钮文字（根据是否已设置密码）
function updatePasswordButtonText() {
  const textEl = document.getElementById('password-action-text');
  if (textEl) {
    textEl.textContent = state.account.hasPassword ? '修改密码' : '设置密码';
  }
}

// 打开设置页面
// preSelectModelId: 可选，预先选择指定的模型
async function openSettings(preSelectModelId = null) {
  const page = document.getElementById('settings-page');
  page.classList.add('active');
  document.body.classList.add('modal-open');
  
  // 显示当前账号ID
  const accountIdEl = document.getElementById('settings-account-id');
  if (accountIdEl) {
    accountIdEl.textContent = state.account.visibleId || state.account.visibleToken || getUserToken() || '未登录';
  }
  
  // 更新密码按钮文字
  updatePasswordButtonText();
  
  // 动态加载模型列表
  await loadSettingsModelList();
  
  // 渲染 LLM Keys 列表
  await renderLLMKeysList();
  
  // 填充当前设置
  const modelSelect = document.getElementById('llm-model-select');
  if (modelSelect) {
    // 优先使用传入的预选模型，其次是已保存的模型
    const targetModel = preSelectModelId || getUserDefaultModel();
    if (modelSelect.querySelector(`option[value="${targetModel}"]`)) {
      modelSelect.value = targetModel;
    }
  }
  
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
  
  // 如果有预选模型，切换到 LLM 设置面板并高亮对应项
  if (preSelectModelId) {
    switchSettingsSection('llm');
    setTimeout(() => {
      const modelItem = document.querySelector(`.llm-key-item[data-model-id="${preSelectModelId}"]`);
      if (modelItem) {
        modelItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        modelItem.classList.add('highlight-pulse');
        setTimeout(() => modelItem.classList.remove('highlight-pulse'), 2000);
      }
    }, 100);
  }
}

// 关闭设置页面
function closeSettings() {
  document.getElementById('settings-page').classList.remove('active');
  document.body.classList.remove('modal-open');
}

// 切换设置面板
function switchSettingsSection(section) {
  // 更新导航项
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });
  
  // 更新面板
  document.querySelectorAll('.settings-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `settings-panel-${section}`);
  });
}

// 渲染 LLM Keys 列表
async function renderLLMKeysList() {
  const listContainer = document.getElementById('llm-keys-list');
  if (!listContainer) return;
  
  // 获取模型列表
  const models = await fetchTurboModels();
  if (!models || models.length === 0) {
    listContainer.innerHTML = '<p class="text-muted">无法加载模型列表</p>';
    return;
  }
  
  // 获取已保存的 API Keys 和默认模型
  const savedKeys = JSON.parse(localStorage.getItem('llm-api-keys') || '{}');
  const defaultModel = getUserDefaultModel();
  
  // 渲染列表
  listContainer.innerHTML = models
    .filter(model => model.id !== 'custom') // 排除自定义接口
    .map(model => {
      const savedKey = savedKeys[model.id] || '';
      const hasKey = savedKey.length > 0;
      const isFree = model.free || model.hasBackendKey;
      const isDefault = model.id === defaultModel;
      
      return `
        <div class="llm-key-item ${isDefault ? 'is-default' : ''}" data-model-id="${model.id}">
          <div class="llm-key-header">
            <label class="llm-default-check">
              <input type="radio" 
                     name="default-llm-model" 
                     value="${model.id}" 
                     ${isDefault ? 'checked' : ''}
                     onchange="onDefaultModelChange('${model.id}')">
              <span class="llm-default-label">默认</span>
            </label>
            <div class="llm-key-info">
              <div class="llm-key-name">
                ${escapeHtml(model.name)}
                ${isFree ? '<span class="badge free">免费</span>' : '<span class="badge need-key">需配Key</span>'}
              </div>
              <div class="llm-key-status ${hasKey ? 'configured' : ''}">
                ${hasKey ? '✓ 已配置' : (isFree ? '使用平台默认' : '未配置')}
              </div>
            </div>
          </div>
          <div class="llm-key-input">
            <input type="password" 
                   id="llm-key-${model.id}" 
                   value="${escapeHtml(savedKey)}"
                   placeholder="${isFree ? '可选，留空使用默认' : '输入您的 API Key'}"
                   onchange="onLLMKeyChange('${model.id}')">
          </div>
        </div>
      `;
    }).join('');
}

// 默认模型变更处理
function onDefaultModelChange(modelId) {
  // 使用统一函数更新所有模型相关属性（会自动同步高级设置下拉框）
  setUserDefaultModel(modelId);
  
  // 更新 UI 样式
  document.querySelectorAll('.llm-key-item').forEach(item => {
    item.classList.toggle('is-default', item.dataset.modelId === modelId);
  });
  
  console.log('[INFO] 默认模型已切换为:', modelId);
}

// LLM Key 变更处理
function onLLMKeyChange(modelId) {
  const input = document.getElementById(`llm-key-${modelId}`);
  if (!input) return;
  
  const value = input.value.trim();
  const item = input.closest('.llm-key-item');
  const statusEl = item?.querySelector('.llm-key-status');
  
  if (statusEl) {
    if (value) {
      statusEl.textContent = '✓ 已配置';
      statusEl.classList.add('configured');
    } else {
      const isFree = item.querySelector('.badge.free');
      statusEl.textContent = isFree ? '使用平台默认配置' : '未配置';
      statusEl.classList.remove('configured');
    }
  }
}

// 切换自定义 API Key 可见性
function toggleCustomApiKeyVisibility() {
  const input = document.getElementById('llm-custom-api-key');
  const btn = input?.parentElement?.querySelector('.btn-toggle-pwd');
  if (input) {
    if (input.type === 'password') {
      input.type = 'text';
      if (btn) btn.textContent = '🙈';
    } else {
      input.type = 'password';
      if (btn) btn.textContent = '👁️';
    }
  }
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
        <span class="leaderboard-stat">💬 ${game.comment_count || 0}</span>
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
  if (!container) {
    console.warn('渲染游戏列表失败: 容器不存在', containerId);
    return;
  }
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
        <span>💬 ${game.comment_count || 0}</span>
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

// ==================== 加速生成相关 ====================

// 加速模型列表缓存
let turboModelsCache = null;
let turboShowTimer = null;

// 获取加速模型列表
async function fetchTurboModels() {
  if (turboModelsCache) return turboModelsCache;
  
  try {
    const response = await fetch('/api/turbo-models');
    const data = await response.json();
    if (data.success) {
      turboModelsCache = data.models;
      
      // 同时更新默认模型设置
      if (data.defaultModel) {
        serverDefaultModel = data.defaultModel;
      }
      
      return data.models;
    }
  } catch (error) {
    console.error('获取加速模型失败:', error);
  }
  return [];
}

// 显示切换模型按钮（现在始终显示，保留函数兼容性）
function showTurboButton() {
  // 切换模型按钮现在始终可见，无需操作
}

// 隐藏切换模型按钮（保留函数兼容性）
function hideTurboButton() {
  // 切换模型按钮现在始终可见，无需操作
}

// 延迟显示（保留函数兼容性）
function scheduleTurboButtonShow() {
  // 切换模型按钮现在始终可见，无需延迟
}

// 显示加速模型选择弹窗
async function showTurboOptions() {
  const modal = document.getElementById('turbo-modal');
  const listContainer = document.getElementById('turbo-models-list');
  
  if (!modal || !listContainer) return;
  
  // 获取可用的加速模型
  const models = await fetchTurboModels();
  
  if (models.length === 0) {
    showToast('暂无可用的加速模型', 'error');
    return;
  }
  
  // 判断用户是否有自己的 Key
  const userHasKey = state.settings.llmApiKey && state.settings.llmApiKey.trim().length > 0;
  
  // 渲染模型列表
  listContainer.innerHTML = models.map(model => {
    const backendHasKey = model.hasDefaultKey === true;
    
    // 显示积分或免费标识
    // 规则：用户有Key=免费，后台有Key=消耗积分，都没有=需配Key
    let costDisplay = '';
    let clickable = true;
    
    if (userHasKey) {
      // 用户有自己的Key，所有模型都免费
      costDisplay = `
        <div class="turbo-model-cost free">
          <div class="turbo-model-cost-value" style="color: #10b981;">🆓 免费</div>
          <div class="turbo-model-cost-label" style="color: #94a3b8;">使用您的Key</div>
        </div>
      `;
    } else if (backendHasKey) {
      // 后台有Key，显示积分
      if (model.creditCost > 0) {
        costDisplay = `
          <div class="turbo-model-cost">
            <div class="turbo-model-cost-value">${model.creditCost}</div>
            <div class="turbo-model-cost-label">积分</div>
          </div>
        `;
      } else {
        costDisplay = `
          <div class="turbo-model-cost free">
            <div class="turbo-model-cost-value" style="color: #10b981;">🆓 免费</div>
            <div class="turbo-model-cost-label" style="color: #94a3b8;">0积分</div>
          </div>
        `;
      }
    } else {
      // 后台没Key，需要用户配置（点击后跳转设置）
      costDisplay = `
        <div class="turbo-model-cost free needs-key">
          <div class="turbo-model-cost-value" style="font-size: 0.8rem; color: #f59e0b;">🔑 需配Key</div>
          <div class="turbo-model-cost-label" style="color: #94a3b8;">点击配置</div>
        </div>
      `;
    }
    
    // 判断点击行为
    const needsKeySetup = !userHasKey && !backendHasKey;
    const onClickAction = needsKeySetup 
      ? `goToSettingsForModel('${model.id}', '${model.name}')`
      : `selectTurboModel('${model.id}', ${userHasKey ? 0 : model.creditCost}, false)`;
    
    // 根据后台配置的速度等级获取显示信息
    const speedInfo = getSpeedInfo(model.speedLevel || 'normal');
    
    return `
      <div class="turbo-model-item ${model.turboRecommended ? 'recommended' : ''} ${needsKeySetup ? 'needs-key-setup' : ''}" 
           onclick="${onClickAction}"
           ${needsKeySetup ? 'title="点击配置API Key"' : ''}>
        <div class="turbo-model-info">
          <div class="turbo-model-name">${model.name}</div>
          <div class="turbo-model-meta">
            <span class="turbo-model-speed ${speedInfo.className}">${speedInfo.icon} ${speedInfo.label}</span>
            <span class="turbo-model-quality">质量: ${getQualityLabelText(model.quality)}</span>
          </div>
        </div>
        ${costDisplay}
      </div>
    `;
  }).join('');
  
  modal.classList.add('active');
}

// 关闭加速模型选择弹窗
function closeTurboModal() {
  const modal = document.getElementById('turbo-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// 选择并切换到加速模型
async function selectTurboModel(modelId, creditCost, needsUserKey = false) {
  // 如果需要用户自备Key，直接打开设置弹窗让用户配置
  if (needsUserKey) {
    // 获取用户配置的API Key
    const userApiKey = localStorage.getItem(`user_apikey_${modelId}`) || localStorage.getItem('user_default_apikey') || state.settings.llmApiKey;
    if (!userApiKey) {
      closeTurboModal();
      // 直接打开设置弹窗
      openSettings();
      // 滚动到对应的模型项
      setTimeout(() => {
        const modelItem = document.querySelector(`.llm-key-item[data-model-id="${modelId}"]`);
        if (modelItem) {
          modelItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          modelItem.classList.add('highlight-pulse');
          setTimeout(() => modelItem.classList.remove('highlight-pulse'), 2000);
        }
        showToast('请先配置此模型的 API Key', 'info');
      }, 100);
      return;
    }
  }
  
  // 检查积分（免费模型跳过积分检查）
  if (creditCost > 0 && state.credits < creditCost) {
    showToast(`积分不足，需要 ${creditCost} 积分`, 'error');
    closeTurboModal();
    openNoCreditsModal();
    return;
  }
  
  // 确认切换
  let confirmMsg = '';
  if (creditCost === 0) {
    confirmMsg = `确定切换到 ${modelId} 模型吗？\n\n当前生成将被中断，使用新模型重新开始。`;
  } else {
    confirmMsg = `确定使用 ${creditCost} 积分切换到加速模式吗？\n\n当前生成将被中断，使用新模型重新开始。`;
  }
  const confirmed = confirm(confirmMsg);
  if (!confirmed) return;
  
  closeTurboModal();
  
  // 保存旧请求ID，用于通知后端取消
  const oldRequestId = state.currentRequestId;
  
  // 中断当前请求（前端）
  if (state.abortController) {
    state.abortController.abort();
    console.log('[TURBO] 已中断前端请求');
  }
  
  // 通知后端取消旧请求（防止旧请求完成后覆盖草稿）
  if (oldRequestId) {
    try {
      const userToken = getUserToken();
      await fetch('/api/cancel-generation', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Token': userToken || ''
        },
        body: JSON.stringify({ requestId: oldRequestId })
      });
      console.log(`[TURBO] 已通知后端取消请求: ${oldRequestId}`);
    } catch (cancelError) {
      console.warn('[TURBO] 通知后端取消失败（不影响继续）:', cancelError);
    }
  }
  
  // 保存当前的 prompt
  const currentPrompt = backgroundTask.prompt || document.getElementById('prompt-input')?.value?.trim();
  
  if (!currentPrompt) {
    showToast('无法获取当前描述', 'error');
    return;
  }
  
  // 清理当前生成状态
  stopGeneratingTimer();
  hideTurboButton();
  
  // 显示加速状态
  showToast(`⚡ 切换到加速模式，消耗 ${creditCost} 积分`, 'info');
  log(`⚡ 切换到加速模式，使用模型: ${modelId}`, 'info');
  
  // 更新UI状态
  const overlay = document.getElementById('generating-overlay');
  overlay.classList.add('turbo-mode');
  
  // 更新状态显示
  updateGeneratingStatus('⚡ 加速模式生成中...');
  
  // 预先扣除本地积分（服务端会真正扣除）
  state.credits -= creditCost;
  saveCredits();
  updateCreditsDisplay();
  
  // 重新开始生成
  await generateGameWithTurbo(currentPrompt, modelId);
}

// 使用加速模型生成游戏
async function generateGameWithTurbo(prompt, turboModelId) {
  state.isGenerating = true;
  state.abortController = new AbortController();
  
  // 重置后台任务状态
  backgroundTask.isActive = true;
  backgroundTask.isCancelled = false;
  backgroundTask.prompt = prompt;
  backgroundTask.result = null;
  
  // 重新开始计时（不再显示加速按钮）
  startGeneratingTimer();
  
  // 更新显示
  const turboCreditsDisplay = document.getElementById('turbo-credits-display');
  if (turboCreditsDisplay) {
    turboCreditsDisplay.textContent = formatCredits(state.credits);
  }
  
  try {
    const userToken = getUserToken();
    const authorToken = getAuthorToken();
    
    // 生成新的请求ID
    const requestId = `req_turbo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    state.currentRequestId = requestId;
    console.log(`[TURBO] 新请求ID: ${requestId}`);
    
    // 获取当前高级设置
    const advancedSettings = getCurrentAdvancedSettings();
    
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Token': userToken || '',
        'X-Author-Token': authorToken || ''
      },
      body: JSON.stringify({ 
        prompt,
        turboModel: turboModelId,
        isTurboSwitch: true,
        requestId,  // 携带请求ID
        advancedSettings
      }),
      signal: state.abortController.signal
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || '生成失败');
    }
    
    log(`✅ 加速生成成功: ${data.title}`, 'success');
    
    // 处理生成结果
    handleGenerationSuccess(data, prompt);
    
  } catch (error) {
    if (error.name === 'AbortError') {
      log('加速生成被中断', 'warn');
      return;
    }
    
    console.error('加速生成失败:', error);
    log(`❌ 加速生成失败: ${error.message}`, 'error');
    showToast(`生成失败: ${error.message}`, 'error');
    
    // 恢复状态
    state.isGenerating = false;
    stopGeneratingTimer();
    hideGeneratingOverlay();
    document.getElementById('generating-overlay').classList.remove('turbo-mode');
    document.getElementById('generating-float').classList.remove('active');
  }
}

// 处理生成成功（复用逻辑）
function handleGenerationSuccess(data, prompt) {
  // 获取草稿ID
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
  
  // 判断是否在后台模式
  if (backgroundTask.isMinimized) {
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
    state.currentGame = {
      title: data.title,
      prompt: prompt,
      code: data.code,
      isNew: true,
      draftId: draftId
    };
    state.currentGameId = draftId || null;
    
    // 隐藏生成遮罩
    document.getElementById('generating-overlay').classList.remove('active');
    document.getElementById('generating-overlay').classList.remove('turbo-mode');
    document.body.classList.remove('overlay-open');
    document.getElementById('generating-float').classList.remove('active');
    
    // 显示保存弹窗
    state.isGenerating = false;
    stopGeneratingTimer();
    hideTurboButton();
    clearGeneratingState();
    
    openSaveModal();
    showToast('游戏生成完成！', 'success');
  }
}

// 获取当前高级设置
function getCurrentAdvancedSettings() {
  // 尝试从DOM获取当前高级设置
  const gameName = document.getElementById('advanced-game-name')?.value;
  const gameType = document.getElementById('advanced-game-type')?.value;
  const artStyle = document.getElementById('advanced-art-style')?.value;
  const orientation = document.getElementById('advanced-orientation')?.value;
  const platform = document.getElementById('advanced-platform')?.value;
  const difficulty = document.getElementById('advanced-difficulty')?.value;
  const soundEffect = document.getElementById('advanced-sound')?.value;
  const visibility = document.querySelector('input[name="visibility"]:checked')?.value;
  
  return {
    gameName,
    gameType,
    artStyle,
    orientation,
    platform,
    difficulty,
    soundEffect,
    visibility
  };
}

// ==================== 生成计时相关 ====================

// 开始计时
function startGeneratingTimer() {
  generatingStartTime = Date.now();
  updateGeneratingTime();
  generatingTimer = setInterval(updateGeneratingTime, 1000);
  
  // 启动tips轮换
  startGeneratingTips();
  
  // 启动加速按钮延迟显示
  scheduleTurboButtonShow();
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
  
  // 隐藏加速按钮
  hideTurboButton();
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
  if (overlay) {
    overlay.style.display = '';  // 清除强制隐藏样式
    overlay.classList.add('active');
  }
  document.body.classList.add('overlay-open');
}

// 隐藏生成遮罩
function hideGeneratingOverlay() {
  const overlay = document.getElementById('generating-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    // 强制隐藏样式，以防 CSS 类不生效
    overlay.style.display = 'none';
  }
  document.body.classList.remove('overlay-open');
}

// 确认关闭生成（显示选择对话框）
function confirmCloseGeneration() {
  // 创建确认对话框
  const existingDialog = document.getElementById('close-generation-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }
  
  const dialog = document.createElement('div');
  dialog.id = 'close-generation-dialog';
  dialog.className = 'confirm-dialog-overlay';
  dialog.innerHTML = `
    <div class="confirm-dialog">
      <div class="confirm-dialog-icon">🎮</div>
      <h3 class="confirm-dialog-title">AI 正在努力创作中</h3>
      <p class="confirm-dialog-message">游戏生成需要一点时间，您希望：</p>
      <div class="confirm-dialog-buttons">
        <button class="confirm-btn confirm-btn-minimize" id="confirm-btn-minimize">
          📥 后台继续
          <span class="confirm-btn-desc">最小化后继续生成</span>
        </button>
        <button class="confirm-btn confirm-btn-cancel" id="confirm-btn-cancel">
          ✖ 取消生成
          <span class="confirm-btn-desc">放弃本次创作</span>
        </button>
      </div>
      <button class="confirm-dialog-close" id="confirm-dialog-close">×</button>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // 绑定按钮事件 - 最小化
  const btnMinimize = document.getElementById('confirm-btn-minimize');
  if (btnMinimize) {
    btnMinimize.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 先关闭对话框
      const dlg = document.getElementById('close-generation-dialog');
      if (dlg) dlg.remove();
      // 再执行最小化
      setTimeout(() => {
        minimizeGenerating();
      }, 50);
    });
  }
  
  // 绑定按钮事件 - 取消生成
  const btnCancel = document.getElementById('confirm-btn-cancel');
  if (btnCancel) {
    btnCancel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 先关闭对话框
      const dlg = document.getElementById('close-generation-dialog');
      if (dlg) dlg.remove();
      // 再执行取消
      setTimeout(() => {
        cancelGeneration();
      }, 50);
    });
  }
  
  // 绑定按钮事件 - 关闭对话框（返回生成界面）
  const btnClose = document.getElementById('confirm-dialog-close');
  if (btnClose) {
    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dlg = document.getElementById('close-generation-dialog');
      if (dlg) dlg.remove();
    });
  }
  
  // 点击遮罩关闭
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      closeConfirmDialog();
    }
  });
}

// 关闭确认对话框
function closeConfirmDialog() {
  const dialog = document.getElementById('close-generation-dialog');
  if (dialog) {
    dialog.remove();
  }
}

// 取消生成
async function cancelGeneration() {
  backgroundTask.isCancelled = true;
  
  // 保存当前请求ID，用于通知后端
  const requestIdToCancel = state.currentRequestId;
  
  // 获取草稿ID（在清理状态之前）
  let draftIdToDelete = null;
  try {
    const savedState = localStorage.getItem('aigame-generating-state');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      draftIdToDelete = parsed.draftId;
    }
  } catch (e) {
    console.warn('[CANCEL] 获取草稿ID失败:', e);
  }
  
  // 中断前端请求
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  
  // 通知后端取消 LLM 请求（节省 Token）
  if (requestIdToCancel) {
    try {
      const userToken = getUserToken();
      await fetch('/api/cancel-generation', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Token': userToken || ''
        },
        body: JSON.stringify({ requestId: requestIdToCancel })
      });
      console.log(`[CANCEL] 已通知后端取消请求: ${requestIdToCancel}`);
    } catch (cancelError) {
      console.warn('[CANCEL] 通知后端取消失败:', cancelError);
    }
    state.currentRequestId = null;
  }
  
  // 删除草稿（如果存在）
  if (draftIdToDelete) {
    try {
      const authorToken = getAuthorToken();
      const response = await fetch(`/api/games/${draftIdToDelete}`, {
        method: 'DELETE',
        headers: {
          'X-Author-Token': authorToken || ''
        }
      });
      if (response.ok) {
        console.log(`[CANCEL] 已删除草稿: ${draftIdToDelete}`);
      }
    } catch (deleteError) {
      console.warn('[CANCEL] 删除草稿失败:', deleteError);
    }
  }
  
  // 停止草稿轮询
  stopDraftPolling();
  
  state.isGenerating = false;
  stopGeneratingTimer();
  hideTurboButton();
  
  // 隐藏所有生成相关UI
  document.getElementById('generating-overlay').classList.remove('active');
  document.getElementById('generating-overlay').classList.remove('turbo-mode');
  document.body.classList.remove('overlay-open');
  document.getElementById('generating-float').classList.remove('active');
  
  // 清理生成状态
  clearGeneratingState();
  
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
async function generateGame(advancedSettings = null) {
  const prompt = document.getElementById('prompt-input').value.trim();
  
  if (!prompt) {
    showToast('请输入游戏描述', 'error');
    return;
  }
  
  // 检查封禁状态（前端预检查）
  if (isUserBanned()) {
    showToast(`🚫 ${getBanReason()}，无法生成游戏`, 'error');
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
  
  // 获取当前选择的模型
  // 优先使用高级设置中选择的模型，其次是用户设置的默认模型
  const advModelSelect = document.getElementById('adv-llm-model');
  const advSelectedModel = advModelSelect?.value?.trim();
  const selectedModel = advSelectedModel || getUserDefaultModel();
  const modelInfo = MODEL_REGISTRY[selectedModel];
  
  // 获取用户为各模型保存的 API Keys
  const savedLLMKeys = JSON.parse(localStorage.getItem('llm-api-keys') || '{}');
  const modelSpecificKey = savedLLMKeys[selectedModel] || '';
  
  // 判断用户是否有自己的 Key
  // 检查高级设置中的Key，或者模型专属Key，或者全局设置中的Key
  const advKeyInput = document.getElementById('adv-llm-key');
  const advKey = advKeyInput?.value?.trim();
  const userHasKey = (advKey && advKey.length > 0) || 
                     (modelSpecificKey && modelSpecificKey.length > 0) ||
                     (state.settings.llmApiKey && state.settings.llmApiKey.trim().length > 0);
  const backendHasKey = modelInfo?.hasDefaultKey === true;
  const modelCreditCost = modelInfo?.creditCost || 1;
  
  // 自定义接口必须用户配置
  if (selectedModel === 'custom') {
    if (!state.settings.llmApiKey || !state.settings.llmBaseUrl) {
      showToast('使用自定义接口需要配置 API Key 和接口地址', 'error');
      openSettings();
      return;
    }
  }
  
  // 检查 Key 可用性
  // 规则：用户没Key + 后台也没Key = 不能生成
  if (!userHasKey && !backendHasKey && selectedModel !== 'custom') {
    showNeedApiKeyForModelModal(modelInfo?.name || selectedModel, selectedModel);
    return;
  }
  
  // 计算本次生成需要的积分
  // 规则：用户有Key = 免费，用户没Key但后台有Key = 消耗后台配置的积分
  let creditCostThisTime = 0;
  let isFreeGeneration = false;
  let freeReason = '';
  
  if (userHasKey) {
    // 用户有自己的 Key，免费
    creditCostThisTime = 0;
    isFreeGeneration = true;
    freeReason = '使用自己的 API Key，免费生成';
  } else if (state.isFirstGeneration) {
    // 首次生成免费
    creditCostThisTime = 0;
    isFreeGeneration = true;
    freeReason = '首次生成免费';
  } else {
    // 使用后台 Key，消耗积分
    creditCostThisTime = modelCreditCost;
  }
  
  // 检查积分是否足够
  if (creditCostThisTime > 0 && state.credits < creditCostThisTime) {
    openNoCreditsModal();
    return;
  }
  
  // 显示积分提示（实际扣除由后端完成）
  if (creditCostThisTime > 0) {
    showToast(`💎 本次将消耗 ${creditCostThisTime} 积分`, 'info');
  } else {
    showToast(`🆓 ${freeReason}`, 'success');
    // 标记首次生成已使用
    if (state.isFirstGeneration && freeReason.includes('首次')) {
      state.isFirstGeneration = false;
      localStorage.setItem('aigame-first-generation', 'false');
    }
  }
  
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
  
  // 获取当前模型的预计生成时间（selectedModel 已在前面定义）
  currentModelEstimatedTime = modelEstimatedTimes[selectedModel] || 30; // 默认30秒
  
  startGeneratingTimer();
  
  // 保存生成状态到本地存储，并创建草稿（防止关闭浏览器丢失）
  // 这里必须 await，确保草稿已创建，后端可以在生成完成后更新它
  const createdDraftId = await saveGeneratingState();
  console.log(`[DEBUG] 草稿ID: ${createdDraftId || '无'}`);  // 仅控制台输出
  
  log(`🎮 开始生成: "${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}"`);
  updateGeneratingStatus('正在连接 AI 服务...');
  
  try {
    // 构建LLM配置 - 只传递 modelId 和用户的 apiKey（如果有）
    // 后端会根据 modelId 从 LLM_MODELS 获取完整配置
    // modelSpecificKey 已在前面定义
    const llmConfig = {
      provider: selectedModel,  // 这里传 modelId，后端会解析
      apiKey: modelSpecificKey || state.settings.llmApiKey || ''  // 优先使用模型专属Key
    };
    
    // 如果是自定义接口，需要传递完整配置
    if (selectedModel === 'custom') {
      llmConfig.baseUrl = state.settings.llmBaseUrl;
      llmConfig.model = state.settings.llmModel;
    }
    
    // 开发者信息仅在控制台输出（modelInfo 已在前面定义）
    console.log(`[DEBUG] 选择的模型ID: ${selectedModel}`);
    console.log(`[DEBUG] 用户Key: ${llmConfig.apiKey ? '已配置' : '未配置'}`);
    
    const modelDisplayName = modelInfo?.name || selectedModel;
    log(`🤖 正在使用 ${modelDisplayName} 模型`);
    updateGeneratingStatus('AI 正在思考创意...');
    
    const startTime = Date.now();
    
    // 获取用户token和作者token
    const userToken = getUserToken();
    const authorToken = getAuthorToken();
    
    // 生成唯一请求ID，用于取消功能
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    state.currentRequestId = requestId;
    console.log(`[DEBUG] 生成请求ID: ${requestId}`);
    
    // 如果高级设置中有LLM覆盖，应用到llmConfig
    if (advancedSettings?.llmOverride) {
      const override = advancedSettings.llmOverride;
      if (override.model) llmConfig.model = override.model;
      if (override.apiKey) llmConfig.apiKey = override.apiKey;
      if (override.apiUrl) llmConfig.baseUrl = override.apiUrl;
      console.log(`[DEBUG] 使用高级设置覆盖: 模型=${override.model || '默认'}, URL=${override.apiUrl || '默认'}`);
    }
    
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
        draftId: createdDraftId,  // 传递草稿ID，后端生成完成后会自动更新
        requestId,  // 请求ID，用于取消功能
        advancedSettings: advancedSettings ? {
          gameName: advancedSettings.gameName,
          gameType: advancedSettings.gameType,
          artStyle: advancedSettings.artStyle,
          orientation: advancedSettings.orientation,
          platform: advancedSettings.platform,
          difficulty: advancedSettings.difficulty,
          soundEffect: advancedSettings.soundEffect,
          visibility: advancedSettings.visibility
        } : null
      }),
      signal: state.abortController.signal
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`⚡ AI响应完成，耗时 ${elapsed}秒`);
    
    const data = await response.json();
    
    if (!data.success) {
      // 检查是否需要配置 API Key
      if (data.needApiKey) {
        // 后端明确告知需要配置 API Key
        showNeedApiKeyModal(data.error, data.hint, data.provider);
        throw new Error(data.error);
      }
      
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
    
    log(`✅ 游戏生成成功: ${data.title}`, 'success');
    
    // 积分已在请求发起时扣除，这里只记录日志
    console.log(`[DEBUG] 当前剩余积分: ${state.credits}`);
    
    // 调试信息仅输出到控制台
    if (data.debug) {
      console.log(`[DEBUG] 代码长度: ${data.debug.codeLength} 字符`);
      if (data.debug.apiTime) {
        console.log(`[DEBUG] 服务端耗时: ${data.debug.apiTime}ms`);
      }
      if (data.debug.tokens) {
        console.log(`[DEBUG] Token使用: 输入${data.debug.tokens.prompt_tokens}, 输出${data.debug.tokens.completion_tokens}`);
      }
    }
    
    // 验证HTML代码结构（仅输出到控制台）
    const code = data.code || '';
    const hasDoctype = code.toLowerCase().includes('<!doctype');
    const hasHtml = code.includes('<html');
    const hasScript = code.includes('<script');
    const hasCanvas = code.includes('<canvas') || code.includes('getContext');
    
    console.log(`[DEBUG] HTML验证: DOCTYPE=${hasDoctype}, HTML=${hasHtml}, Script=${hasScript}, Canvas=${hasCanvas}`);
    
    if (!hasScript) {
      console.log('[DEBUG] 警告: 生成的代码可能缺少JavaScript脚本');
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
      // 前台模式：直接保存并显示成功提示
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
      
      // 自动保存并发布游戏，然后显示成功提示
      await autoSaveAndPublishGame(data.title, prompt, data.code, draftId);
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
    // 停止草稿轮询（如果有）
    stopDraftPolling();
    // setGenerateButtonLoading(false);
  }
}

// 自动保存并发布游戏，显示成功提示
async function autoSaveAndPublishGame(title, prompt, code, draftId) {
  try {
    const authorName = getEffectiveAuthorName();
    const authorToken = getAuthorToken();
    
    // 刷新积分显示
    loadCredits().then(() => {
      updateCreditsDisplay();
    });
    
    // 首次成功生成游戏时触发邀请奖励
    triggerReferralReward();
    
    // 停止生成计时器
    stopGeneratingTimer();
    
    // 验证代码是否有语法错误
    const codeError = validateGameCode(code);
    if (codeError) {
      console.warn('[WARN] 游戏代码可能有问题:', codeError);
      // 即使有错误也继续保存，让用户可以后续编辑
    }
    
    let gameId = draftId || state.currentGameId;
    
    if (gameId) {
      // 更新已有游戏（草稿或已发布的游戏）
      const response = await fetch(`/api/games/${gameId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Author-Token': authorToken
        },
        body: JSON.stringify({
          title,
          prompt,
          code,
          authorName,
          authorToken,
          status: 'published'
        })
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '保存失败');
      }
      
      state.currentGameId = gameId;
    } else {
      // 创建新游戏
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          prompt,
          code,
          authorName,
          authorToken,
          status: 'published'
        })
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '保存失败');
      }
      
      gameId = data.id;
      state.currentGameId = gameId;
      saveGameAuthorToken(gameId, authorToken);
    }
    
    log(`✅ 游戏已自动保存: ${title}`, 'success');
    
    // 刷新游戏列表
    loadGames();
    
    // 显示成功提示，点击跳转到游戏页面
    showSuccessToastWithAction(
      `游戏「${title}」生成成功！`,
      '👆 点击立即查看和编辑',
      () => {
        // 跳转到游戏页面
        openGame(gameId);
      },
      6000  // 6秒后自动消失
    );
    
  } catch (error) {
    console.error('自动保存游戏失败:', error);
    // 保存失败时，回退到手动保存弹窗
    showToast('自动保存失败，请手动保存', 'error');
    openSaveModal();
  }
}

// 打开保存弹窗
function openSaveModal() {
  const modal = document.getElementById('save-modal');
  modal.classList.add('active');
  
  document.getElementById('save-title').value = state.currentGame?.title || '';
  document.getElementById('save-author').value = getEffectiveAuthorName();
  
  // 生成成功后刷新积分显示（后端已扣除，前端同步）
  loadCredits({ showChange: true, reason: '生成游戏' }).then(() => {
    updateCreditsDisplay();
  });
  
  // 首次成功生成游戏时触发邀请奖励
  triggerReferralReward();
  
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
    // 先验证代码是否有语法错误
    const codeError = validateGameCode(state.currentGame.code);
    if (codeError) {
      // 显示错误提示，让用户选择如何处理
      showCodeErrorModal(codeError);
      return;
    }
    
    // 直接加载游戏代码，不做缩放处理，让用户可以直接玩
    previewFrame.srcdoc = state.currentGame.code;
    // 保存原始代码用于调试
    state.currentGameCode = state.currentGame.code;
  }
}

// 验证游戏代码是否有语法错误
function validateGameCode(code) {
  if (!code) return '代码为空';
  
  // 提取所有 <script> 标签中的 JavaScript 代码
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let allScripts = '';
  
  while ((match = scriptRegex.exec(code)) !== null) {
    allScripts += match[1] + '\n';
  }
  
  if (!allScripts.trim()) {
    // 没有脚本，检查是否至少有HTML结构
    if (!code.includes('<body') && !code.includes('<div')) {
      return 'HTML结构不完整';
    }
    return null; // 纯HTML，没有JS
  }
  
  // 尝试解析 JavaScript 代码
  try {
    // 使用 Function 构造器来检测语法错误
    new Function(allScripts);
    return null; // 没有错误
  } catch (error) {
    // 返回错误信息
    return error.message;
  }
}

// 显示代码错误弹窗
function showCodeErrorModal(errorMessage) {
  // 移除旧弹窗
  const oldModal = document.getElementById('code-error-modal');
  if (oldModal) oldModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'code-error-modal';
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h3>⚠️ 游戏代码有问题</h3>
        <button class="btn btn-icon btn-close" onclick="closeCodeErrorModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="error-info" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <p style="color: #f87171; font-size: 0.875rem; margin: 0;">
            <strong>错误详情：</strong><br>
            <code style="font-size: 0.8rem; word-break: break-all;">${escapeHtml(errorMessage)}</code>
          </p>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 16px;">
          AI 生成的游戏代码存在语法错误，无法正常运行。你可以：
        </p>
        <ul style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 16px; padding-left: 20px;">
          <li>🔄 重新生成（推荐）</li>
          <li>✏️ 换个描述词试试</li>
          <li>🤖 尝试其他 AI 模型</li>
          <li>💾 仍然保存（可能无法游玩）</li>
        </ul>
      </div>
      <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="closeCodeErrorModal(); closeSaveModal();">取消</button>
        <button class="btn btn-warning" onclick="closeCodeErrorModal(); forceOpenSaveModal();">仍然保存</button>
        <button class="btn btn-primary" onclick="closeCodeErrorModal(); closeSaveModal(); regenerateGame();">🔄 重新生成</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// 关闭代码错误弹窗
function closeCodeErrorModal() {
  const modal = document.getElementById('code-error-modal');
  if (modal) modal.remove();
}

// 强制打开保存弹窗（忽略代码错误）
function forceOpenSaveModal() {
  const modal = document.getElementById('save-modal');
  modal.classList.add('active');
  
  const previewFrame = document.getElementById('preview-frame');
  if (previewFrame && state.currentGame?.code) {
    previewFrame.srcdoc = state.currentGame.code;
    state.currentGameCode = state.currentGame.code;
  }
}

// 重新生成游戏
function regenerateGame() {
  const prompt = state.currentGame?.prompt || document.getElementById('prompt-input').value;
  if (prompt) {
    document.getElementById('prompt-input').value = prompt;
    generateGame();
  } else {
    showToast('请输入游戏描述', 'error');
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
  console.log(`[DEBUG] 加载游戏: ${gameId}`);  // 仅控制台输出
  
  // 统一使用静态页面来获得最佳体验（微信和其他浏览器均使用独立HTML页面）
  if (!window.location.pathname.startsWith('/g/')) {
    // 如果不是已经在静态页面，则跳转到静态页面
    const staticUrl = `/g/${gameId.substring(0, 2)}/${gameId}.html`;
    console.log(`[DEBUG] 跳转到静态游戏页面: ${staticUrl}`);  // 仅控制台输出
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
    
    // 设置发布时间
    const publishTimeEl = document.getElementById('tiktok-publish-time');
    if (publishTimeEl && data.game.created_at) {
      publishTimeEl.textContent = `📅 发布于 ${formatTimeAgo(data.game.created_at)}`;
    }
    
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
  
  // 注入安全脚本 - 防止DevTools查看源码（白名单用户除外）
  const securityScript = `
<script>
(function() {
  var devtoolsOpen = false;
  var checkCount = 0;
  var threshold = 160;
  
  // 方法1: 窗口尺寸检测
  function checkWindowSize() {
    var widthDiff = window.outerWidth - window.innerWidth > threshold;
    var heightDiff = window.outerHeight - window.innerHeight > threshold;
    return widthDiff || heightDiff;
  }
  
  // 方法2: console对象getter检测
  function checkConsoleProfile() {
    var detected = false;
    var element = document.createElement('div');
    Object.defineProperty(element, 'id', {
      get: function() { detected = true; return ''; }
    });
    console.log(element);
    console.clear && console.clear();
    return detected;
  }
  
  // 方法3: Function toString检测
  function checkFunctionToString() {
    var detected = false;
    var func = function() {};
    func.toString = function() { detected = true; return ''; };
    console.log(func);
    console.clear && console.clear();
    return detected;
  }
  
  // 方法4: Image对象检测
  function checkImageLog() {
    var detected = false;
    var img = new Image();
    Object.defineProperty(img, 'id', {
      get: function() { detected = true; return 'dt-check'; }
    });
    console.log(img);
    console.clear && console.clear();
    return detected;
  }
  
  // 综合检测
  function detectDevTools() {
    return checkWindowSize() || checkConsoleProfile() || checkFunctionToString() || checkImageLog();
  }
  
  // 处理DevTools打开
  function handleDevToolsOpen() {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#1a1a2e;color:#fff;font-family:sans-serif;text-align:center;flex-direction:column;"><div style="font-size:64px;margin-bottom:20px;">🔒</div><h2 style="margin-bottom:10px;">检测到开发者工具</h2><p style="color:#888;">请关闭开发者工具后刷新页面</p><button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">刷新页面</button></div>';
    document.body.style.overflow = 'hidden';
  }
  
  // 阻止右键菜单
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  });
  
  // 阻止快捷键
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c'].indexOf(e.key) >= 0) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))) {
      e.preventDefault();
      return false;
    }
  });
  
  // 定期检测DevTools
  setInterval(function() {
    if (detectDevTools() && !devtoolsOpen) {
      checkCount++;
      if (checkCount >= 2) {
        devtoolsOpen = true;
        handleDevToolsOpen();
      }
    } else if (!detectDevTools()) {
      checkCount = 0;
    }
  }, 500);
})();
</script>`;

  // 仅在非白名单用户时注入安全脚本
  if (!window.YXJ_SECURITY?.isWhitelisted) {
    if (processedCode.includes('</head>')) {
      processedCode = processedCode.replace('</head>', securityScript + '</head>');
    } else if (processedCode.includes('<body')) {
      processedCode = processedCode.replace('<body', securityScript + '<body');
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

// 检查是否可以编辑游戏（作者或管理员），显示编辑按钮
async function checkIsAuthor(gameId) {
  const editBtn = document.getElementById('stat-edit-btn');
  const userToken = getUserToken();
  
  if (!editBtn || !userToken || !state.currentGame) {
    if (editBtn) editBtn.classList.remove('visible');
    return false;
  }
  
  try {
    // 调用后端API检查编辑权限（包括作者和管理员）
    const response = await fetch(`/api/games/${gameId}/can-edit`, {
      headers: { 'X-User-Token': userToken }
    });
    const data = await response.json();
    
    if (data.success && data.canEdit) {
      editBtn.classList.add('visible');
      // 如果是管理员编辑别人的游戏，可以在按钮上添加提示
      if (data.isAdmin && !data.isAuthor) {
        editBtn.title = '管理员编辑模式';
      } else {
        editBtn.title = '编辑游戏';
      }
      return true;
    } else {
      editBtn.classList.remove('visible');
      return false;
    }
  } catch (error) {
    console.error('[检查编辑权限] 错误:', error);
    // 降级处理：仅检查是否为作者
    const isAuthor = state.currentGame.author_token === userToken;
    if (isAuthor) {
      editBtn.classList.add('visible');
      return true;
    } else {
      editBtn.classList.remove('visible');
      return false;
    }
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
      headers: { 'X-User-Token': getUserToken() }
    });
    
    const data = await response.json();
    console.log('[点赞响应]', data);
    
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
      
      // 显示提示，如果有积分奖励则显示积分信息
      if (data.creditAwarded && data.creditMessage) {
        showToast(`感谢点赞！❤️ ${data.creditMessage}`, 'success');
        loadCredits(); // 刷新积分显示
      } else {
        showToast(data.liked ? '感谢点赞！❤️' : '已取消点赞', data.liked ? 'success' : 'info');
      }
    }
  } catch (error) {
    console.error('点赞失败:', error);
    showToast('操作失败，请重试', 'error');
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

// 分享游戏
function shareGame() {
  if (!state.currentGameId) {
    showToast('请先保存游戏', 'error');
    return;
  }
  
  // 使用带分享者信息的链接
  const url = generateShareUrl(state.currentGameId);
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
  console.log('[Toast]', message, type);
  const toast = document.getElementById('toast');
  if (!toast) {
    console.error('[Toast] 找不到 toast 元素');
    return;
  }
  toast.textContent = message;
  toast.className = 'toast active';
  if (type) {
    toast.classList.add(type);
  }
  
  setTimeout(() => {
    toast.classList.remove('active');
  }, 3000);
}

// 显示可点击跳转的成功提示
function showSuccessToastWithAction(message, actionText, onAction, duration = 5000) {
  // 移除已存在的成功提示
  const existingToast = document.getElementById('success-action-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.id = 'success-action-toast';
  toast.className = 'success-action-toast';
  toast.innerHTML = `
    <div class="success-toast-content" onclick="event.stopPropagation();">
      <div class="success-toast-icon">🎉</div>
      <div class="success-toast-text">
        <div class="success-toast-message">${escapeHtml(message)}</div>
        <div class="success-toast-action">${escapeHtml(actionText)}</div>
      </div>
      <button class="success-toast-close" onclick="event.stopPropagation(); this.closest('.success-action-toast').remove();">×</button>
    </div>
  `;
  
  // 点击主体区域触发操作
  toast.querySelector('.success-toast-content').addEventListener('click', (e) => {
    if (!e.target.classList.contains('success-toast-close')) {
      toast.remove();
      if (typeof onAction === 'function') {
        onAction();
      }
    }
  });
  
  document.body.appendChild(toast);
  
  // 触发动画
  requestAnimationFrame(() => {
    toast.classList.add('active');
  });
  
  // 自动消失
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('active');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }
  }, duration);
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
          <button class="btn btn-primary" onclick="useTrialModeInstead()" style="width: 100%; padding: 0.75rem;">
            🎁 清除 Key，使用游客模式
          </button>
          <button class="btn btn-secondary" onclick="openSettingsFromError()" style="width: 100%; padding: 0.75rem;">
            ⚙️ 去设置中修改 API Key
          </button>
          <button class="btn btn-ghost" onclick="closeApiKeyErrorModal()" style="width: 100%; padding: 0.5rem;">
            取消
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// 显示模型需要用户配置 API Key 的弹窗（后台未配置Key时）
// modelName: 模型显示名称, modelId: 模型ID（可选，用于跳转设置时预选）
function showNeedApiKeyForModelModal(modelName, modelId = null) {
  // 保存当前需要配置的模型ID，供跳转设置时使用
  window._pendingModelIdForSettings = modelId || getUserDefaultModel();
  
  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'need-model-key-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 450px;">
      <div class="modal-header">
        <h2>🔑 需要配置 API Key</h2>
        <button class="btn-close" onclick="closeNeedModelKeyModal()">×</button>
      </div>
      <div class="modal-body" style="text-align: center; padding: 1.5rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🔐</div>
        <p style="color: #fbbf24; margin-bottom: 0.75rem; font-size: 1rem; font-weight: bold;">
          ${escapeHtml(modelName)} 未配置默认 API Key
        </p>
        <p style="color: #94a3b8; margin-bottom: 1.5rem; font-size: 0.9rem; line-height: 1.6;">
          管理员尚未为此模型配置公共 API Key，<br>
          您需要在设置中配置自己的 API Key 才能使用。
        </p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button class="btn btn-primary" onclick="goToSettingsWithPendingModel();" style="width: 100%; padding: 0.75rem;">
            ⚙️ 去设置中配置我的 API KEY
          </button>
          <button class="btn btn-secondary" onclick="switchToAvailableModel()" style="width: 100%; padding: 0.75rem;">
            🔄 切换到其他可用模型
          </button>
          <button class="btn btn-ghost" onclick="closeNeedModelKeyModal()" style="width: 100%; padding: 0.5rem;">
            取消
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// 关闭模型需要 Key 弹窗
function closeNeedModelKeyModal() {
  const modal = document.getElementById('need-model-key-modal');
  if (modal) {
    modal.remove();
  }
}

// 切换到有可用 Key 的模型
function switchToAvailableModel() {
  closeNeedModelKeyModal();
  
  // 找到一个有默认 Key 的模型
  const availableModel = Object.entries(MODEL_REGISTRY).find(([id, info]) => {
    return id !== 'custom' && info.hasDefaultKey === true;
  });
  
  if (availableModel) {
    setUserDefaultModel(availableModel[0]);
    localStorage.setItem('aigame-settings', JSON.stringify(state.settings));
    showToast(`已切换到 ${availableModel[1].name}`, 'success');
    
    // 更新下拉框
    const modelSelect = document.getElementById('adv-llm-model');
    if (modelSelect) {
      modelSelect.value = availableModel[0];
    }
  } else {
    showToast('没有找到已配置 Key 的模型，请在设置中配置您的 API Key', 'error');
    openSettings();
  }
}

// 显示需要配置 API Key 的提示弹窗
function showNeedApiKeyModal(errorMsg, hint, provider) {
  // 关闭生成遮罩
  hideGeneratingOverlay();
  stopGeneratingTimer();
  hideTurboButton();
  state.isGenerating = false;
  document.getElementById('generating-float').classList.remove('active');
  
  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'need-api-key-modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 420px;">
      <div class="modal-header">
        <h2>🔑 需要配置 API Key</h2>
        <button class="btn-close" onclick="closeNeedApiKeyModal()">×</button>
      </div>
      <div class="modal-body" style="text-align: center; padding: 1.5rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🔐</div>
        <p style="color: #fbbf24; margin-bottom: 1rem; font-size: 0.95rem;">
          ${escapeHtml(errorMsg)}
        </p>
        <p style="color: #94a3b8; margin-bottom: 1.5rem; font-size: 0.85rem;">
          ${escapeHtml(hint || '请在设置中配置您的 API Key')}
        </p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button class="btn btn-primary" onclick="goToSettingsForApiKey()" style="width: 100%; padding: 0.75rem;">
            ⚙️ 去设置中配置 API Key
          </button>
          <button class="btn btn-secondary" onclick="switchToFreeModel()" style="width: 100%; padding: 0.75rem;">
            🆓 切换到免费模型 (DeepSeek)
          </button>
          <button class="btn btn-ghost" onclick="closeNeedApiKeyModal()" style="width: 100%; padding: 0.5rem;">
            取消
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// 关闭需要 API Key 弹窗
function closeNeedApiKeyModal() {
  const modal = document.getElementById('need-api-key-modal');
  if (modal) {
    modal.remove();
  }
}

// 去设置中配置 API Key
function goToSettingsForApiKey() {
  closeNeedApiKeyModal();
  openSettings();
}

// 去设置中配置 API Key（带预选模型，从创作界面弹窗调用）
function goToSettingsWithPendingModel() {
  const modelId = window._pendingModelIdForSettings;
  closeNeedModelKeyModal();
  openSettings(modelId);
  // 清理临时变量
  delete window._pendingModelIdForSettings;
}

// 去设置中配置指定模型的 API Key（从加速模型弹窗调用）
function goToSettingsForModel(modelId, modelName) {
  // 关闭加速模型弹窗
  closeTurboModal();
  
  // 显示提示
  showToast(`请配置 ${modelName} 的 API Key`, 'info');
  
  // 打开设置弹窗，并预选该模型
  openSettings(modelId);
}

// 切换到免费模型
function switchToFreeModel() {
  closeNeedApiKeyModal();
  // 设置为 DeepSeek V3（免费模型）
  setUserDefaultModel('deepseek-v3');
  localStorage.setItem('aigame-settings', JSON.stringify(state.settings));
  
  // 更新高级设置中的模型选择
  const advModelSelect = document.getElementById('adv-llm-model');
  if (advModelSelect) {
    advModelSelect.value = 'deepseek-v3';
  }
  
  showToast('已切换到 DeepSeek V3（免费模型）', 'success');
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
// @param {object} options - 可选配置
// @param {boolean} options.showChange - 是否显示积分变化提示
// @param {string} options.reason - 变化原因描述
async function loadCredits(options = {}) {
  try {
    const oldCredits = state.credits;
    
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
      
      // 如果启用了变化提示且积分有变化
      if (options.showChange && oldCredits !== undefined && oldCredits !== null) {
        const delta = data.credits - oldCredits;
        if (delta !== 0) {
          showCreditsChangeToast(delta, options.reason);
        }
      }
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
      if (reward) reward.textContent = '已完成';
    } else {
      wayWechat.classList.remove('completed');
    }
  }
  
  // 更新分享游戏、邀请好友、阅读文章的状态
  const { dailyCounts, extraConfig } = creditsData;
  
  if (dailyCounts && extraConfig) {
    // 分享游戏
    updateExtraWayStatus('share', dailyCounts.share, extraConfig.shareGame);
    // 邀请好友
    updateExtraWayStatus('invite', dailyCounts.invite, extraConfig.inviteFriend);
    // 阅读文章
    updateExtraWayStatus('article', dailyCounts.article, extraConfig.article);
  }
}

// 更新额外积分途径的状态
function updateExtraWayStatus(type, todayCount, config) {
  const wayEl = document.getElementById(`way-${type}`);
  const rewardEl = document.getElementById(`way-${type}-reward`);
  const progressEl = document.getElementById(`way-${type}-progress`);
  
  if (!wayEl) return;
  
  // 默认值
  const credits = config?.credits ?? 1;
  const dailyLimit = config?.dailyLimit ?? 5;
  const count = todayCount ?? 0;
  const isCompleted = count >= dailyLimit;
  
  // 更新样式
  if (isCompleted) {
    wayEl.classList.add('completed');
  } else {
    wayEl.classList.remove('completed');
  }
  
  // 更新奖励显示
  if (rewardEl) {
    rewardEl.textContent = isCompleted ? '已完成' : `+${credits}次`;
  }
  
  // 更新进度显示
  if (progressEl) {
    progressEl.textContent = `${count}/${dailyLimit}`;
    progressEl.style.display = dailyLimit > 0 ? 'block' : 'none';
  }
}

/**
 * 显示积分变动悬浮提示
 * @param {number} delta - 积分变动量（正数表示获得，负数表示消耗）
 * @param {string} reason - 变动原因描述（可选）
 */
function showCreditsChangeToast(delta, reason = '') {
  if (delta === 0) return;
  
  const formattedDelta = formatCredits(Math.abs(delta));
  let message = '';
  let type = '';
  
  if (delta > 0) {
    message = `💎 +${formattedDelta} 积分`;
    if (reason) message += `（${reason}）`;
    type = 'success';
  } else {
    message = `💎 -${formattedDelta} 积分`;
    if (reason) message += `（${reason}）`;
    type = 'info';
  }
  
  showToast(message, type);
}

// 更新积分显示（全局所有位置）
function updateCreditsDisplay() {
  const credits = state.credits;
  const formattedCredits = formatCredits(credits);
  
  // 底部导航积分
  const navCount = document.getElementById('nav-credits-count');
  if (navCount) navCount.textContent = formattedCredits;
  
  // 积分弹窗
  const modalCount = document.getElementById('credits-count');
  if (modalCount) modalCount.textContent = formattedCredits;
  
  // 创作页面积分
  const createCount = document.getElementById('create-credits-count');
  if (createCount) createCount.textContent = formattedCredits;
  
  // 个人中心积分
  const profileCredits = document.getElementById('profile-page-credits');
  if (profileCredits) profileCredits.textContent = formattedCredits;
  
  // 个人弹窗积分
  const profileModalCredits = document.getElementById('profile-credits');
  if (profileModalCredits) profileModalCredits.textContent = formattedCredits;
  
  // 设置页积分
  const profileCreditsValue = document.getElementById('profile-credits-value');
  if (profileCreditsValue) profileCreditsValue.textContent = formattedCredits;
  
  log(`积分显示已更新: ${formattedCredits}`, 'info');
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
    
    // 加载每日行为积分途径
    loadActionWays();
  });
}

// 加载每日行为积分途径
async function loadActionWays() {
  try {
    const userToken = getUserToken();
    const headers = {};
    if (userToken) {
      headers['x-user-token'] = userToken;
    }
    
    // 添加 cache: 'no-store' 确保每次都获取最新数据
    const response = await fetch('/api/credits/action-ways', { 
      headers,
      cache: 'no-store'
    });
    const data = await response.json();
    
    if (data.success && data.ways) {
      renderActionWays(data.ways);
    }
  } catch (error) {
    console.error('加载行为积分途径失败:', error);
  }
}

// 渲染每日行为积分途径
function renderActionWays(ways) {
  const container = document.getElementById('action-ways-container');
  if (!container) return;
  
  const order = ['like', 'favorite', 'comment', 'follow'];
  let html = '';
  
  for (const key of order) {
    const way = ways[key];
    if (!way || way.credits <= 0 || way.dailyLimit <= 0) continue;
    
    const remaining = Math.max(0, way.dailyLimit - way.todayCount);
    const isCompleted = remaining === 0;
    const statusClass = isCompleted ? 'completed' : '';
    const progressText = `${way.todayCount}/${way.dailyLimit}`;
    
    html += `
      <div class="credit-way ${statusClass}" onclick="goToGamesPage()">
        <div class="credit-way-icon">${way.icon}</div>
        <div class="credit-way-info">
          <div class="credit-way-title">${way.name}</div>
          <div class="credit-way-desc">${way.desc}</div>
        </div>
        <div class="credit-way-status">
          <div class="credit-way-reward">${isCompleted ? '已完成' : `+${way.credits}次`}</div>
          <div class="credit-way-progress">${progressText}</div>
        </div>
      </div>
    `;
  }
  
  if (html) {
    container.innerHTML = html;
  } else {
    container.innerHTML = '<div style="color:#888;text-align:center;padding:1rem;">暂无可用的互动奖励</div>';
  }
}

// 跳转到游戏广场
function goToGamesPage() {
  closeCreditsModal();
  window.location.href = '/games.html';
}

// 关闭积分弹窗
function closeCreditsModal() {
  closeModal('credits-modal');
}

// 通用的展开/收起区域函数
function toggleCreditWaySection(wayElement, sectionElement, otherSections = []) {
  const isHidden = sectionElement.style.display === 'none';
  
  // 先关闭其他展开区域
  otherSections.forEach(({ way, section }) => {
    if (section && section.style.display !== 'none') {
      section.style.display = 'none';
      if (way) way.classList.remove('expanded');
    }
  });
  
  // 切换当前区域
  if (isHidden) {
    sectionElement.style.display = 'block';
    if (wayElement) wayElement.classList.add('expanded');
    
    // 展开后自动滚动到可见位置
    setTimeout(() => {
      scrollToShowSection(sectionElement);
      // 添加高亮动画
      sectionElement.classList.add('highlight-animation');
      setTimeout(() => sectionElement.classList.remove('highlight-animation'), 1500);
    }, 50);
  } else {
    sectionElement.style.display = 'none';
    if (wayElement) wayElement.classList.remove('expanded');
  }
  
  return isHidden; // 返回是否展开了
}

// 滚动使展开区域完全可见
function scrollToShowSection(section) {
  const modalBody = section.closest('.modal-body');
  if (!modalBody) return;
  
  const sectionRect = section.getBoundingClientRect();
  const modalRect = modalBody.getBoundingClientRect();
  
  // 计算展开区域底部相对于modal可视区域的位置
  const sectionBottom = sectionRect.bottom;
  const modalBottom = modalRect.bottom;
  
  // 如果展开区域底部超出modal可视区域，需要滚动
  if (sectionBottom > modalBottom) {
    const scrollAmount = sectionBottom - modalBottom + 20; // 多滚动20px留出边距
    modalBody.scrollBy({
      top: scrollAmount,
      behavior: 'smooth'
    });
  } else if (sectionRect.top < modalRect.top) {
    // 如果展开区域顶部在可视区域之上，滚动到顶部可见
    const scrollAmount = sectionRect.top - modalRect.top - 20;
    modalBody.scrollBy({
      top: scrollAmount,
      behavior: 'smooth'
    });
  }
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
  const otherSections = [
    { way: document.getElementById('way-invite'), section: document.getElementById('invite-section') },
    { way: document.getElementById('way-article'), section: document.getElementById('article-code-section') }
  ];
  
  toggleCreditWaySection(wayWechat, section, otherSections);
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
  // 检查是否已达上限
  const wayShare = document.getElementById('way-share');
  if (wayShare && wayShare.classList.contains('completed')) {
    showToast('今日分享奖励已达上限', 'info');
    return;
  }
  
  if (!state.currentGameId) {
    showToast('请先创作并保存一个游戏', 'error');
    closeCreditsModal();
    return;
  }
  
  closeCreditsModal();
  shareGame();
}

// ==================== 文章验证码兑换 ====================

// 切换文章验证码输入区域
function toggleArticleCodeSection() {
  // 检查是否已达上限
  const wayArticle = document.getElementById('way-article');
  if (wayArticle && wayArticle.classList.contains('completed')) {
    showToast('今日阅读文章奖励已达上限', 'info');
    return;
  }
  
  const section = document.getElementById('article-code-section');
  const otherSections = [
    { way: document.getElementById('way-wechat'), section: document.getElementById('wechat-verify-section') },
    { way: document.getElementById('way-invite'), section: document.getElementById('invite-section') }
  ];
  
  toggleCreditWaySection(wayArticle, section, otherSections);
}

// 兑换文章验证码
async function redeemArticleCode() {
  const codeInput = document.getElementById('article-promo-code');
  const code = codeInput.value.trim();
  
  if (!code) {
    showToast('请输入验证码', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/credits/redeem-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      },
      body: JSON.stringify({ code })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(data.message, 'success');
      state.credits = data.credits;
      updateCreditsDisplay();
      codeInput.value = ''; // 清空输入
    } else {
      showToast(data.error || '兑换失败', 'error');
    }
  } catch (error) {
    console.error('兑换验证码失败:', error);
    showToast('兑换失败，请重试', 'error');
  }
}

// 检测URL中的文章推广参数并自动领取积分
async function checkArticlePromoFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const articleId = urlParams.get('a') || urlParams.get('article');
  
  if (!articleId) return;
  
  // 延迟执行，确保用户token已初始化
  setTimeout(async () => {
    try {
      const response = await fetch('/api/credits/article-visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Token': getUserToken()
        },
        body: JSON.stringify({ articleId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast(data.message, 'success');
        state.credits = data.credits;
        updateCreditsDisplay();
      } else if (data.alreadyClaimed) {
        // 已领取过，不显示错误提示
        log('文章福利已领取过', 'info');
      }
      
      // 清除URL中的参数，避免重复触发
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
      
    } catch (error) {
      console.error('文章福利领取失败:', error);
    }
  }, 1500);
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
  // 设置用户名（使用有效的作者名，排除默认值'游戏玩家'）
  const username = getEffectiveAuthorName();
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
  document.getElementById('profile-credits').textContent = formatCredits(state.credits || 0);
  document.getElementById('profile-credits-value').textContent = formatCredits(state.credits || 0);
  
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
  
  if (modelSelect) modelSelect.value = getUserDefaultModel();
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
  const selectedModel = modelSelect?.value || 'deepseek-v3';
  setUserDefaultModel(selectedModel);
  state.settings.llmApiKey = apiKeyInput?.value || '';
  state.settings.authorName = authorNameInput?.value || '';
  state.settings.debugMode = debugMode?.checked || false;
  state.settings.llmBaseUrl = baseUrlInput?.value || '';
  
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
  document.getElementById('profile-username').textContent = getEffectiveAuthorName();
  
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
            const isPrivate = game.visibility === 'private';
            return `
              <div class="my-game-item ${isPrivate ? 'private-game' : ''}" data-id="${game.id}">
                <div class="my-game-info">
                  <div class="my-game-title">
                    ${isPrivate ? '🔒' : ''} ${escapeHtml(game.title)}
                    ${isPrivate ? '<span class="private-badge">仅自己可见</span>' : ''}
                  </div>
                  <div class="my-game-prompt">${escapeHtml(game.prompt || '')}</div>
                  <div class="my-game-meta">
                    <span>▶️ ${game.play_count || 0}</span>
                    <span>❤️ ${game.like_count || 0}</span>
                    <span>💬 ${game.comment_count || 0}</span>
                    <span>📅 ${formatDate(game.created_at)}</span>
                  </div>
                </div>
                <div class="my-game-actions">
                  <button class="btn btn-small btn-primary" onclick="playMyGame('${game.id}')">
                    ▶️ 游玩
                  </button>
                  <button class="btn btn-small btn-secondary" onclick="toggleGameVisibility('${game.id}', '${game.visibility || 'public'}')" title="${isPrivate ? '设为公开' : '设为私密'}">
                    ${isPrivate ? '👁️ 公开' : '🔒 私密'}
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
              <span>💬 ${game.comment_count || 0}</span>
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
              <span>💬 ${game.comment_count || 0}</span>
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
      const statFavsCount = document.getElementById('stat-favs');
      if (statFavIcon) statFavIcon.textContent = data.favorited ? '⭐' : '☆';
      if (statFavBtn) statFavBtn.classList.toggle('favorited', data.favorited);
      // 更新收藏数量
      if (statFavsCount && data.favorite_count !== undefined) {
        statFavsCount.textContent = data.favorite_count;
      }
      
      // 显示提示，如果有积分奖励则显示积分信息
      if (data.creditAwarded && data.creditMessage) {
        showToast(`已添加到收藏 ⭐ ${data.creditMessage}`, 'success');
        loadCredits(); // 刷新积分显示
      } else {
        showToast(data.favorited ? '已添加到收藏 ⭐' : '已取消收藏', data.favorited ? 'success' : 'info');
      }
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

// ==================== 长按菜单功能 ====================

// 长按菜单状态
let longPressTimer = null;
let longPressTarget = null;
let longPressTriggered = false; // 标记是否触发了长按菜单
const LONG_PRESS_DURATION = 500; // 长按触发时间（毫秒）

// 初始化长按菜单事件
function initLongPressMenu(container) {
  if (!container) return;
  
  // 支持多种卡片类型
  const cards = container.querySelectorAll('.profile-game-card-h[data-game-id], .list-game-card[data-game-id]');
  cards.forEach(card => {
    // 移除旧的事件监听器（通过克隆节点）
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);
    
    // 保存原始的 onclick 处理
    const originalOnclick = newCard.getAttribute('onclick');
    newCard.removeAttribute('onclick');
    
    // 添加自定义点击处理（检查长按标志）
    newCard.addEventListener('click', function(e) {
      if (longPressTriggered) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // 执行原始的 onclick
      if (originalOnclick) {
        eval(originalOnclick);
      }
    });
    
    // 触摸开始
    newCard.addEventListener('touchstart', handleLongPressStart, { passive: true });
    newCard.addEventListener('touchend', handleLongPressEnd);
    newCard.addEventListener('touchmove', handleLongPressCancel);
    newCard.addEventListener('touchcancel', handleLongPressCancel);
    
    // 鼠标事件（桌面端）
    newCard.addEventListener('mousedown', handleLongPressStart);
    newCard.addEventListener('mouseup', handleLongPressEnd);
    newCard.addEventListener('mouseleave', handleLongPressCancel);
    
    // 右键菜单（桌面端替代方案）
    newCard.addEventListener('contextmenu', handleContextMenu);
  });
}

// 长按开始
function handleLongPressStart(e) {
  const card = e.currentTarget;
  const gameId = card.dataset.gameId;
  if (!gameId) return;
  
  longPressTriggered = false;
  longPressTarget = card;
  longPressTimer = setTimeout(() => {
    // 触发长按
    longPressTriggered = true;
    showGameActionMenu(card, e);
  }, LONG_PRESS_DURATION);
  
  // 添加按压效果
  card.classList.add('pressing');
}

// 长按结束
function handleLongPressEnd(e) {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  if (longPressTarget) {
    longPressTarget.classList.remove('pressing');
    longPressTarget = null;
  }
  
  // 如果触发了长按菜单，阻止后续的 click 事件
  if (longPressTriggered) {
    e.preventDefault();
    e.stopPropagation();
    // 延迟重置标志，确保 click 事件被阻止
    setTimeout(() => {
      longPressTriggered = false;
    }, 100);
  }
}

// 长按取消
function handleLongPressCancel() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  if (longPressTarget) {
    longPressTarget.classList.remove('pressing');
    longPressTarget = null;
  }
  longPressTriggered = false;
}

// 右键菜单处理（桌面端）
function handleContextMenu(e) {
  e.preventDefault();
  const card = e.currentTarget;
  if (card.dataset.gameId) {
    showGameActionMenu(card, e);
  }
}

// 显示游戏操作菜单
function showGameActionMenu(card, event) {
  const gameId = card.dataset.gameId;
  const gameTitle = card.dataset.gameTitle;
  const visibility = card.dataset.gameVisibility || 'public';
  const isPrivate = visibility === 'private';
  
  // 阻止点击事件
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  // 清除长按状态
  handleLongPressCancel();
  
  // 震动反馈（如果支持）
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }
  
  // 创建或获取菜单
  let menu = document.getElementById('game-action-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'game-action-menu';
    menu.className = 'game-action-menu';
    menu.innerHTML = `
      <div class="action-menu-overlay" onclick="closeGameActionMenu()"></div>
      <div class="action-menu-content">
        <div class="action-menu-header">
          <span class="action-menu-title">游戏操作</span>
          <button class="action-menu-close" onclick="closeGameActionMenu()">×</button>
        </div>
        <div class="action-menu-items"></div>
        <div class="action-menu-cancel" onclick="closeGameActionMenu()">取消</div>
      </div>
    `;
    document.body.appendChild(menu);
  }
  
  // 设置菜单项
  const menuItems = menu.querySelector('.action-menu-items');
  menuItems.innerHTML = `
    <button class="action-menu-item" onclick="openGameEditor('${gameId}'); closeGameActionMenu();">
      <span class="action-icon">✏️</span>
      <span class="action-text">高级编辑</span>
    </button>
    <button class="action-menu-item" onclick="toggleGameVisibility('${gameId}', '${visibility}'); closeGameActionMenu();">
      <span class="action-icon">${isPrivate ? '🔓' : '🔒'}</span>
      <span class="action-text">${isPrivate ? '设为公开' : '设为私密'}</span>
    </button>
    <button class="action-menu-item action-danger" onclick="deleteMyGame('${gameId}', '${gameTitle}'); closeGameActionMenu();">
      <span class="action-icon">🗑️</span>
      <span class="action-text">删除游戏</span>
    </button>
  `;
  
  // 更新标题
  menu.querySelector('.action-menu-title').textContent = gameTitle || '游戏操作';
  
  // 显示菜单
  menu.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// 关闭游戏操作菜单
function closeGameActionMenu() {
  const menu = document.getElementById('game-action-menu');
  if (menu) {
    menu.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// 删除我的游戏
async function deleteMyGame(gameId, title) {
  // 使用自定义确认弹窗
  showConfirmDialog(
    '删除游戏',
    `确定要删除游戏「${title}」吗？\n\n删除后将无法在公开列表显示，但管理员仍可查看。`,
    async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`, {
          method: 'DELETE',
          headers: { 'X-Author-Token': getAuthorToken() }
        });
        const data = await response.json();
        
        if (data.success) {
          showToast('游戏已删除', 'success');
          // 刷新列表页面（如果打开的话）
          if (document.getElementById('game-list-page').classList.contains('active')) {
            loadGameListData(true);
          }
          loadProfilePageData(); // 刷新个人页
          loadHomeSections(); // 刷新首页
        } else {
          showToast(data.error || '删除失败', 'error');
        }
      } catch (error) {
        console.error('删除游戏失败:', error);
        showToast('删除失败', 'error');
      }
    },
    '删除',
    'danger'
  );
}

// 切换游戏可见性
async function toggleGameVisibility(gameId, currentVisibility) {
  const newVisibility = currentVisibility === 'public' ? 'private' : 'public';
  const actionText = newVisibility === 'private' ? '设为仅自己可见' : '设为公开';
  const confirmText = newVisibility === 'private' 
    ? '设为私密后，其他人将无法看到这个游戏。确定继续吗？'
    : '设为公开后，所有人都可以看到这个游戏。确定继续吗？';
  
  showConfirmDialog(
    actionText,
    confirmText,
    async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Author-Token': getAuthorToken()
          },
          body: JSON.stringify({ visibility: newVisibility })
        });
        const data = await response.json();
        
        if (data.success) {
          showToast(newVisibility === 'private' ? '已设为仅自己可见' : '已设为公开', 'success');
          // 刷新列表页面（如果打开的话）
          if (document.getElementById('game-list-page').classList.contains('active')) {
            loadGameListData(true);
          }
          loadProfilePageData(); // 刷新个人页
          loadHomeSections(); // 刷新首页
        } else {
          showToast(data.error || '设置失败', 'error');
        }
      } catch (error) {
        console.error('设置可见性失败:', error);
        showToast('设置失败', 'error');
      }
    }
  );
}

// 显示确认对话框
function showConfirmDialog(title, message, onConfirm, confirmText = '确定', confirmType = 'primary') {
  // 创建或获取确认对话框元素
  let dialog = document.getElementById('confirm-dialog');
  if (!dialog) {
    dialog = document.createElement('div');
    dialog.id = 'confirm-dialog';
    dialog.className = 'modal';
    dialog.innerHTML = `
      <div class="modal-content modal-small">
        <div class="modal-header">
          <h3 id="confirm-dialog-title">确认</h3>
          <button class="btn btn-icon btn-close" onclick="closeConfirmDialog()">×</button>
        </div>
        <div class="modal-body">
          <p id="confirm-dialog-message" style="margin: 1rem 0; line-height: 1.6; white-space: pre-wrap;"></p>
        </div>
        <div class="modal-footer" style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="closeConfirmDialog()">取消</button>
          <button class="btn" id="confirm-dialog-btn">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
  }
  
  // 设置内容
  document.getElementById('confirm-dialog-title').textContent = title;
  document.getElementById('confirm-dialog-message').textContent = message;
  
  const confirmBtn = document.getElementById('confirm-dialog-btn');
  confirmBtn.textContent = confirmText;
  confirmBtn.className = `btn btn-${confirmType}`;
  
  // 绑定确认事件
  confirmBtn.onclick = () => {
    closeConfirmDialog();
    if (onConfirm) onConfirm();
  };
  
  // 显示对话框
  dialog.classList.add('active');
}

// 关闭确认对话框
function closeConfirmDialog() {
  const dialog = document.getElementById('confirm-dialog');
  if (dialog) {
    dialog.classList.remove('active');
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
  
  // 新版设置页面的自定义接口区域
  const customApiGroup = document.getElementById('custom-api-group');
  
  // 旧版设置弹窗的元素（兼容）
  const baseUrlGroup = document.getElementById('base-url-group');
  const customModelGroup = document.getElementById('custom-model-group');
  const modelHint = document.getElementById('model-hint');
  
  if (modelId === 'custom') {
    if (customApiGroup) customApiGroup.style.display = 'block';
    if (baseUrlGroup) baseUrlGroup.style.display = 'block';
    if (customModelGroup) customModelGroup.style.display = 'block';
    if (modelHint) modelHint.textContent = '输入自定义的 API 地址和模型名称';
  } else {
    if (customApiGroup) customApiGroup.style.display = 'none';
    if (baseUrlGroup) baseUrlGroup.style.display = 'none';
    if (customModelGroup) customModelGroup.style.display = 'none';
    
    // 从模型注册表获取提示信息
    const modelConfig = MODEL_REGISTRY[modelId];
    if (modelHint) {
      modelHint.textContent = modelConfig?.hint || '选择适合的 AI 模型';
    }
  }
  
  // 保存选择到 settings（使用统一函数）
  setUserDefaultModel(modelId);
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

// 首次成功生成游戏时触发邀请奖励
async function triggerReferralReward() {
  // 检查是否已触发过（使用本地标记防止重复调用）
  const rewardKey = `yxj_referral_rewarded_${state.account.accountId}`;
  if (localStorage.getItem(rewardKey)) {
    return; // 已经触发过
  }
  
  try {
    const response = await fetch('/api/referral/reward', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Account-Id': state.account.accountId || ''
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.rewarded) {
      // 奖励发放成功
      showToast(data.message, 'success', 5000);
      // 刷新积分显示
      await loadCredits();
      updateCreditsDisplay();
      // 标记已触发
      localStorage.setItem(rewardKey, '1');
      console.log('[REFERRAL] 邀请奖励已发放:', data);
    } else if (data.success) {
      // 无需奖励（无邀请关系或已奖励）
      localStorage.setItem(rewardKey, '1'); // 标记已处理
      console.log('[REFERRAL] 无需发放奖励:', data.reason);
    }
  } catch (error) {
    console.error('[REFERRAL] 触发邀请奖励失败:', error);
  }
}

// 处理URL中的邀请和分享参数
async function handleReferralParams() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // 处理邀请链接 (?ref=XXXXXXXX)
  // 新逻辑：只记录邀请关系，首次成功生成游戏时才发放奖励
  const refCode = urlParams.get('ref');
  if (refCode) {
    try {
      // 确保账户已初始化
      if (!state.account.accountId) {
        await initAccount();
      }
      
      const response = await fetch('/api/referral/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Account-Id': state.account.accountId || ''
        },
        body: JSON.stringify({ inviterCode: refCode })
      });
      const data = await response.json();
      
      if (data.success && data.recorded) {
        // 邀请关系记录成功，提示用户
        showToast('🎁 邀请链接已生效！首次成功生成游戏后双方各得1积分', 'info', 5000);
      } else if (data.alreadyRecorded) {
        // 已有邀请关系，不提示
        console.log('[REFERRAL] 已有邀请关系，跳过');
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
  // 检查是否已达上限
  const wayInvite = document.getElementById('way-invite');
  if (wayInvite && wayInvite.classList.contains('completed')) {
    showToast('今日邀请好友奖励已达上限，但你仍可分享链接', 'info');
    // 继续执行，允许用户查看链接，只是不会获得积分
  }
  
  const section = document.getElementById('invite-section');
  const otherSections = [
    { way: document.getElementById('way-wechat'), section: document.getElementById('wechat-verify-section') },
    { way: document.getElementById('way-article'), section: document.getElementById('article-code-section') }
  ];
  
  const expanded = toggleCreditWaySection(wayInvite, section, otherSections);
  
  // 如果展开了，加载邀请链接
  if (expanded) {
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
  animateStatValue('stat-favs', stats.favoriteCount || stats.favorites || 0);
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
      
      // 显示提示，如果有积分奖励则显示积分信息
      if (data.creditAwarded && data.creditMessage) {
        showToast(`关注成功 ✨ ${data.creditMessage}`, 'success');
        loadCredits(); // 刷新积分显示
      } else {
        showToast(data.following ? '关注成功 ✨' : '已取消关注', data.following ? 'success' : 'info');
      }
      
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

// 用户主页作品分页状态
let userProfileGamesState = {
  games: [],
  displayedCount: 6,
  pageSize: 6
};

// ====== 弹窗层级管理器 ======
// 基础层级（高于所有固定 UI 元素）
const modalZIndexManager = {
  baseZIndex: 1000000,
  currentZIndex: 1000000,
  modalStack: [], // 弹窗栈，用于追踪打开的弹窗
  
  // 获取下一个层级（打开新弹窗时调用）
  getNextZIndex: function(modalId) {
    this.currentZIndex += 10;
    this.modalStack.push({ id: modalId, zIndex: this.currentZIndex });
    return this.currentZIndex;
  },
  
  // 移除弹窗（关闭弹窗时调用）
  removeModal: function(modalId) {
    const index = this.modalStack.findIndex(m => m.id === modalId);
    if (index > -1) {
      this.modalStack.splice(index, 1);
    }
    // 如果没有弹窗了，重置层级
    if (this.modalStack.length === 0) {
      this.currentZIndex = this.baseZIndex;
    }
  },
  
  // 重置（关闭所有弹窗时调用）
  reset: function() {
    this.currentZIndex = this.baseZIndex;
    this.modalStack = [];
  }
};

// 用户主页弹窗计数器
let userProfileModalCounter = 0;

// 打开用户主页弹窗
async function openUserProfile(userToken) {
  if (!userToken) return;

  // 如果是自己，跳转到我的页面
  if (userToken === getUserToken()) {
    closeFollowModal();
    switchBottomNav('profile');
    return;
  }

  // 生成唯一的弹窗ID（支持多层嵌套）
  userProfileModalCounter++;
  const modalId = 'user-profile-modal-' + userProfileModalCounter;

  const modal = document.createElement('div');
  modal.className = 'modal active user-profile-modal-instance';
  modal.id = modalId;
  modal.style.zIndex = modalZIndexManager.getNextZIndex(modalId);
  modal.onclick = (e) => { if (e.target === modal) closeUserProfileModalById(modalId); };

  modal.innerHTML = `
    <div class="modal-content modal-medium">
      <div class="modal-header">
        <h3>👤 用户主页</h3>
        <button class="btn btn-icon btn-close" onclick="closeUserProfileModalById('${modalId}')">×</button>
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

    // 保存作品数据用于滚动加载
    userProfileGamesState.games = games;
    userProfileGamesState.displayedCount = 6;

    // 优先使用profile API返回的昵称
    const nickname = profileData.success && profileData.profile?.nickname
      ? profileData.profile.nickname
      : (games.length > 0 ? (games[0].author_name || '游戏家用户') : '游戏家用户');
    // 获取账号ID
    const accountId = profileData.success && profileData.profile?.accountId
      ? profileData.profile.accountId
      : `player_${userToken.substring(0, 6)}`;
    const gamesCount = profileData.success ? profileData.profile?.gamesCount : games.length;
    const likesCount = profileData.success ? profileData.profile?.likesCount : 0;

    const modalBody = modal.querySelector('.user-profile-body');
    modalBody.innerHTML = `
      <div class="user-profile-header">
        <div class="user-profile-avatar">${getAvatarEmoji(userToken)}</div>
        <div class="user-profile-info">
          <div class="user-profile-name">${escapeHtml(nickname)}</div>
          <div class="user-profile-account">@${escapeHtml(accountId)}</div>
          <div class="user-profile-stats">
            <span class="user-stat-item" onclick="openFollowModalFromProfile('${userToken}', 'following')">
              <strong>${following}</strong> 关注
            </span>
            <span class="user-stat-divider">|</span>
            <span class="user-stat-item" onclick="openFollowModalFromProfile('${userToken}', 'followers')">
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
        <div class="user-games-scroll-container" id="user-games-scroll-container">
          ${games.length > 0 ? `
            <div class="user-games-grid" id="user-games-grid">
              ${games.slice(0, 6).map(game => `
                <div class="user-game-card" onclick="closeUserProfileModal(); openGame('${game.id}')">
                  <div class="user-game-emoji">${getGameEmoji(game.title)}</div>
                  <div class="user-game-title">${escapeHtml(game.title)}</div>
                  <div class="user-game-stats">
                    <span>🎮 ${formatNumber(game.play_count || 0)}</span>
                    <span>❤️ ${formatNumber(game.like_count || 0)}</span>
                    <span>💬 ${formatNumber(game.comment_count || 0)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
            ${games.length > 6 ? `<div class="user-games-load-more" id="user-games-load-more">下拉加载更多作品...</div>` : ''}
          ` : '<div class="user-games-empty">暂无作品</div>'}
        </div>
      </div>
    `;

    // 添加滚动加载更多功能
    if (games.length > 6) {
      const scrollContainer = document.getElementById('user-games-scroll-container');
      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleUserGamesScroll);
      }
    }
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

// 处理作品列表滚动加载
function handleUserGamesScroll(e) {
  const container = e.target;
  const { scrollTop, scrollHeight, clientHeight } = container;
  
  // 接近底部时加载更多
  if (scrollHeight - scrollTop - clientHeight < 50) {
    loadMoreUserGames();
  }
}

// 加载更多作品
function loadMoreUserGames() {
  const { games, displayedCount, pageSize } = userProfileGamesState;
  if (displayedCount >= games.length) return;

  const grid = document.getElementById('user-games-grid');
  const loadMoreEl = document.getElementById('user-games-load-more');
  if (!grid) return;

  const newCount = Math.min(displayedCount + pageSize, games.length);
  const newGames = games.slice(displayedCount, newCount);

  newGames.forEach(game => {
    const card = document.createElement('div');
    card.className = 'user-game-card';
    card.onclick = () => { closeUserProfileModal(); openGame(game.id); };
    card.innerHTML = `
      <div class="user-game-emoji">${getGameEmoji(game.title)}</div>
      <div class="user-game-title">${escapeHtml(game.title)}</div>
      <div class="user-game-stats">
        <span>🎮 ${formatNumber(game.play_count || 0)}</span>
        <span>❤️ ${formatNumber(game.like_count || 0)}</span>
        <span>💬 ${formatNumber(game.comment_count || 0)}</span>
      </div>
    `;
    grid.appendChild(card);
  });

  userProfileGamesState.displayedCount = newCount;

  // 隐藏加载更多提示
  if (newCount >= games.length && loadMoreEl) {
    loadMoreEl.style.display = 'none';
  }
}

// 从用户主页打开关注弹窗（确保层级正确）
async function openFollowModalFromProfile(userToken, tab) {
  // 先关闭用户主页弹窗
  closeUserProfileModal();
  // 延迟打开关注弹窗，确保关闭动画完成
  setTimeout(() => {
    openFollowModal(userToken, tab);
  }, 100);
}

// 根据ID关闭指定的用户主页弹窗
function closeUserProfileModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
    modalZIndexManager.removeModal(modalId);
    // 只有在没有其他弹窗时才移除 modal-open 类
    if (modalZIndexManager.modalStack.length === 0) {
      document.body.classList.remove('modal-open');
    }
  }
}

// 关闭最顶层的用户主页弹窗（向后兼容）
function closeUserProfileModal() {
  const modals = document.querySelectorAll('.user-profile-modal-instance');
  if (modals.length > 0) {
    const lastModal = modals[modals.length - 1];
    closeUserProfileModalById(lastModal.id);
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
// 游戏高级编辑功能
// =============================================

// 编辑会话状态
let editSession = {
  gameId: null,
  sessionId: null,
  currentCode: null,
  originalCode: null,  // 原始代码，用于检测未保存修改
  messages: [],
  suggestions: [],
  isEditing: false,
  isProcessing: false,  // 是否正在等待AI编辑请求返回
  abortController: null,  // 用于取消正在进行的请求
  hasUnsavedChanges: false  // 是否有未保存的修改
};

// 编辑器设置
let editorSettings = {
  autoSave: localStorage.getItem('editor-auto-save') !== 'false',  // 默认开启自动保存
  selectedModel: null  // 编辑器使用的模型，null表示使用全局设置
};

// 加载编辑器设置
function loadEditorSettings() {
  const saved = localStorage.getItem('editor-settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      editorSettings = { ...editorSettings, ...parsed };
    } catch (e) {
      console.error('加载编辑器设置失败:', e);
    }
  }
}

// 保存编辑器设置
function saveEditorSettings() {
  localStorage.setItem('editor-settings', JSON.stringify(editorSettings));
  localStorage.setItem('editor-auto-save', editorSettings.autoSave ? 'true' : 'false');
}

// 打开游戏编辑器
async function openGameEditor(gameId) {
  showToast('正在准备编辑器...', 'info');
  
  // 如果有正在进行的生成任务，自动最小化
  if (state.isGenerating && !backgroundTask.isMinimized) {
    minimizeGenerating();
  }
  
  // 加载编辑器设置
  loadEditorSettings();
  
  try {
    // 调用开始编辑 API
    const response = await fetch(`/api/games/${gameId}/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      },
      body: JSON.stringify({ action: 'start' })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      showToast(data.error || '无法编辑此游戏', 'error');
      return;
    }
    
    const originalCode = data.game?.code || '';
    
    // 初始化编辑会话
    editSession = {
      gameId: gameId,
      sessionId: data.sessionId,
      currentCode: originalCode,
      originalCode: originalCode,  // 保存原始代码用于检测修改
      messages: [{
        role: 'assistant',
        content: `🎮 游戏「${data.game?.title || ''}」已加载完成！\n\n我分析了这个游戏，发现以下可以优化的方向：`
      }],
      suggestions: data.suggestions || [],
      isEditing: true,
      isProcessing: false,
      abortController: null,
      hasUnsavedChanges: false
    };
    
    // 显示编辑页面
    showGameEditorPage(data.game, data.suggestions);
    
  } catch (error) {
    console.error('打开编辑器失败:', error);
    showToast('网络错误，请稍后重试', 'error');
  }
}

// 显示游戏编辑页面
function showGameEditorPage(game, suggestions) {
  // 隐藏其他页面
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('bottom-nav').style.display = 'none';
  
  // 创建或获取编辑页面
  let editorPage = document.getElementById('game-editor-page');
  if (!editorPage) {
    editorPage = document.createElement('div');
    editorPage.id = 'game-editor-page';
    editorPage.className = 'page active';
    document.body.appendChild(editorPage);
  }
  
  // 计算积分消耗信息
  const editorCreditInfo = getEditorCreditInfo();
  const creditNoticeHtml = editorCreditInfo.isFree 
    ? `<div class="chat-credit-notice free"><span class="credit-icon">🆓</span><span class="credit-text">${editorCreditInfo.message}</span></div>`
    : `<div class="chat-credit-notice cost"><span class="credit-icon">💎</span><span class="credit-text">${editorCreditInfo.message}</span><span class="credit-balance">余额: ${formatCredits(state.credits)}</span></div>`;
  
  // 渲染编辑页面内容
  editorPage.innerHTML = `
    <div class="editor-header">
      <button class="btn-back" onclick="closeGameEditor()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <div class="editor-title">
        <span class="editor-title-text">${escapeHtml(game?.title || '游戏编辑')}</span>
        <span class="editor-status">编辑中</span>
      </div>
      <div class="editor-actions">
        <button class="btn-editor-settings" onclick="showEditorSettingsModal()" title="编辑器设置">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button class="btn-editor-save" onclick="showEditorSaveOptions()">保存</button>
      </div>
    </div>
    
    <div class="editor-preview-section">
      <div class="editor-preview-container" id="editor-preview-container">
        <!-- 游戏代码将直接内嵌到这里，不使用 iframe -->
        <div class="editor-preview-loading" id="editor-preview-loading" style="display: none;">
          <div class="spinner"></div>
          <span>正在生成预览...</span>
        </div>
      </div>
    </div>
    
    <div class="editor-suggestions-section">
      <div class="suggestions-label">💡 AI 建议：</div>
      <div class="suggestions-scroll">
        ${suggestions.map(s => `<button class="suggestion-tag" onclick="applySuggestion('${escapeHtml(s)}')">${escapeHtml(s)}</button>`).join('')}
      </div>
    </div>
    
    <div class="editor-chat-section">
      <div class="chat-messages" id="editor-chat-messages">
        <div class="chat-message assistant">
          <div class="chat-avatar">🤖</div>
          <div class="chat-bubble">
            🎮 游戏「${escapeHtml(game?.title || '')}」已加载完成！
            ${creditNoticeHtml}
          </div>
        </div>
      </div>
    </div>
    
    <div class="editor-input-section">
      <div class="editor-input-wrapper">
        <textarea id="editor-input" placeholder="描述你想要的修改，如：添加背景音乐、增加难度选择..." rows="1" oninput="autoResizeEditorInput(this)"></textarea>
        <button class="btn-send-edit" id="btn-send-edit" onclick="handleEditorSendClick()">
          <svg id="send-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
          <svg id="cancel-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display:none">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  editorPage.classList.add('active');
  
  // 加载预览
  updateEditorPreview(editSession.currentCode);
}

// 获取编辑器积分消耗信息
function getEditorCreditInfo() {
  const selectedModel = getUserDefaultModel();
  const modelInfo = MODEL_REGISTRY[selectedModel];
  const userHasKey = (state.settings.llmApiKey && state.settings.llmApiKey.trim().length > 0);
  const backendHasKey = modelInfo?.hasDefaultKey === true;
  const modelCreditCost = modelInfo?.creditCost || 1;
  const modelName = modelInfo?.name || selectedModel;
  
  if (userHasKey) {
    return {
      isFree: true,
      creditCost: 0,
      message: '使用自己的 API Key，点击发送免费编辑'
    };
  } else if (backendHasKey) {
    if (modelCreditCost > 0) {
      return {
        isFree: false,
        creditCost: modelCreditCost,
        message: `点击发送执行编辑，每次消耗 ${modelCreditCost} 积分（${modelName}）`
      };
    } else {
      return {
        isFree: true,
        creditCost: 0,
        message: `点击发送免费编辑（${modelName}）`
      };
    }
  } else {
    return {
      isFree: false,
      creditCost: 0,
      message: '当前模型需要配置 API Key'
    };
  }
}

// 更新编辑器积分提示（更新聊天气泡内的提示）
function updateEditorCreditNotice() {
  const chatMessages = document.getElementById('editor-chat-messages');
  if (!chatMessages) return;
  
  // 找到第一条 AI 消息中的积分提示
  const firstAssistantBubble = chatMessages.querySelector('.chat-message.assistant .chat-bubble');
  if (!firstAssistantBubble) return;
  
  const existingNotice = firstAssistantBubble.querySelector('.chat-credit-notice');
  if (!existingNotice) return;
  
  const editorCreditInfo = getEditorCreditInfo();
  existingNotice.className = `chat-credit-notice ${editorCreditInfo.isFree ? 'free' : 'cost'}`;
  existingNotice.innerHTML = editorCreditInfo.isFree 
    ? `<span class="credit-icon">🆓</span><span class="credit-text">${editorCreditInfo.message}</span>`
    : `<span class="credit-icon">💎</span><span class="credit-text">${editorCreditInfo.message}</span><span class="credit-balance">余额: ${formatCredits(state.credits)}</span>`;
}

// 显示编辑器模型选择弹窗
async function showEditorModelSelector() {
  // 复用现有的 turbo-modal
  const modal = document.getElementById('turbo-modal');
  const listContainer = document.getElementById('turbo-models-list');
  
  if (!modal || !listContainer) {
    showToast('模型选择器未加载', 'error');
    return;
  }
  
  // 获取可用的模型
  const models = await fetchTurboModels();
  
  if (models.length === 0) {
    showToast('暂无可用的模型', 'error');
    return;
  }
  
  // 判断用户是否有自己的 Key
  const userHasKey = state.settings.llmApiKey && state.settings.llmApiKey.trim().length > 0;
  
  // 获取当前选中的模型
  const currentModelId = getUserDefaultModel();
  
  // 渲染模型列表
  listContainer.innerHTML = models.map(model => {
    const backendHasKey = model.hasDefaultKey === true;
    const isSelected = model.id === currentModelId;
    
    // 显示积分或免费标识
    let costDisplay = '';
    
    if (userHasKey) {
      costDisplay = `
        <div class="turbo-model-cost free">
          <div class="turbo-model-cost-value" style="color: #10b981;">🆓 免费</div>
          <div class="turbo-model-cost-label" style="color: #94a3b8;">使用您的Key</div>
        </div>
      `;
    } else if (backendHasKey) {
      if (model.creditCost > 0) {
        costDisplay = `
          <div class="turbo-model-cost">
            <div class="turbo-model-cost-value">${model.creditCost}</div>
            <div class="turbo-model-cost-label">积分</div>
          </div>
        `;
      } else {
        costDisplay = `
          <div class="turbo-model-cost free">
            <div class="turbo-model-cost-value" style="color: #10b981;">🆓 免费</div>
            <div class="turbo-model-cost-label" style="color: #94a3b8;">0积分</div>
          </div>
        `;
      }
    } else {
      costDisplay = `
        <div class="turbo-model-cost free needs-key">
          <div class="turbo-model-cost-value" style="font-size: 0.8rem; color: #f59e0b;">🔑 需配Key</div>
          <div class="turbo-model-cost-label" style="color: #94a3b8;">点击配置</div>
        </div>
      `;
    }
    
    // 判断点击行为
    const needsKeySetup = !userHasKey && !backendHasKey;
    const onClickAction = needsKeySetup 
      ? `goToSettingsForModel('${model.id}', '${model.name}')`
      : `selectEditorModel('${model.id}')`;
    
    // 根据后台配置的速度等级获取显示信息
    const speedInfo = getSpeedInfo(model.speedLevel || 'normal');
    
    return `
      <div class="turbo-model-item ${model.turboRecommended ? 'recommended' : ''} ${needsKeySetup ? 'needs-key-setup' : ''} ${isSelected ? 'selected' : ''}" 
           onclick="${onClickAction}"
           ${needsKeySetup ? 'title="点击配置API Key"' : ''}>
        <div class="turbo-model-info">
          <div class="turbo-model-name">${model.name}${isSelected ? ' ✓' : ''}</div>
          <div class="turbo-model-meta">
            <span class="turbo-model-speed ${speedInfo.className}">${speedInfo.icon} ${speedInfo.label}</span>
            <span class="turbo-model-quality">质量: ${getQualityLabelText(model.quality)}</span>
          </div>
        </div>
        ${costDisplay}
      </div>
    `;
  }).join('');
  
  // 更新弹窗标题和描述
  const modalHeader = modal.querySelector('.modal-header h3');
  const modalDesc = modal.querySelector('.turbo-modal-desc');
  const modalWarning = modal.querySelector('.turbo-warning');
  
  if (modalHeader) modalHeader.textContent = '🤖 选择AI模型';
  if (modalDesc) modalDesc.textContent = '选择用于编辑游戏的AI模型';
  if (modalWarning) modalWarning.style.display = 'none';
  
  modal.classList.add('active');
}

// 选择编辑器使用的模型
function selectEditorModel(modelId) {
  const modelInfo = MODEL_REGISTRY[modelId];
  if (!modelInfo) {
    showToast('模型信息未找到', 'error');
    return;
  }
  
  // 更新设置中的模型（使用统一函数）
  setUserDefaultModel(modelId);
  
  // 保存设置
  localStorage.setItem('aigame-settings', JSON.stringify(state.settings));
  
  // 更新编辑器头部的模型显示
  updateEditorModelDisplay(modelInfo.name || modelId);
  
  // 更新积分提示
  updateEditorCreditNotice();
  
  // 关闭弹窗
  closeTurboModal();
  
  showToast(`已切换到 ${modelInfo.name || modelId}`, 'success');
}

// 更新编辑器模型显示
function updateEditorModelDisplay(modelName) {
  const modelNameEl = document.getElementById('editor-current-model');
  if (modelNameEl) {
    modelNameEl.textContent = modelName;
  }
}

// 更新编辑器预览（使用内嵌方式，不使用 iframe）
function updateEditorPreview(code) {
  const container = document.getElementById('editor-preview-container');
  if (!container || !code) return;
  
  // 保存游戏代码
  editSession.currentCode = code;
  
  // 从游戏代码中提取 head 和 body 内容
  let headContent = '';
  let bodyContent = code;
  let bodyAttrs = '';
  
  // 提取 <head> 内容
  const headMatch = code.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    headContent = headMatch[1];
  }
  
  // 提取 <body> 内容和属性
  const bodyMatch = code.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    bodyAttrs = bodyMatch[1] || '';
    bodyContent = bodyMatch[2];
  }
  
  // 清空容器，但保留 loading 元素
  const loadingEl = container.querySelector('.editor-preview-loading');
  container.innerHTML = '';
  if (loadingEl) {
    container.appendChild(loadingEl);
  }
  
  // 创建游戏内容容器
  const gameWrapper = document.createElement('div');
  gameWrapper.id = 'editor-game-wrapper';
  gameWrapper.className = 'editor-game-wrapper';
  
  // 处理 body 属性中的样式
  const styleMatch = bodyAttrs.match(/style\s*=\s*["']([^"']*)["']/i);
  if (styleMatch) {
    gameWrapper.setAttribute('style', styleMatch[1]);
  }
  
  // 处理 body 的 class
  const classMatch = bodyAttrs.match(/class\s*=\s*["']([^"']*)["']/i);
  if (classMatch) {
    gameWrapper.className += ' ' + classMatch[1];
  }
  
  // 创建样式容器（从 head 中提取样式）
  const styleContainer = document.createElement('div');
  styleContainer.id = 'editor-game-styles';
  
  // 提取并处理 style 标签，添加作用域前缀
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch2;
  while ((styleMatch2 = styleRegex.exec(headContent)) !== null) {
    const styleEl = document.createElement('style');
    // 给所有选择器添加作用域前缀，避免影响编辑器 UI
    let scopedStyles = styleMatch2[1];
    // 简单处理：在容器内的样式会自然隔离
    styleEl.textContent = scopedStyles;
    styleContainer.appendChild(styleEl);
  }
  
  // 也处理 body 内的 style 标签
  const bodyStyleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let bodyStyleContent = bodyContent;
  while ((styleMatch2 = bodyStyleRegex.exec(bodyContent)) !== null) {
    const styleEl = document.createElement('style');
    styleEl.textContent = styleMatch2[1];
    styleContainer.appendChild(styleEl);
  }
  // 移除 body 中的 style 标签，避免重复
  bodyStyleContent = bodyContent.replace(bodyStyleRegex, '');
  
  // 设置游戏内容
  gameWrapper.innerHTML = bodyStyleContent;
  
  // 添加到容器
  container.insertBefore(styleContainer, container.firstChild);
  container.insertBefore(gameWrapper, styleContainer.nextSibling);
  
  // 执行脚本
  // 从 head 和 body 中提取 script 标签并执行
  const scripts = [];
  
  // 提取 head 中的脚本
  const headScriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = headScriptRegex.exec(headContent)) !== null) {
    if (scriptMatch[1].trim()) {
      scripts.push(scriptMatch[1]);
    }
  }
  
  // 提取 body 中的脚本
  const bodyScriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  while ((scriptMatch = bodyScriptRegex.exec(bodyContent)) !== null) {
    if (scriptMatch[1].trim()) {
      scripts.push(scriptMatch[1]);
    }
  }
  
  // 延迟执行脚本，确保 DOM 已经渲染
  setTimeout(() => {
    scripts.forEach((scriptContent, index) => {
      try {
        // 使用 Function 构造函数执行脚本，避免污染全局作用域
        const scriptFn = new Function(scriptContent);
        scriptFn();
      } catch (e) {
        console.warn(`编辑器预览脚本 ${index + 1} 执行出错:`, e.message);
      }
    });
    
    // 触发 DOMContentLoaded 和 load 事件
    try {
      document.dispatchEvent(new Event('DOMContentLoaded'));
      window.dispatchEvent(new Event('load'));
    } catch (e) {
      console.warn('触发事件出错:', e.message);
    }
  }, 100);
}

// 自动调整输入框高度
function autoResizeEditorInput(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// 应用建议
function applySuggestion(suggestion) {
  const input = document.getElementById('editor-input');
  if (input) {
    input.value = suggestion;
    input.focus();
    autoResizeEditorInput(input);
  }
}

// 获取编辑器使用的 LLM 配置（与生成游戏时保持一致）
function getEditorLLMConfig() {
  // 优先使用编辑器设置中选择的模型，否则使用全局设置
  const selectedModelId = editorSettings.selectedModel || getUserDefaultModel();
  
  const llmConfig = {
    provider: selectedModelId,  // 传递 modelId，后端会从 LLM_MODELS 获取完整配置
    apiKey: state.settings.llmApiKey || ''  // 用户自己的Key（如果有）
  };
  
  // 如果是自定义接口，需要传递完整配置
  if (selectedModelId === 'custom') {
    llmConfig.baseUrl = state.settings.llmBaseUrl;
    llmConfig.model = state.settings.llmModel;
  }
  
  return llmConfig;
}

// 处理编辑器发送/取消按钮点击
function handleEditorSendClick() {
  if (editSession.isProcessing) {
    // 正在处理中，执行取消操作
    cancelEditorRequest();
  } else {
    // 未处理，执行发送操作
    sendEditMessage();
  }
}

// 取消编辑器请求
async function cancelEditorRequest() {
  // 先中断前端请求
  if (editSession.abortController) {
    editSession.abortController.abort();
    editSession.abortController = null;
  }
  
  // 通知后端取消 LLM 请求
  if (editSession.sessionId) {
    try {
      await fetch('/api/cancel-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Token': getUserToken()
        },
        body: JSON.stringify({ sessionId: editSession.sessionId })
      });
      console.log('已通知后端取消编辑请求');
    } catch (e) {
      console.warn('通知后端取消编辑请求失败:', e);
    }
  }
  
  console.log('用户取消了编辑请求');
  showToast('已取消编辑请求', 'info');
}

// 更新发送按钮状态（发送/取消切换）
function updateEditorSendButton(isProcessing) {
  const sendBtn = document.getElementById('btn-send-edit');
  const sendIcon = document.getElementById('send-icon');
  const cancelIcon = document.getElementById('cancel-icon');
  
  if (!sendBtn) return;
  
  if (isProcessing) {
    // 切换为取消按钮
    sendBtn.classList.add('canceling');
    sendBtn.title = '取消请求';
    if (sendIcon) sendIcon.style.display = 'none';
    if (cancelIcon) cancelIcon.style.display = 'block';
  } else {
    // 切换为发送按钮
    sendBtn.classList.remove('canceling');
    sendBtn.title = '发送';
    if (sendIcon) sendIcon.style.display = 'block';
    if (cancelIcon) cancelIcon.style.display = 'none';
  }
}

// 发送编辑消息
async function sendEditMessage() {
  const input = document.getElementById('editor-input');
  const message = input?.value?.trim();
  
  if (!message) {
    showToast('请输入修改需求', 'error');
    return;
  }
  
  if (!editSession.sessionId) {
    showToast('编辑会话已过期，请重新进入', 'error');
    return;
  }
  
  // 获取 LLM 配置（后端会处理 API Key，如果用户没配置则使用系统默认）
  const llmConfig = getEditorLLMConfig();
  
  // 检查积分（编辑也需要消耗积分，规则与生成游戏一致）
  const selectedModel = llmConfig.provider || getUserDefaultModel();
  const modelInfo = MODEL_REGISTRY[selectedModel];
  const userHasKey = (state.settings.llmApiKey && state.settings.llmApiKey.trim().length > 0);
  const backendHasKey = modelInfo?.hasDefaultKey === true;
  const modelCreditCost = modelInfo?.creditCost || 1;
  
  // 计算本次编辑需要的积分
  let creditCostThisTime = 0;
  if (userHasKey) {
    // 用户有自己的 Key，免费
    creditCostThisTime = 0;
  } else if (backendHasKey) {
    // 使用后台 Key，消耗积分
    creditCostThisTime = modelCreditCost;
  } else {
    // 没有可用的 Key
    showToast('当前模型需要配置 API Key', 'error');
    return;
  }
  
  // 检查积分是否足够
  if (creditCostThisTime > 0 && state.credits < creditCostThisTime) {
    openNoCreditsModal();
    return;
  }
  
  // 显示积分提示
  if (creditCostThisTime > 0) {
    showToast(`💎 本次编辑将消耗 ${creditCostThisTime} 积分`, 'info');
  }
  
  // 清空输入框
  input.value = '';
  autoResizeEditorInput(input);
  
  // 添加用户消息到聊天
  appendEditorMessage('user', message);
  
  // 显示加载状态
  const loadingEl = document.getElementById('editor-preview-loading');
  if (loadingEl) loadingEl.style.display = 'flex';
  
  // 添加 AI 思考中提示
  const thinkingMsgId = appendEditorMessage('assistant', '🤔 AI 正在分析并修改游戏代码...');
  
  // 标记正在处理中，并创建 AbortController
  editSession.isProcessing = true;
  editSession.abortController = new AbortController();
  
  // 更新发送按钮为取消按钮
  updateEditorSendButton(true);
  
  try {
    const response = await fetch(`/api/games/${editSession.gameId}/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      },
      body: JSON.stringify({
        action: 'message',
        sessionId: editSession.sessionId,
        message: message,
        llmConfig: llmConfig
      }),
      signal: editSession.abortController.signal
    });
    
    const data = await response.json();
    
    // 移除思考中提示
    removeEditorMessage(thinkingMsgId);
    
    if (data.success) {
      // 更新当前代码
      editSession.currentCode = data.code;
      editSession.hasUnsavedChanges = true;  // 标记有未保存的修改
      
      // 更新预览
      updateEditorPreview(data.code);
      
      // 显示 AI 回复
      let replyContent = `✅ ${data.message || '修改完成！'}`;
      if (data.changes && data.changes.length > 0) {
        replyContent += '\n\n修改内容：\n' + data.changes.map(c => `• ${c}`).join('\n');
      }
      appendEditorMessage('assistant', replyContent);
      
      // 编辑成功后，刷新积分并更新提示
      if (creditCostThisTime > 0) {
        state.credits = Math.max(0, state.credits - creditCostThisTime);
        updateCreditsDisplay();
        updateEditorCreditNotice();
        showCreditsChangeToast(-creditCostThisTime, '编辑游戏');
      }
      
      // 检查是否启用了自动保存
      if (editorSettings.autoSave) {
        autoSaveEditorGame();
      }
      
    } else {
      appendEditorMessage('assistant', `❌ ${data.error || '修改失败，请重试'}`);
    }
    
  } catch (error) {
    // 检查是否是用户主动取消
    if (error.name === 'AbortError') {
      console.log('编辑请求已被用户取消');
      removeEditorMessage(thinkingMsgId);
      // 不显示错误消息，因为是用户主动取消的
    } else {
      console.error('发送编辑消息失败:', error);
      removeEditorMessage(thinkingMsgId);
      appendEditorMessage('assistant', '❌ 网络错误，请检查网络后重试');
    }
  } finally {
    // 标记处理完成，清理 AbortController
    editSession.isProcessing = false;
    editSession.abortController = null;
    
    // 恢复发送按钮状态
    updateEditorSendButton(false);
    
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

// 添加编辑器消息
let editorMsgCounter = 0;
function appendEditorMessage(role, content) {
  const chatContainer = document.getElementById('editor-chat-messages');
  if (!chatContainer) return null;
  
  const msgId = `editor-msg-${++editorMsgCounter}`;
  const msgDiv = document.createElement('div');
  msgDiv.id = msgId;
  msgDiv.className = `chat-message ${role}`;
  
  const avatar = role === 'user' ? '👤' : '🤖';
  msgDiv.innerHTML = `
    <div class="chat-avatar">${avatar}</div>
    <div class="chat-bubble">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
  `;
  
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  return msgId;
}

// 移除编辑器消息
function removeEditorMessage(msgId) {
  if (!msgId) return;
  const msgEl = document.getElementById(msgId);
  if (msgEl) msgEl.remove();
}

// 显示保存选项
function showEditorSaveOptions() {
  // 创建保存选项弹窗
  let saveModal = document.getElementById('editor-save-modal');
  if (saveModal) saveModal.remove();
  
  saveModal = document.createElement('div');
  saveModal.id = 'editor-save-modal';
  saveModal.className = 'modal active';
  saveModal.onclick = (e) => {
    if (e.target === saveModal) saveModal.remove();
  };
  
  saveModal.innerHTML = `
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h3>💾 保存游戏</h3>
        <button class="btn btn-icon btn-close" onclick="document.getElementById('editor-save-modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="save-options">
          <button class="save-option-btn" onclick="saveGameEdit(false)">
            <span class="save-option-icon">📝</span>
            <span class="save-option-text">
              <strong>更新原游戏</strong>
              <small>覆盖现有版本</small>
            </span>
          </button>
          <button class="save-option-btn" onclick="showSaveAsNewDialog()">
            <span class="save-option-icon">🆕</span>
            <span class="save-option-text">
              <strong>另存为新游戏</strong>
              <small>保留原版，创建副本</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(saveModal);
}

// 显示另存为新游戏对话框
function showSaveAsNewDialog() {
  const saveModal = document.getElementById('editor-save-modal');
  if (!saveModal) return;
  
  saveModal.querySelector('.modal-content').innerHTML = `
    <div class="modal-header">
      <h3>🆕 另存为新游戏</h3>
      <button class="btn btn-icon btn-close" onclick="document.getElementById('editor-save-modal').remove()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>新游戏标题</label>
        <input type="text" id="new-game-title" placeholder="输入新游戏的标题" value="">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="showEditorSaveOptions()">返回</button>
      <button class="btn btn-primary" onclick="saveGameEdit(true)">保存</button>
    </div>
  `;
}

// 保存游戏编辑
async function saveGameEdit(saveAsNew) {
  const saveModal = document.getElementById('editor-save-modal');
  
  let newTitle = '';
  if (saveAsNew) {
    const titleInput = document.getElementById('new-game-title');
    newTitle = titleInput?.value?.trim();
    if (!newTitle) {
      showToast('请输入新游戏标题', 'error');
      return;
    }
  }
  
  showToast('正在保存...', 'info');
  
  try {
    const response = await fetch(`/api/games/${editSession.gameId}/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': getUserToken()
      },
      body: JSON.stringify({
        action: 'save',
        sessionId: editSession.sessionId,
        saveAsNew: saveAsNew,
        title: newTitle
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(data.message || '保存成功！', 'success');
      if (saveModal) saveModal.remove();
      
      // 关闭编辑器
      closeGameEditor();
      
      // 保存后跳转到游戏详情页（完整的URL，包含平台UI）
      const gameId = saveAsNew ? data.gameId : editSession.gameId;
      if (gameId) {
        // 跳转到游戏详情页（不是静态HTML页面）
        setTimeout(() => {
          window.location.href = `/game/${gameId}`;
        }, 500);
      } else {
        // 刷新相关页面
        loadProfilePageData();
        loadHomeSections();
      }
      
    } else {
      showToast(data.error || '保存失败', 'error');
    }
    
  } catch (error) {
    console.error('保存游戏失败:', error);
    showToast('网络错误，请稍后重试', 'error');
  }
}

// 关闭游戏编辑器
function closeGameEditor() {
  // 检查是否正在处理AI编辑请求
  if (editSession.isProcessing) {
    showEditorProcessingConfirm();
    return;
  }
  
  // 检查是否有未保存的修改
  if (editSession.hasUnsavedChanges || 
      (editSession.currentCode && editSession.originalCode && 
       editSession.currentCode !== editSession.originalCode)) {
    showEditorUnsavedConfirm();
    return;
  }
  
  // 执行实际的关闭操作
  doCloseGameEditor();
}

// 显示正在处理中确认对话框
function showEditorProcessingConfirm() {
  let confirmModal = document.getElementById('editor-processing-modal');
  if (confirmModal) confirmModal.remove();
  
  confirmModal = document.createElement('div');
  confirmModal.id = 'editor-processing-modal';
  confirmModal.className = 'modal active';
  confirmModal.onclick = (e) => {
    if (e.target === confirmModal) confirmModal.remove();
  };
  
  confirmModal.innerHTML = `
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h3>⏳ AI 正在处理中</h3>
        <button class="btn btn-icon btn-close" onclick="document.getElementById('editor-processing-modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: 1rem;">
          AI 正在处理您的编辑请求，现在退出将丢失本次修改结果。确定要退出吗？
        </p>
      </div>
      <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="document.getElementById('editor-processing-modal').remove()">继续等待</button>
        <button class="btn btn-danger" onclick="forceCloseGameEditor()">强制退出</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(confirmModal);
}

// 强制关闭编辑器（即使正在处理中）
async function forceCloseGameEditor() {
  const confirmModal = document.getElementById('editor-processing-modal');
  if (confirmModal) confirmModal.remove();
  
  // 取消正在进行的 LLM 请求（前端）
  if (editSession.abortController) {
    editSession.abortController.abort();
    editSession.abortController = null;
  }
  
  // 通知后端取消 LLM 请求
  if (editSession.sessionId) {
    try {
      await fetch('/api/cancel-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Token': getUserToken()
        },
        body: JSON.stringify({ sessionId: editSession.sessionId })
      });
      console.log('已通知后端取消编辑器 LLM 请求');
    } catch (e) {
      console.warn('通知后端取消失败:', e);
    }
  }
  
  // 重置所有状态
  editSession.isProcessing = false;
  editSession.hasUnsavedChanges = false;
  editSession.currentCode = editSession.originalCode;
  
  doCloseGameEditor();
}

// 显示未保存修改确认对话框
function showEditorUnsavedConfirm() {
  let confirmModal = document.getElementById('editor-unsaved-modal');
  if (confirmModal) confirmModal.remove();
  
  confirmModal = document.createElement('div');
  confirmModal.id = 'editor-unsaved-modal';
  confirmModal.className = 'modal active';
  confirmModal.onclick = (e) => {
    if (e.target === confirmModal) confirmModal.remove();
  };
  
  confirmModal.innerHTML = `
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h3>💾 有未保存的修改</h3>
        <button class="btn btn-icon btn-close" onclick="document.getElementById('editor-unsaved-modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: 1rem;">
          您对游戏的修改尚未保存，是否要保存？
        </p>
      </div>
      <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn btn-ghost" onclick="discardEditorChanges()">不保存</button>
        <button class="btn btn-secondary" onclick="document.getElementById('editor-unsaved-modal').remove()">继续编辑</button>
        <button class="btn btn-primary" onclick="saveAndCloseEditor()">保存</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(confirmModal);
}

// 放弃修改并关闭编辑器
function discardEditorChanges() {
  const confirmModal = document.getElementById('editor-unsaved-modal');
  if (confirmModal) confirmModal.remove();
  
  // 强制关闭
  editSession.hasUnsavedChanges = false;
  editSession.currentCode = editSession.originalCode;
  doCloseGameEditor();
}

// 保存并关闭编辑器
function saveAndCloseEditor() {
  const confirmModal = document.getElementById('editor-unsaved-modal');
  if (confirmModal) confirmModal.remove();
  
  // 显示保存选项
  showEditorSaveOptions();
}

// 执行实际的关闭编辑器操作
function doCloseGameEditor() {
  const editorPage = document.getElementById('game-editor-page');
  if (editorPage) {
    // 完全移除编辑器页面，避免残留内容显示
    editorPage.remove();
  }
  
  // 重置编辑会话
  editSession = {
    gameId: null,
    sessionId: null,
    currentCode: null,
    originalCode: null,
    messages: [],
    suggestions: [],
    isEditing: false,
    isProcessing: false,
    abortController: null,
    hasUnsavedChanges: false
  };
  
  // 处理生成遮罩状态：如果没有正在进行的生成任务，确保遮罩被隐藏
  if (!state.isGenerating) {
    hideGeneratingOverlay();
    // 同时隐藏浮动条
    const floatEl = document.getElementById('generating-float');
    if (floatEl) floatEl.classList.remove('active');
  }
  
  // 先隐藏所有页面，避免页面叠加
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // 返回个人页
  document.getElementById('profile-page').classList.add('active');
  document.getElementById('bottom-nav').style.display = 'flex';
  
  // 更新底部导航状态
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === 'profile');
  });
  
  // 刷新个人页数据
  loadProfilePageData();
}

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
    toggleBtn.textContent = '⛶';
    toggleBtn.title = '退出全屏';
  }
  
  // 更新侧边栏全屏图标
  const tiktokIcon = document.getElementById('tiktok-fullscreen-icon');
  if (tiktokIcon) {
    tiktokIcon.textContent = '⛶';
  }
  
  // 隐藏底部导航栏
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.style.display = 'none';
  }
  
  // 隐藏设置按钮
  const settingsBtn = document.getElementById('profile-settings-btn');
  if (settingsBtn) {
    settingsBtn.style.display = 'none';
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
  
  // 更新侧边栏全屏图标
  const tiktokIcon = document.getElementById('tiktok-fullscreen-icon');
  if (tiktokIcon) {
    tiktokIcon.textContent = '⛶';
  }
  
  // 恢复底部导航栏
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.style.display = '';
  }
  
  // 恢复设置按钮
  const settingsBtn = document.getElementById('profile-settings-btn');
  if (settingsBtn) {
    settingsBtn.style.display = '';
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

// ==================== 游戏留言板功能 ====================

// 留言板状态
let commentsState = {
  gameId: null,
  comments: [],
  total: 0,
  offset: 0,
  hasMore: false,
  isLoading: false,
  isExpanded: false  // 新增：评论区是否展开
};

// 初始化留言板（游戏页面加载时调用）
async function initComments(gameId) {
  console.log('[DEBUG] 初始化留言板, gameId:', gameId);
  
  if (!gameId) {
    console.log('[DEBUG] 无效的 gameId，跳过留言板初始化');
    return;
  }
  
  commentsState.gameId = gameId;
  commentsState.comments = [];
  commentsState.offset = 0;
  commentsState.hasMore = false;
  
  // 显示留言板区域
  const section = document.getElementById('comments-section');
  console.log('[DEBUG] 留言板区域元素:', section);
  if (section) {
    section.style.display = 'block';
    console.log('[DEBUG] 留言板区域已设置为显示');
  } else {
    console.log('[DEBUG] 未找到留言板区域元素 #comments-section');
  }
  
  // 根据登录状态显示输入区域或登录提示
  updateCommentInputUI();
  
  // 加载留言列表
  try {
    await loadComments(true);
    console.log('[DEBUG] 留言加载完成, total:', commentsState.total);
  } catch (err) {
    console.error('[DEBUG] 留言加载失败:', err);
  }
}

// 更新留言输入区域UI
function updateCommentInputUI() {
  const loginHint = document.getElementById('comment-login-hint');
  const inputArea = document.getElementById('comment-input-area');
  
  if (!loginHint || !inputArea) return;
  
  const userToken = localStorage.getItem('user_token');
  
  if (userToken) {
    loginHint.style.display = 'none';
    inputArea.style.display = 'flex';
  } else {
    loginHint.style.display = 'block';
    inputArea.style.display = 'none';
  }
}

// 加载留言列表
async function loadComments(isRefresh = false) {
  if (commentsState.isLoading) return;
  if (!commentsState.gameId) return;
  
  commentsState.isLoading = true;
  
  try {
    const userToken = localStorage.getItem('user_token') || '';
    const limit = 20;
    const offset = isRefresh ? 0 : commentsState.offset;
    
    const response = await fetch(`/api/games/${commentsState.gameId}/comments?limit=${limit}&offset=${offset}`, {
      headers: {
        'X-User-Token': userToken
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      if (isRefresh) {
        commentsState.comments = data.comments;
        commentsState.offset = data.comments.length;
      } else {
        commentsState.comments = [...commentsState.comments, ...data.comments];
        commentsState.offset += data.comments.length;
      }
      
      commentsState.total = data.total;
      commentsState.hasMore = data.hasMore;
      
      renderComments();
      updateCommentsCount();
    }
  } catch (error) {
    console.error('加载留言失败:', error);
  } finally {
    commentsState.isLoading = false;
  }
}

// 加载更多留言
async function loadMoreComments() {
  if (!commentsState.hasMore || commentsState.isLoading) return;
  await loadComments(false);
}

// 渲染留言列表
function renderComments() {
  const listEl = document.getElementById('comments-list');
  const loadMoreEl = document.getElementById('comments-load-more');
  
  if (!listEl) return;
  
  if (commentsState.comments.length === 0) {
    listEl.innerHTML = `
      <div class="comments-empty">
        <div class="comments-empty-icon">💬</div>
        <div class="comments-empty-text">还没有留言，快来抢沙发！</div>
      </div>
    `;
    if (loadMoreEl) loadMoreEl.style.display = 'none';
    return;
  }
  
  let html = '';
  commentsState.comments.forEach(comment => {
    const timeStr = formatCommentTime(comment.created_at);
    const avatarInitial = comment.author_name ? comment.author_name.charAt(0).toUpperCase() : '?';
    const userToken = comment.user_token || '';
    const clickableClass = userToken ? 'comment-clickable' : '';
    const onClickAttr = userToken ? `onclick="openUserProfile('${userToken}')"` : '';
    
    html += `
      <div class="comment-item" data-id="${comment.id}">
        <div class="comment-header">
          <div class="comment-author-info">
            <div class="comment-avatar ${clickableClass}" ${onClickAttr}>${avatarInitial}</div>
            <span class="comment-author-name ${clickableClass}" ${onClickAttr}>${escapeHtml(comment.author_name)}</span>
            <span class="comment-time">${timeStr}</span>
          </div>
          <div class="comment-actions">
            ${comment.is_mine ? `<button class="comment-delete-btn" onclick="deleteComment(${comment.id})">删除</button>` : ''}
          </div>
        </div>
        <div class="comment-content">${escapeHtml(comment.content)}</div>
      </div>
    `;
  });
  
  listEl.innerHTML = html;
  
  // 显示/隐藏加载更多按钮
  if (loadMoreEl) {
    loadMoreEl.style.display = commentsState.hasMore ? 'flex' : 'none';
  }
}

// 更新留言数量显示
function updateCommentsCount() {
  const countEl = document.getElementById('comments-count');
  if (countEl) {
    countEl.textContent = `(${commentsState.total})`;
  }
}

// 格式化留言时间
function formatCommentTime(dateStr) {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 发布留言
async function submitComment() {
  const inputEl = document.getElementById('comment-input');
  const submitBtn = document.getElementById('comment-submit-btn');
  
  if (!inputEl || !submitBtn) return;
  
  const content = inputEl.value.trim();
  
  if (!content) {
    showToast('请输入留言内容', 'error');
    return;
  }
  
  if (content.length > 500) {
    showToast('留言内容不能超过500字', 'error');
    return;
  }
  
  const userToken = localStorage.getItem('user_token');
  if (!userToken) {
    showToast('请先登录', 'error');
    showLoginModal();
    return;
  }
  
  // 禁用按钮
  submitBtn.disabled = true;
  submitBtn.textContent = '发布中...';
  
  try {
    const response = await fetch(`/api/games/${commentsState.gameId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': userToken
      },
      body: JSON.stringify({ content })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 清空输入框
      inputEl.value = '';
      
      // 添加新留言到列表顶部
      commentsState.comments.unshift(data.comment);
      commentsState.total++;
      
      renderComments();
      updateCommentsCount();
      
      // 显示提示，如果有积分奖励则显示积分信息
      if (data.creditAwarded && data.creditMessage) {
        showToast(`留言发布成功！${data.creditMessage}`, 'success');
        loadCredits(); // 刷新积分显示
      } else {
        showToast('留言发布成功', 'success');
      }
    } else {
      showToast(data.error || '发布失败', 'error');
    }
  } catch (error) {
    console.error('发布留言失败:', error);
    showToast('网络错误，请重试', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '发布';
  }
}

// 删除留言
async function deleteComment(commentId) {
  if (!confirm('确定要删除这条留言吗？')) return;
  
  const userToken = localStorage.getItem('user_token');
  if (!userToken) {
    showToast('请先登录', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/games/${commentsState.gameId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'X-User-Token': userToken
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 从列表中移除
      commentsState.comments = commentsState.comments.filter(c => c.id !== commentId);
      commentsState.total--;
      
      renderComments();
      updateCommentsCount();
      
      showToast('留言已删除', 'success');
    } else {
      showToast(data.error || '删除失败', 'error');
    }
  } catch (error) {
    console.error('删除留言失败:', error);
    showToast('网络错误，请重试', 'error');
  }
}

// 显示登录弹窗
function showLoginModal() {
  // 调用现有的登录对话框函数
  if (typeof showLoginDialog === 'function') {
    showLoginDialog();
  } else {
    // 跳转到我的页面触发登录
    switchBottomNav('profile');
  }
}

// 隐藏留言板（离开游戏页面时）
function hideComments() {
  const section = document.getElementById('comments-section');
  if (section) {
    section.style.display = 'none';
  }
  
  // 恢复游戏按钮显示
  setGameButtonsVisibility(true);
  
  // 重置状态
  commentsState = {
    gameId: null,
    comments: [],
    total: 0,
    offset: 0,
    hasMore: false,
    isLoading: false,
    isExpanded: false
  };
}

// 切换评论区展开/收起
function toggleCommentsExpand() {
  commentsState.isExpanded = !commentsState.isExpanded;
  
  const section = document.getElementById('comments-section');
  if (section) {
    if (commentsState.isExpanded) {
      // 展开评论区
      section.classList.add('expanded');
      // 隐藏游戏按钮
      setGameButtonsVisibility(false);
      // 滚动到评论区
      setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      // 收起评论区
      section.classList.remove('expanded');
      // 显示游戏按钮
      setGameButtonsVisibility(true);
    }
  }
  
  // 更新切换按钮状态
  updateCommentsToggleBtn();
}

// 展开评论区
function expandComments() {
  if (!commentsState.isExpanded) {
    toggleCommentsExpand();
  }
}

// 收起评论区
function collapseComments() {
  if (commentsState.isExpanded) {
    toggleCommentsExpand();
  }
}

// 设置游戏按钮可见性
function setGameButtonsVisibility(visible) {
  const sidebar = document.getElementById('tiktok-sidebar');
  const authorInfo = document.getElementById('tiktok-author-info');
  const promoFloat = document.getElementById('game-promo-float');
  const fullscreenBtns = document.getElementById('fullscreen-floating-btns');
  
  const displayValue = visible ? '' : 'none';
  
  if (sidebar) sidebar.style.display = displayValue;
  if (authorInfo) authorInfo.style.display = displayValue;
  if (promoFloat) promoFloat.style.display = displayValue;
  // 全屏按钮在评论展开时也隐藏
  if (fullscreenBtns && !isGameFullscreen) {
    fullscreenBtns.style.display = displayValue;
  }
}

// 更新评论区切换按钮状态
function updateCommentsToggleBtn() {
  const toggleBtn = document.getElementById('comments-toggle-btn');
  if (toggleBtn) {
    if (commentsState.isExpanded) {
      toggleBtn.innerHTML = '收起 ▲';
      toggleBtn.classList.add('expanded');
    } else {
      toggleBtn.innerHTML = '展开 ▼';
      toggleBtn.classList.remove('expanded');
    }
  }
}

// 扩展原有的 loadGameById 函数，加载游戏后初始化留言板
const origLoadGameByIdForComments = loadGameById;
loadGameById = async function(gameId) {
  await origLoadGameByIdForComments(gameId);
  
  // 初始化留言板
  await initComments(gameId);
};

// 扩展 showHome 函数，隐藏留言板
const origShowHomeForComments = showHome;
if (typeof showHome === 'function') {
  showHome = function() {
    hideComments();
    return origShowHomeForComments.apply(this, arguments);
  };
}

// =============================================
// 编辑器设置功能
// =============================================

// 显示编辑器设置弹窗
function showEditorSettingsModal() {
  let settingsModal = document.getElementById('editor-settings-modal');
  if (settingsModal) settingsModal.remove();
  
  settingsModal = document.createElement('div');
  settingsModal.id = 'editor-settings-modal';
  settingsModal.className = 'modal active';
  settingsModal.onclick = (e) => {
    if (e.target === settingsModal) settingsModal.remove();
  };
  
  // 获取当前模型信息
  const currentModelId = editorSettings.selectedModel || getUserDefaultModel();
  const autoSaveChecked = editorSettings.autoSave ? 'checked' : '';
  
  // 构建模型选择列表
  let modelOptionsHtml = '';
  const models = Object.keys(MODEL_REGISTRY).filter(id => id !== 'custom');
  models.forEach(modelId => {
    const model = MODEL_REGISTRY[modelId];
    if (!model) return;
    const isSelected = modelId === currentModelId ? 'selected' : '';
    let displayName = model.name;
    if (modelId === serverDefaultModel) {
      displayName += ' 🌟';
    }
    modelOptionsHtml += `<option value="${modelId}" ${isSelected}>${displayName}</option>`;
  });
  // 添加自定义选项
  modelOptionsHtml += `<option value="custom" ${currentModelId === 'custom' ? 'selected' : ''}>🔧 自定义接口</option>`;
  
  settingsModal.innerHTML = `
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h3>⚙️ 编辑器设置</h3>
        <button class="btn btn-icon btn-close" onclick="document.getElementById('editor-settings-modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="editor-model-select">🤖 AI 模型</label>
          <select id="editor-model-select" class="form-control">
            ${modelOptionsHtml}
          </select>
          <p class="form-hint">选择用于编辑游戏的 AI 模型</p>
        </div>
        
        <div class="form-group">
          <label class="toggle-label">
            <input type="checkbox" id="editor-auto-save" ${autoSaveChecked}>
            <span class="toggle-text">🔄 自动保存</span>
          </label>
          <p class="form-hint">编辑后自动保存修改到原游戏</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('editor-settings-modal').remove()">取消</button>
        <button class="btn btn-primary" onclick="saveEditorSettingsFromModal()">保存设置</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(settingsModal);
}

// 从弹窗保存编辑器设置
function saveEditorSettingsFromModal() {
  const modelSelect = document.getElementById('editor-model-select');
  const autoSaveCheckbox = document.getElementById('editor-auto-save');
  
  if (modelSelect) {
    const newModelId = modelSelect.value;
    editorSettings.selectedModel = newModelId;
    
    console.log('[EditorSettings] 编辑器模型已切换为:', newModelId);
  }
  
  if (autoSaveCheckbox) {
    editorSettings.autoSave = autoSaveCheckbox.checked;
  }
  
  // 保存设置到本地存储
  saveEditorSettings();
  
  // 关闭弹窗
  const modal = document.getElementById('editor-settings-modal');
  if (modal) modal.remove();
  
  showToast('编辑器设置已保存', 'success');
}

// 自动保存编辑器游戏（更新原游戏）
let autoSaveTimer = null;
async function autoSaveEditorGame() {
  // 防抖：取消之前的定时器
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  
  // 延迟2秒后执行自动保存
  autoSaveTimer = setTimeout(async () => {
    if (!editSession.sessionId || !editSession.gameId) {
      return;
    }
    
    console.log('[AutoSave] 开始自动保存...');
    
    try {
      const response = await fetch(`/api/games/${editSession.gameId}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Token': getUserToken()
        },
        body: JSON.stringify({
          action: 'save',
          sessionId: editSession.sessionId,
          saveAsNew: false
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[AutoSave] 自动保存成功');
        // 更新原始代码为当前代码（因为已保存）
        editSession.originalCode = editSession.currentCode;
        editSession.hasUnsavedChanges = false;
        
        // 显示小提示
        showToast('✅ 已自动保存', 'success');
      } else {
        console.error('[AutoSave] 自动保存失败:', data.error);
      }
      
    } catch (error) {
      console.error('[AutoSave] 自动保存出错:', error);
    }
  }, 2000);
}
