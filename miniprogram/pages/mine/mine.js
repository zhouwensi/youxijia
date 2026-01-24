/**
 * 我的页面
 */
const app = getApp();

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    
    // 统计数据
    stats: {
      games: 0,
      likes: 0,
      favorites: 0,
      credits: 0
    },
    
    // 我的游戏列表
    myGames: [],
    loadingGames: false,
    
    // 菜单列表
    menuList: [
      { id: 'my-games', icon: '🎮', name: '我的游戏', badge: 0 },
      { id: 'my-likes', icon: '❤️', name: '我的点赞', badge: 0 },
      { id: 'my-favorites', icon: '⭐', name: '我的收藏', badge: 0 },
      { id: 'credits', icon: '💰', name: '我的积分', badge: 0 }
    ]
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
    if (app.globalData.isLoggedIn) {
      this.loadUserData();
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const isLoggedIn = app.globalData.isLoggedIn;
    const userInfo = app.globalData.userInfo;
    
    this.setData({
      isLoggedIn,
      userInfo
    });
  },

  // 加载用户数据
  async loadUserData() {
    try {
      // 获取积分
      const creditsResult = await app.request('/api/credits');
      if (creditsResult.success) {
        this.setData({
          'stats.credits': creditsResult.credits || 0
        });
      }

      // 获取账号信息
      const accountResult = await app.request('/api/account');
      if (accountResult.success) {
        this.setData({
          userInfo: accountResult.account,
          'stats.games': accountResult.account.games_count || 0
        });
        
        // 更新全局状态
        app.globalData.userInfo = accountResult.account;
        wx.setStorageSync('userInfo', accountResult.account);
      }

      // 更新菜单badge
      this.setData({
        'menuList[0].badge': this.data.stats.games,
        'menuList[3].badge': this.data.stats.credits
      });

    } catch (err) {
      console.error('加载用户数据失败:', err);
    }
  },

  // 登录
  async handleLogin() {
    wx.showLoading({ title: '登录中...' });
    
    try {
      await app.wxLogin();
      this.checkLoginStatus();
      this.loadUserData();
      app.showToast('登录成功', 'success');
    } catch (err) {
      console.error('登录失败:', err);
      app.showToast('登录失败，请重试');
    } finally {
      wx.hideLoading();
    }
  },

  // 点击菜单项
  handleMenuClick(e) {
    const { id } = e.currentTarget.dataset;
    
    switch (id) {
      case 'my-games':
      case 'my-likes':
      case 'my-favorites':
        // 暂时跳转到网页
        app.copyAndOpenWeb(
          `${app.globalData.config.webUrl}#mine`,
          '请在浏览器中查看详细内容'
        );
        break;
      case 'credits':
        this.showCreditsInfo();
        break;
    }
  },

  // 显示积分信息
  showCreditsInfo() {
    wx.showModal({
      title: '我的积分',
      content: `当前积分: ${this.data.stats.credits}\n\n获取积分方式:\n• 每日登录\n• 邀请好友\n• 观看广告`,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 去网页创作
  goToCreate() {
    const url = app.globalData.config.webUrl;
    app.copyAndOpenWeb(url, '请在浏览器中打开链接进行游戏创作');
  },

  // 去网页查看更多
  goToWeb() {
    const url = app.globalData.config.webUrl;
    app.copyAndOpenWeb(url, '请在浏览器中打开查看更多功能');
  },

  // 分享
  onShareAppMessage() {
    const userInfo = this.data.userInfo;
    return {
      title: userInfo ? `${userInfo.nickname || userInfo.account_id}邀请你来玩AI游戏` : 'AI游戏工坊 - 一句话生成游戏',
      path: '/pages/index/index'
    };
  },

  // 关于
  showAbout() {
    wx.showModal({
      title: '关于AI游戏工坊',
      content: `版本: ${app.globalData.config.version}\n\n一句话生成游戏的神奇平台！\n\n更多功能请访问网页版`,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 联系客服（如果有的话）
  contactService() {
    // 小程序客服功能需要配置
    app.showToast('请在网页版联系我们');
  }
});
