/**
 * 网站登录验证模块
 * 提供登录状态检测和未登录提示功能
 */

// ==================== 登录状态检测 ====================

// 检查是否已登录（网站登录）
function isWebLoggedIn() {
  const jwt = localStorage.getItem('aigame-jwt');
  return jwt && jwt.length > 0;
}

// 获取登录用户信息
function getWebUser() {
  if (!isWebLoggedIn()) return null;
  return {
    accountId: localStorage.getItem('aigame-account-id'),
    nickname: localStorage.getItem('aigame-author-name'),
    userToken: localStorage.getItem('aigame-user-token')
  };
}

// 跳转到登录页（保留返回URL）
function goToLogin() {
  const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = '/login.html?return=' + returnUrl;
}

// ==================== Toast 提示 ====================

let loginToastTimer = null;
let loginToastElement = null;

// 获取页面中最高的 z-index 值
function getMaxZIndex() {
  let maxZ = 0;
  const elements = document.querySelectorAll('body *');
  elements.forEach(el => {
    const style = window.getComputedStyle(el);
    const position = style.position;
    // 只检查定位元素（fixed, absolute, relative, sticky）
    if (position !== 'static') {
      const zIndex = parseInt(style.zIndex, 10);
      if (!isNaN(zIndex) && zIndex > maxZ) {
        maxZ = zIndex;
      }
    }
  });
  return maxZ;
}

