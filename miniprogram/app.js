/**
 * 一句话游戏 - 微信小程序
 * 全局入口文件
 */

// 全局配置
const config = {
  // API基础地址（你的服务器）
  baseUrl: 'https://www.yijuhuayouxi.com',
  // 网站地址（跳转用）
  webUrl: 'https://www.yijuhuayouxi.com',
  // 版本号
  version: '1.0.0',
  // 站点名称（从后台加载）
  siteName: '一句话游戏',
  miniprogramName: '一句话游戏',
  siteSlogan: '一句话生成游戏'
};

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
    miniprogramLLMDisabled: false
  },

  onLaunch() {
    console.log('小程序启动');
    
    // 检查本地存储的登录状态
    this.checkLoginStatus();
    
    // 获取系统信息
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

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
      // 恢复accountId
      this.globalData.accountId = userInfo.account_id || userInfo.accountId || null;
      console.log('用户已登录:', userInfo.nickname || userInfo.account_id);
    } else {
      // 自动静默登录
      this.silentLogin();
    }
  },

  // 静默登录（获取openid）
  async silentLogin() {
    try {
      const loginResult = await this.wxLogin();
      console.log('静默登录成功');
      return loginResult;
    } catch (err) {
      console.error('静默登录失败:', err);
      // 静默登录失败不影响使用，只是用户处于未登录状态
      return null;
    }
  },

  // 微信登录
  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: async (res) => {
          if (res.code) {
            try {
              // 发送code到后端换取用户信息
              const result = await this.request('/api/wechat/login', {
                method: 'POST',
                data: { code: res.code }
              });
              
              console.log('微信登录响应:', result);
              
              // 兼容多种响应格式
              // 格式1: { success: true, data: { token, userInfo } }
              // 格式2: { success: true, token, userInfo }
              // 格式3: { success: true, token, account/user }
              // 格式4: { token, userInfo } (无success字段)
              
              let token = null;
              let userInfo = null;
              
              if (result) {
                // 提取token
                token = result.token || result.data?.token || result.accessToken;
                
                // 提取用户信息
                userInfo = result.userInfo || result.data?.userInfo || 
                           result.user || result.data?.user ||
                           result.account || result.data?.account;
                
                // 如果有success字段，检查是否成功
                if (result.success === false) {
                  reject(new Error(result.error || result.message || '登录失败'));
                  return;
                }
              }
              
              if (token && userInfo) {
                // 保存登录信息
                this.globalData.token = token;
                this.globalData.userInfo = userInfo;
                this.globalData.isLoggedIn = true;
                // 设置accountId（从userInfo中获取）
                this.globalData.accountId = userInfo.account_id || userInfo.accountId || null;
                
                wx.setStorageSync('token', token);
                wx.setStorageSync('userInfo', userInfo);
                
                resolve({ token, userInfo });
              } else if (token) {
                // 只有token没有用户信息，也算登录成功
                this.globalData.token = token;
                this.globalData.isLoggedIn = true;
                this.globalData.accountId = null;  // 无用户信息时accountId为空
                wx.setStorageSync('token', token);
                
                resolve({ token });
              } else {
                // 无法识别的响应格式，打印调试信息
                console.warn('微信登录响应格式不符合预期:', JSON.stringify(result));
                reject(new Error('登录响应格式异常'));
              }
            } catch (err) {
              console.error('微信登录请求失败:', err);
              reject(err);
            }
          } else {
            reject(new Error('获取微信登录code失败'));
          }
        },
        fail: (err) => {
          console.error('wx.login失败:', err);
          reject(err);
        }
      });
    });
  },

  // 获取系统信息
  getSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.systemInfo = systemInfo;
      
      // 计算安全区域（用于适配刘海屏等）
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
          'x-user-token': this.globalData.token || '',
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
    this.globalData.isLoggedIn = false;
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
