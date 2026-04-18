/**
 * 一句话游戏 - 微信小程序
 * 全局入口文件
 *
 * 登录：不在启动时静默注册；用户仅在「我的」页点击「微信登录」后，
 * 通过 wx.login → POST /api/wechat/login 换取本站 user_token（需云端配置 WX_MINI_APPID / WX_MINI_SECRET）。
 */

// 全局配置
const config = {
  // API：Cloudflare Worker 子域（与微信公众平台 request 合法域名一致）
  baseUrl: 'https://api.yijuhuayouxi.com',
  // 网站：GitHub Pages / 自定义域（复制链接、webview 用）
  webUrl: 'https://www.yijuhuayouxi.com',
  // 版本号
  version: '1.0.0',
  // 站点名称（从后台加载）
  siteName: '一句话游戏',
  miniprogramName: 'JustOneWord',
  siteSlogan: '一句话生成游戏'
};

/** 在用户同意隐私指引后再执行回调（基础库支持时） */
function runAfterPrivacyAuthorize(callback) {
  if (typeof wx.getPrivacySetting !== 'function') {
    callback();
    return;
  }
  wx.getPrivacySetting({
    success(res) {
      if (!res.needAuthorization) {
        callback();
        return;
      }
      if (typeof wx.requirePrivacyAuthorize === 'function') {
        wx.requirePrivacyAuthorize({
          success: () => callback(),
          fail: () => {
            wx.showToast({ title: '请先同意隐私保护指引', icon: 'none' });
          }
        });
      } else {
        callback();
      }
    },
    fail: () => callback()
  });
}