// 确保Toast元素存在
function ensureLoginToast() {
  if (loginToastElement) return loginToastElement;
  
  // 检查页面是否已有Toast
  loginToastElement = document.getElementById('login-toast');
  if (loginToastElement) return loginToastElement;
  
  // 创建Toast元素
  const toast = document.createElement('div');
  toast.id = 'login-toast';
  toast.className = 'login-toast';
  toast.innerHTML = `
    <span class="login-toast-text" id="login-toast-text">🔐 登录后可进行此操作</span>
    <button class="login-toast-btn" onclick="goToLogin()">去登录</button>
  `;
  
  // 添加样式（如果不存在）- z-index 会在显示时动态设置
  if (!document.getElementById('login-toast-style')) {
    const style = document.createElement('style');
    style.id = 'login-toast-style';
    style.textContent = `
      .login-toast {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: rgba(20, 20, 30, 0.95);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 12px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        opacity: 0;
        transition: all 0.3s ease;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      }
      .login-toast.show {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
      .login-toast-text {
        color: rgba(255, 255, 255, 0.9);
        font-size: 14px;
      }
      .login-toast-btn {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        border: none;
        color: #fff;
        padding: 6px 14px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
      }
      .login-toast-btn:hover {
        filter: brightness(1.1);
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  loginToastElement = toast;
  return toast;
}

// 显示登录提示 Toast
function showLoginToast(message) {
  const toast = ensureLoginToast();
  const textEl = document.getElementById('login-toast-text');
  if (!toast) return;
  
  if (textEl) {
    textEl.textContent = message || '🔐 登录后可进行此操作';
  }
  
  // 动态计算并设置 z-index，确保始终在最顶层
  const maxZ = getMaxZIndex();
  toast.style.zIndex = Math.max(maxZ + 10, 10000);
  
  toast.classList.add('show');
  
  // 清除之前的定时器
  if (loginToastTimer) clearTimeout(loginToastTimer);
  
  // 3秒后自动隐藏
  loginToastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// 隐藏登录提示 Toast
function hideLoginToast() {
  if (loginToastElement) {
    loginToastElement.classList.remove('show');
  }
  if (loginToastTimer) {
    clearTimeout(loginToastTimer);
  }
}

// ==================== 需要登录的操作包装器 ====================

/**
 * 需要登录的操作包装器
 * @param {string} actionName - 操作名称，用于提示（如"点赞"、"收藏"）
 * @param {Function} callback - 登录后执行的回调函数
 * @returns {boolean} - 是否允许执行（已登录返回true）
 */
function requireLogin(actionName, callback) {
  if (isWebLoggedIn()) {
    if (callback && typeof callback === 'function') {
      callback();
    }
    return true;
  } else {
    showLoginToast('🔐 登录后可' + actionName);
    return false;
  }
}

// ==================== 拦截操作按钮 ====================

// 需要登录检测的操作类型
const LOGIN_REQUIRED_ACTIONS = {
  'like': '点赞',
  'favorite': '收藏',
  'comment': '评论',
  'follow': '关注',
  'unfollow': '取消关注'
};

// 拦截点赞操作
function interceptLikeAction(originalHandler, gameId) {
  if (!isWebLoggedIn()) {
    showLoginToast('🔐 登录后可点赞');
    return false;
  }
  if (originalHandler && typeof originalHandler === 'function') {
    return originalHandler(gameId);
  }
  return true;
}

// 拦截收藏操作
function interceptFavoriteAction(originalHandler, gameId) {
  if (!isWebLoggedIn()) {
    showLoginToast('🔐 登录后可收藏');
    return false;
  }
  if (originalHandler && typeof originalHandler === 'function') {
    return originalHandler(gameId);
  }
  return true;
}

// 拦截评论操作
function interceptCommentAction(originalHandler, gameId, content) {
  if (!isWebLoggedIn()) {
    showLoginToast('🔐 登录后可评论');
    return false;
  }
  if (originalHandler && typeof originalHandler === 'function') {
    return originalHandler(gameId, content);
  }
  return true;
}

// 拦截关注操作
function interceptFollowAction(originalHandler, targetUserToken) {
  if (!isWebLoggedIn()) {
    showLoginToast('🔐 登录后可关注');
    return false;
  }
  if (originalHandler && typeof originalHandler === 'function') {
    return originalHandler(targetUserToken);
  }
  return true;
}

// ==================== 顶部登录状态显示 ====================

// 更新顶部登录状态显示
function updateLoginEntry() {
  const container = document.getElementById('login-entry');
  if (!container) return;
  
  if (isWebLoggedIn()) {
    const user = getWebUser();
    const displayName = user.nickname || user.accountId || '用户';
    const firstChar = displayName.charAt(0);
    container.innerHTML = `
      <button class="user-btn" onclick="showUserMenu()">
        <span class="user-avatar">${firstChar}</span>
        <span class="user-name">${escapeHtmlSafe(displayName)}</span>
      </button>
    `;
  } else {
    container.innerHTML = `<button class="login-btn" onclick="goToLogin()">登录</button>`;
  }
}

// 安全的HTML转义
function escapeHtmlSafe(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示用户菜单 - 点击头部用户名跳转到个人主页
function showUserMenu() {
  // 直接跳转到个人主页
  goToProfile();
}

// 跳转到个人主页
function goToProfile() {
  // 如果是首页 index.html，直接切换到 profile 页面
  if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
    // 调用 app.js 中的 switchBottomNav 或直接操作页面
    if (typeof directSwitchToProfile === 'function') {
      directSwitchToProfile();
    } else if (typeof switchBottomNav === 'function') {
      // 临时覆盖 webWriteDisabled 检测，因为用户已登录
      const wasDisabled = window._forceAllowProfile;
      window._forceAllowProfile = true;
      
      // 手动切换到 profile 页面
      document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.nav === 'profile');
      });
      document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
      });
      const profilePage = document.getElementById('profile-page');
      if (profilePage) {
        profilePage.classList.add('active');
      }
      const settingsBtn = document.getElementById('profile-settings-btn');
      if (settingsBtn) {
        settingsBtn.classList.add('visible');
      }
      document.getElementById('bottom-nav').style.display = 'flex';
      
      // 加载个人主页数据
      if (typeof loadProfilePageData === 'function') {
        loadProfilePageData();
      }
      
      window._forceAllowProfile = wasDisabled;
    }
  } else {
    // 在其他页面，跳转到首页的个人主页
    window.location.href = '/?tab=profile';
  }
}

// 退出登录
function webLogout() {
  // 清除所有登录相关的本地存储
  localStorage.removeItem('aigame-jwt');
  localStorage.removeItem('aigame-user-token');
  localStorage.removeItem('aigame-author-token');
  localStorage.removeItem('aigame-account-id');
  localStorage.removeItem('aigame-author-name');
  
  // 设置标记，阻止自动初始化创建新账号
  localStorage.setItem('aigame-logged-out', 'true');
  
  // 尝试调用全局 showToast
  if (typeof showToast === 'function') {
    showToast('已退出登录');
  } else {
    alert('已退出登录');
  }
  
  // 刷新页面，确保状态完全清除
  setTimeout(() => {
    window.location.reload();
  }, 500);
}

// ==================== 初始化 ====================

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
  // 更新登录状态
  updateLoginEntry();
  
  // 预创建Toast元素
  setTimeout(ensureLoginToast, 100);
});

// 导出函数供全局使用
window.isWebLoggedIn = isWebLoggedIn;
window.getWebUser = getWebUser;
window.goToLogin = goToLogin;
window.showLoginToast = showLoginToast;
window.hideLoginToast = hideLoginToast;
window.requireLogin = requireLogin;
window.updateLoginEntry = updateLoginEntry;
window.showUserMenu = showUserMenu;
window.webLogout = webLogout;

console.log('[Auth] 登录验证模块已加载');
