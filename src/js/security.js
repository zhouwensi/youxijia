// 安全保护脚本 - DevTools检测和封禁检查

(function() {
  'use strict';
  
  // 是否允许DevTools（根据服务器响应设置）
  let allowDevTools = false;
  let userBanned = false;
  let userBanTypes = null; // 封禁类型数组
  let banReason = '';
  let banExpireAt = null;
  
  // 检查用户状态
  async function checkUserStatus() {
    try {
      // 尝试多种键名获取用户token
      const userToken = localStorage.getItem('user_token') || 
                       localStorage.getItem('aigame-user-token') || 
                       localStorage.getItem('aigame-author-token') || '';
      
      const response = await fetch((window.resolveApiUrl || function (p) { return p; })(`/api/user/status`), {
        headers: userToken ? { 'X-User-Token': userToken } : {}
      });
      const data = await response.json();
      
      if (data.success) {
        allowDevTools = data.allowDevTools;
        userBanned = data.banned;
        userBanTypes = data.banTypes; // 保存封禁类型
        banReason = data.banReason;
        banExpireAt = data.banExpireAt;
        
        // 如果用户被封禁，检查是否包含"禁止访问"
        // 只有"禁止访问"类型才显示全屏封禁遮罩
        if (userBanned) {
          const isAccessBanned = !userBanTypes || userBanTypes.length === 0 || userBanTypes.includes('access');
          if (isAccessBanned) {
            showBanMessage();
          }
        }
      }
    } catch (error) {
      console.error('检查用户状态失败:', error);
    }
  }
  
  // 显示封禁提示
  function showBanMessage() {
    const expireText = banExpireAt ? `封禁将于 ${new Date(banExpireAt).toLocaleString()} 解除` : '永久封禁';
    const message = `您的账号已被封禁\n\n原因: ${banReason || '违规'}\n${expireText}\n\n如有疑问，请联系管理员。`;
    
    // 创建封禁遮罩
    const overlay = document.createElement('div');
    overlay.id = 'ban-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 99999;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
    `;
    
    overlay.innerHTML = `
      <div style="background: #1e293b; border: 2px solid #ef4444; border-radius: 16px; padding: 2rem; max-width: 400px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🚫</div>
        <h2 style="color: #ef4444; margin-bottom: 1rem;">账号已被封禁</h2>
        <p style="color: #94a3b8; margin-bottom: 0.5rem;">原因: <span style="color: #fca5a5;">${banReason || '违规'}</span></p>
        <p style="color: #94a3b8; margin-bottom: 1.5rem;">${banExpireAt ? `将于 <span style="color: #fbbf24;">${new Date(banExpireAt).toLocaleString()}</span> 解除` : '<span style="color: #ef4444;">永久封禁</span>'}</p>
        <p style="color: #64748b; font-size: 0.875rem;">如有疑问，请联系管理员</p>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // 阻止所有交互
    document.body.style.overflow = 'hidden';
    overlay.addEventListener('click', (e) => e.stopPropagation());
  }
  
  // DevTools检测
  let devToolsOpen = false;
  let checkCount = 0;
  
  // 方法1: 通过窗口大小检测
  function checkWindowSize() {
    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    return widthThreshold || heightThreshold;
  }
  
  // 方法2: 通过console对象检测 (更可靠)
  function checkConsoleProfile() {
    let detected = false;
    const element = document.createElement('div');
    Object.defineProperty(element, 'id', {
      get: function() {
        detected = true;
        return '';
      }
    });
    console.log(element);
    console.clear();
    return detected;
  }
  
  // 方法3: 通过Function toString检测
  function checkFunctionToString() {
    let detected = false;
    const func = function() {};
    func.toString = function() {
      detected = true;
      return '';
    };
    console.log(func);
    console.clear();
    return detected;
  }
  
  // 方法4: 通过performance.now检测debugger暂停
  function checkDebuggerPause() {
    const t1 = performance.now();
    // 使用 eval 来隐藏 debugger 关键字
    (function() { return eval('debugger'); })();
    const t2 = performance.now();
    return t2 - t1 > 100;
  }
  
  // 方法5: 通过image检测
  function checkImageLog() {
    let detected = false;
    const img = new Image();
    Object.defineProperty(img, 'id', {
      get: function() {
        detected = true;
        return 'devtools-check';
      }
    });
    console.log(img);
    console.clear();
    return detected;
  }
  
  // 综合检测
  function detectDevTools() {
    if (allowDevTools) return false; // 白名单用户允许使用
    
    // 组合多种检测方法
    if (checkWindowSize()) return true;
    if (checkConsoleProfile()) return true;
    if (checkFunctionToString()) return true;
    if (checkImageLog()) return true;
    
    return false;
  }
  
  // 处理DevTools打开事件
  function handleDevToolsOpen() {
    if (allowDevTools) return;
    
    // 显示警告并禁止操作
    const overlay = document.createElement('div');
    overlay.id = 'devtools-warning';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 99999;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
    `;
    
    overlay.innerHTML = `
      <div style="background: #1e293b; border: 2px solid #f59e0b; border-radius: 16px; padding: 2rem; max-width: 400px; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <h2 style="color: #f59e0b; margin-bottom: 1rem;">检测到开发者工具</h2>
        <p style="color: #94a3b8; margin-bottom: 1.5rem;">为保护游戏代码和用户安全，请关闭开发者工具后刷新页面。</p>
        <button onclick="location.reload()" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-size: 1rem;">
          刷新页面
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    
    // 清除页面敏感内容
    try {
      const gameFrame = document.getElementById('game-frame');
      if (gameFrame) gameFrame.src = 'about:blank';
    } catch (e) {}
  }
  
  // 定期检测
  function startDetection() {
    // 初次检查用户状态
    checkUserStatus();
    
    // 启动DevTools检测循环
    setInterval(() => {
      if (userBanned) return; // 已封禁用户不检测DevTools
      
      const isOpen = detectDevTools();
      
      if (isOpen && !devToolsOpen) {
        devToolsOpen = true;
        checkCount++;
        
        if (checkCount >= 2) { // 连续检测到2次才触发
          handleDevToolsOpen();
        }
      } else if (!isOpen) {
        checkCount = 0;
        devToolsOpen = false;
        
        // 移除警告遮罩
        const warning = document.getElementById('devtools-warning');
        if (warning) {
          warning.remove();
          document.body.style.overflow = '';
        }
      }
    }, 1000);
  }
  
  // 禁用右键菜单
  function disableContextMenu() {
    document.addEventListener('contextmenu', (e) => {
      if (!allowDevTools) {
        e.preventDefault();
        return false;
      }
    });
  }
  
  // 禁用快捷键
  function disableShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (allowDevTools) return;
      
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+U (查看源代码)
      if (e.ctrlKey && e.key.toUpperCase() === 'U') {
        e.preventDefault();
        return false;
      }
    });
  }
  
  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startDetection();
      disableContextMenu();
      disableShortcuts();
    });
  } else {
    startDetection();
    disableContextMenu();
    disableShortcuts();
  }
  
})();