App({
  globalData: {
    userInfo: null,
    token: null,
    isLoggedIn: false,
    config: config,
    // 站点配置是否已加载
    siteConfigLoaded: false,
    // 小程序功能开关（默认都开启）
    miniprogramCommentDisabled: false,
    miniprogramLLMDisabled: false,
    // 一键隐藏所有积分获得途径（界面完全隐藏）
    creditsEarningHidden: false,
    // 仅保留部分积分途径（签到、看广告、关注公众号），其余隐藏；默认 true
    creditsEarningLimited: true
  },

  onLaunch() {
    console.log('小程序启动');
    // 升级策略：清除旧版「设备指纹静默登录」留下的 token，强制走一次微信登录
    const AUTH_VER = 2;
    const v = wx.getStorageSync('mp_auth_policy_version');
    if (!v || v < AUTH_VER) {
      wx.removeStorageSync('userToken');
      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
      wx.setStorageSync('mp_auth_policy_version', AUTH_VER);
    }
    this.checkLoginStatus();
    this.getSystemInfo();
    
    // 加载站点配置
    this.loadSiteConfig();
  },

  // 加载站点配置
  async loadSiteConfig() {
    try {
      const result = await this.request('/api/site-config');
      if (result && result.success !== false) {
        // 更新全局配置
        this.globalData.config.siteName = result.siteName || config.siteName;
        this.globalData.config.miniprogramName = result.miniprogramName || config.miniprogramName;
        this.globalData.config.siteSlogan = result.siteSlogan || config.siteSlogan;
        if (result.version) {
          this.globalData.config.version = result.version;
        }
        
        // 小程序功能开关配置
        this.globalData.miniprogramCommentDisabled = result.miniprogramCommentDisabled === true;
        this.globalData.miniprogramLLMDisabled = result.miniprogramLLMDisabled === true;
        this.globalData.creditsEarningHidden = result.creditsEarningHidden === true;
        this.globalData.creditsEarningLimited = result.creditsEarningLimited !== false;
        
        // 订阅消息模板ID
        if (result.wxSubscribeTmplId) {
          this.globalData.config.wxSubscribeTmplId = result.wxSubscribeTmplId;
        }
        
        // 激励视频广告单元ID
        if (result.rewardedVideoAdUnitId) {
          this.globalData.config.rewardedVideoAdUnitId = result.rewardedVideoAdUnitId;
        }
        // 也支持从 extraConfig 中读取
        if (result.extraConfig?.ads?.rewardedVideoAdUnitId) {
          this.globalData.config.rewardedVideoAdUnitId = result.extraConfig.ads.rewardedVideoAdUnitId;
        }
        
        // 保存完整的站点配置（供其他页面使用）
        this.globalData.siteConfig = result;
        
        this.globalData.siteConfigLoaded = true;
        console.log('站点配置加载成功:', this.globalData.config.miniprogramName);
        console.log('小程序功能开关:', { 
          commentDisabled: this.globalData.miniprogramCommentDisabled,
          llmDisabled: this.globalData.miniprogramLLMDisabled,
          creditsEarningHidden: this.globalData.creditsEarningHidden,
          creditsEarningLimited: this.globalData.creditsEarningLimited,
          wxSubscribeTmplId: this.globalData.config.wxSubscribeTmplId ? '已配置' : '未配置'
        });
      }
    } catch (err) {
      console.error('加载站点配置失败:', err);
      // 使用默认配置，不影响使用
    }
  },

  // 获取小程序名称（供各页面使用）
  getAppName() {
    return this.globalData.config.miniprogramName || '一句话游戏';
  },

  /**
   * 统一 userInfo：Worker 返回 camelCase（accountId），WXML 等多处用 account_id
   */
  normalizeUserInfo(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    const id = String(raw.account_id || raw.accountId || '').trim();
    const nick = String(raw.nickname || raw.nickName || id || '游戏玩家').trim();
    return {
      ...raw,
      account_id: id,
      accountId: id || raw.accountId || raw.account_id,
      nickname: nick,
    };
  },

  // 仅从本地恢复登录态，不发起网络静默登录
  checkLoginStatus() {
    const tokenFromStore = wx.getStorageSync('userToken') || wx.getStorageSync('token');
    const userInfoFromStore = wx.getStorageSync('userInfo');
    // 以 storage 为准，并与内存合并：避免 wxLogin 刚写入 globalData 后，因 userInfo 未读到 storage 而把登录态清空
    const token = tokenFromStore || this.globalData.token;

    if (!token) {
      this.globalData.token = null;
      this.globalData.userInfo = null;
      this.globalData.isLoggedIn = false;
      this.globalData.accountId = null;
      return;
    }

    this.globalData.token = token;

    let raw =
      userInfoFromStore && typeof userInfoFromStore === 'object'
        ? userInfoFromStore
        : this.globalData.userInfo && typeof this.globalData.userInfo === 'object'
          ? this.globalData.userInfo
          : {};
    this.globalData.userInfo = this.normalizeUserInfo(raw);
    this.globalData.accountId =
      this.globalData.userInfo.account_id || this.globalData.userInfo.accountId || null;
    this.globalData.isLoggedIn = true;

    try {
      if (tokenFromStore) {
        wx.setStorageSync('userToken', token);
        wx.setStorageSync('token', token);
      }
      wx.setStorageSync('userInfo', this.globalData.userInfo);
    } catch (_) {}
    console.log('用户已登录:', this.globalData.userInfo.nickname || this.globalData.userInfo.account_id);
  },

  /**
   * 微信登录：wx.login 取 code → 服务端 jscode2session → 返回 userToken
   * 需在 Cloudflare Pages 配置 Secret：WX_MINI_APPID、WX_MINI_SECRET
   */
  wxLogin() {
    return new Promise((resolve, reject) => {
      runAfterPrivacyAuthorize(() => {
        wx.login({
          success: (loginRes) => {
            const code = loginRes.code;
            if (!code) {
              reject(new Error('未获取到微信 code'));
              return;
            }
            wx.request({
              url: config.baseUrl + '/api/wechat/login',
              method: 'POST',
              data: { code },
              header: { 'Content-Type': 'application/json' },
              success: (res) => {
                const result = res.data;
                if (res.statusCode === 200 && result && result.success) {
                  const token = result.userToken;
                  const acc = this.normalizeUserInfo(result.account || {});
                  this.globalData.token = token;
                  this.globalData.userInfo = acc;
                  this.globalData.isLoggedIn = true;
                  this.globalData.accountId = acc.account_id || acc.accountId || null;
                  wx.setStorageSync('userToken', token);
                  wx.setStorageSync('token', token);
                  wx.setStorageSync('userInfo', acc);
                  resolve(result);
                } else {
                  reject(new Error((result && result.error) || '登录失败'));
                }
              },
              fail: reject
            });
          },
          fail: reject
        });
      });
    });
  },

  /** 兼容旧调用：与 wxLogin 相同（不再使用设备指纹静默注册） */
  deviceAccountLogin() {
    return this.wxLogin();
  },

  /**
   * 已取消静默注册；若本地已有 token 则仅同步 globalData，否则提示去「我的」微信登录。
   * 供旧页面 onShow 等调用，避免误 reject。
   */
  silentLogin() {
    this.checkLoginStatus();
    if (this.globalData.isLoggedIn) {
      return Promise.resolve({ fromStorage: true });
    }
    return Promise.reject(new Error('请前往「我的」页点击微信登录'));
  },

  // 获取系统信息
  getSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.systemInfo = systemInfo;
      this.globalData.statusBarHeight = systemInfo.statusBarHeight || 20;
      this.globalData.navBarHeight = 44;
      this.globalData.safeAreaBottom = systemInfo.screenHeight - (systemInfo.safeArea?.bottom || systemInfo.screenHeight);
    } catch (e) {
      console.error('获取系统信息失败:', e);
    }
  },

  // 封装请求方法
  // options.timeout: 超时时间（毫秒），默认60000，AI生成等长时间操作建议设置300000（5分钟）
  request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const fullUrl = url.startsWith('http') ? url : config.baseUrl + url;

      wx.request({
        url: fullUrl,
        method: options.method || 'GET',
        data: options.data || {},
        timeout: options.timeout || 1800000, // 默认60秒，可通过options.timeout自定义
        header: {
          'Content-Type': 'application/json',
          'x-user-token': this.globalData.token || wx.getStorageSync('userToken') || wx.getStorageSync('token') || '',
          'x-platform': 'miniprogram',
          ...options.header
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else if (res.statusCode === 401) {
            // token过期，清除登录状态
            this.clearLoginStatus();
            reject(new Error('登录已过期，请重新登录'));
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          console.error('请求失败:', fullUrl, err);
          reject(err);
        }
      });
    });
  },

  // 清除登录状态
  clearLoginStatus() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    this.globalData.accountId = null;
    this.globalData.isLoggedIn = false;
    wx.removeStorageSync('userToken');
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
  },

  // 显示提示
  showToast(title, icon = 'none') {
    wx.showToast({
      title,
      icon,
      duration: 2000
    });
  },

  // 复制文本到剪贴板并提示去浏览器打开
  copyAndOpenWeb(url, tip = '链接已复制，请在浏览器中打开') {
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showModal({
          title: '提示',
          content: tip,
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  /**
   * 格式化积分显示，保留最多1位小数，避免浮点数精度问题
   * @param {number} credits - 积分数值
   * @returns {string} 格式化后的积分字符串
   */
  formatCredits(credits) {
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
});
