/**
 * Just One Word — 微信小程序（个人主体合规：权益兑换码工具 + 官方广告组件）
 * 登录：wx.login → POST /api/wechat/login 换取 user_token（需云端 WX_MINI_APPID / WX_MINI_SECRET）。
 */

const config = {
  baseUrl: 'https://api.yijuhuayouxi.com',
  webUrl: '',
  version: '2.0.0-compliance',
  siteName: 'Just One Word',
  miniprogramName: 'Just One Word',
  siteSlogan: '权益兑换码领取与记录查询',
  miniBannerAdUnitId: '',
  miniBannerMineAdUnitId: '',
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
    // 升级策略：清除无 mp_openid 的旧 token（兑换码 quotas/claim 依赖 D1 微信绑定）
    const AUTH_VER = 3;
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
        
        // 激励视频广告单元 ID：顶层与 extraConfig.ads 合并；服务端为空时清空本地，避免沿用过期 ID
        const rv = String(
          result.rewardedVideoAdUnitId ||
            result.extraConfig?.ads?.rewardedVideoAdUnitId ||
            ''
        ).trim();
        this.globalData.config.rewardedVideoAdUnitId = rv;
        if (result.miniBannerAdUnitId) {
          this.globalData.config.miniBannerAdUnitId = result.miniBannerAdUnitId;
        }
        if (result.miniBannerMineAdUnitId) {
          this.globalData.config.miniBannerMineAdUnitId = result.miniBannerMineAdUnitId;
        }
        if (result.extraConfig?.ads?.miniBannerAdUnitId) {
          this.globalData.config.miniBannerAdUnitId = result.extraConfig.ads.miniBannerAdUnitId;
        }
        if (result.extraConfig?.ads?.miniBannerMineAdUnitId) {
          this.globalData.config.miniBannerMineAdUnitId = result.extraConfig.ads.miniBannerMineAdUnitId;
        }
        if (result.extraConfig?.ads?.interstitialAdUnitId) {
          this.globalData.config.interstitialAdUnitId = result.extraConfig.ads.interstitialAdUnitId;
        }
        if (result.extraConfig?.ads?.splashAdUnitId) {
          this.globalData.config.splashAdUnitId = result.extraConfig.ads.splashAdUnitId;
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

        // 首页 onLoad 往往早于本请求返回，需补一次广告位初始化
        try {
          const pages = getCurrentPages();
          const cur = pages[pages.length - 1];
          if (cur && cur.route === 'pages/home/home' && typeof cur.refreshAdsFromConfig === 'function') {
            cur.refreshAdsFromConfig();
          }
        } catch (_) {}
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
        const doLogin = (retryLeft) => {
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
                    // Pages+D1：{ userToken, account }；旧 KV Worker：{ data: { token, userInfo } }
                    const token =
                      result.userToken ||
                      (result.data && (result.data.token || result.data.userToken)) ||
                      '';
                    const rawAcc = result.account || (result.data && result.data.userInfo) || {};
                    const acc = this.normalizeUserInfo(rawAcc);
                    if (!token) {
                      reject(new Error((result && result.error) || '登录失败：未返回 token'));
                      return;
                    }
                    this.globalData.token = token;
                    this.globalData.userInfo = acc;
                    this.globalData.isLoggedIn = true;
                    this.globalData.accountId = acc.account_id || acc.accountId || null;
                    wx.setStorageSync('userToken', token);
                    wx.setStorageSync('token', token);
                    wx.setStorageSync('userInfo', acc);
                    resolve(result);
                    return;
                  }
                  // 微信 code 偶发失效（400）时自动重试一次，减少首屏登录抖动
                  if (res.statusCode === 400 && retryLeft > 0) {
                    doLogin(retryLeft - 1);
                    return;
                  }
                  const errcode = result && result.errcode ? ` [errcode=${result.errcode}]` : '';
                  const msg = (result && result.error) || `登录失败(${res.statusCode})`;
                  console.error('wxLogin failed:', res.statusCode, result);
                  wx.showToast({ title: (`${msg}${errcode}`).slice(0, 30), icon: 'none' });
                  reject(new Error(`${msg}${errcode}`));
                },
                fail: reject
              });
            },
            fail: reject
          });
        };
        doLogin(1);
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

      const stored = wx.getStorageSync('userToken') || wx.getStorageSync('token') || '';
      if (!this.globalData.token && stored) {
        this.globalData.token = stored;
      }
      const token =
        (this.globalData.token && String(this.globalData.token).trim()) ||
        (stored && String(stored).trim()) ||
        '';

      const method = (options.method || 'GET').toUpperCase();
      let data = options.data;
      if (
        method !== 'GET' &&
        method !== 'HEAD' &&
        data != null &&
        typeof data === 'object' &&
        !Array.isArray(data)
      ) {
        data = JSON.stringify(data);
      } else if (data == null && method !== 'GET' && method !== 'HEAD') {
        data = '{}';
      }

      // 勿带 Authorization: Bearer <本站 user_token>：部分网关会按 JWT 校验 Authorization，非 JWT 会直接 401
      const baseHeader = {
        'Content-Type': 'application/json',
        'x-user-token': token,
        'x-platform': 'miniprogram',
      };

      wx.request({
        url: fullUrl,
        method: options.method || 'GET',
        data: data !== undefined && data !== null ? data : {},
        timeout: options.timeout || 1800000, // 默认60秒，可通过options.timeout自定义
        header: {
          ...baseHeader,
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
            const msg =
              (res.data && (res.data.error || res.data.message)) ||
              `请求失败: ${res.statusCode}`;
            reject(new Error(String(msg)));
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



