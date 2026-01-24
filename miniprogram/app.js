/**
 * AI游戏工坊 - 微信小程序
 * 全局入口文件
 */

// 全局配置
const config = {
  // API基础地址（你的服务器）
  baseUrl: 'https://www.yijuhuayouxi.com',
  // 网站地址（跳转用）
  webUrl: 'https://www.yijuhuayouxi.com',
  // 版本号
  version: '1.0.0'
};

App({
  globalData: {
    userInfo: null,
    token: null,
    isLoggedIn: false,
    config: config
  },

  onLaunch() {
    console.log('AI游戏工坊小程序启动');
    
    // 检查本地存储的登录状态
    this.checkLoginStatus();
    
    // 获取系统信息
    this.getSystemInfo();
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
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
              
              if (result.success) {
                // 保存登录信息
                this.globalData.token = result.data.token;
                this.globalData.userInfo = result.data.userInfo;
                this.globalData.isLoggedIn = true;
                
                wx.setStorageSync('token', result.data.token);
                wx.setStorageSync('userInfo', result.data.userInfo);
                
                resolve(result.data);
              } else {
                reject(new Error(result.error || '登录失败'));
              }
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error('获取微信登录code失败'));
          }
        },
        fail: reject
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
      this.globalData.safeAreaBottom = systemInfo.screenHeight - systemInfo.safeArea.bottom;
    } catch (e) {
      console.error('获取系统信息失败:', e);
    }
  },

  // 封装请求方法
  request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const fullUrl = url.startsWith('http') ? url : config.baseUrl + url;
      
      wx.request({
        url: fullUrl,
        method: options.method || 'GET',
        data: options.data || {},
        header: {
          'Content-Type': 'application/json',
          'x-user-token': this.globalData.token || '',
          'x-platform': 'miniprogram',
          ...options.header
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
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
  }
});
