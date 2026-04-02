/**
 * 创作引导页 - 引导用户去网站创作，小程序端领取积分
 */
const app = getApp();

Page({
  data: {
    appName: '游戏家',
    creditsHidden: false,  // 从站点配置读取，为 true 时完全隐藏积分相关
    // 用户积分信息
    credits: 0,
    
    // 签到状态
    checkinStatus: {
      checkedInToday: false,
      streakDays: 0
    },
    
    // 可领取奖励统计
    claimableCount: 0,
    claimableCredits: 0,
    
    // 全站最新作品
    latestGames: [],
    loadingLatestGames: false,
    
    // 网站URL
    webUrl: '',
    
    // 签到加载状态
    checkinLoading: false
  },

  onLoad() {
    this.setData({
      creditsHidden: getApp().globalData.creditsEarningHidden === true
    });
    this.loadData();
  },

  onShow() {
    // 更新自定义TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    const creditsHidden = app.globalData.creditsEarningHidden === true;
    // 更新应用名称与积分隐藏开关
    this.setData({
      appName: app.getAppName(),
      webUrl: app.globalData.config?.webUrl || 'https://youxijia.com',
      creditsHidden
    });
    
    // 检查登录状态
    if (!app.globalData.isLoggedIn) {
      app.silentLogin().then(() => {
        this.loadData();
      });
    } else {
      this.loadData();
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载所有数据
  async loadData() {
    const creditsHidden = app.globalData.creditsEarningHidden === true;
    if (creditsHidden) {
      await this.loadLatestGames();
    } else {
      await Promise.all([
        this.loadCredits(),
        this.loadCheckinStatus(),
        this.loadClaimableRewards(),
        this.loadLatestGames()
      ]);
    }
  },

  // 加载积分
  async loadCredits() {
    try {
      const result = await app.request('/api/credits');
      if (result && result.success !== false) {
        this.setData({
          credits: result.credits || 0
        });
      }
    } catch (err) {
      console.error('加载积分失败:', err);
    }
  },

  // 加载签到状态
  async loadCheckinStatus() {
    try {
      const result = await app.request('/api/user/checkin-status');
      if (result && result.success) {
        this.setData({
          'checkinStatus.checkedInToday': result.data.checked_in_today,
          'checkinStatus.streakDays': result.data.streak_days
        });
      }
    } catch (err) {
      console.error('加载签到状态失败:', err);
    }
  },

  // 加载可领取奖励
  async loadClaimableRewards() {
    try {
      const result = await app.request('/api/achievements');
      if (result && result.success) {
        this.setData({
          claimableCount: result.data.claimable_count || 0,
          claimableCredits: result.data.claimable_credits || 0
        });
      }
    } catch (err) {
      console.error('加载奖励失败:', err);
    }
  },

  // 加载最新作品
  async loadLatestGames() {
    if (this.data.loadingLatestGames) return;
    
    this.setData({ loadingLatestGames: true });
    
    try {
      const result = await app.request('/api/games', {
        data: { limit: 6, sort: 'newest' }
      });
      
      if (result.success) {
        this.setData({
          latestGames: result.data || result.games || []
        });
      }
    } catch (err) {
      console.error('加载最新作品失败:', err);
    } finally {
      this.setData({ loadingLatestGames: false });
    }
  },

  // 签到
  async handleCheckin() {
    if (this.data.checkinStatus.checkedInToday) {
      app.showToast('今日已签到');
      return;
    }
    
    if (this.data.checkinLoading) return;
    
    this.setData({ checkinLoading: true });
    
    try {
      const result = await app.request('/api/user/checkin', {
        method: 'POST'
      });
      
      if (result && result.success) {
        const data = result.data;
        
        this.setData({
          credits: data.total_credits,
          'checkinStatus.checkedInToday': true,
          'checkinStatus.streakDays': data.streak_days
        });
        
        let message = `+${data.total_earned}积分`;
        if (data.bonus_credits > 0) {
          message += `（含连签加成+${data.bonus_credits}）`;
        }
        
        wx.showModal({
          title: '🎉 签到成功',
          content: message + `\n连续签到${data.streak_days}天`,
          showCancel: false,
          confirmText: '太棒了'
        });
      } else {
        app.showToast(result?.error || '签到失败');
      }
    } catch (err) {
      console.error('签到失败:', err);
      app.showToast('签到失败，请重试');
    } finally {
      this.setData({ checkinLoading: false });
    }
  },

  // 去积分中心
  goToCredits() {
    if (app.globalData.creditsEarningHidden) return;
    wx.navigateTo({
      url: '/pages/credits/credits'
    });
  },

  // 去网站创作
  goToWebCreate() {
    const url = this.data.webUrl;
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showModal({
          title: '🌐 去网站创作',
          content: '网站链接已复制！\n\n请在浏览器中打开，用账号登录后即可创作游戏',
          confirmText: '知道了',
          showCancel: false
        });
      }
    });
  },

  // 复制网站链接
  copyWebUrl() {
    const url = this.data.webUrl;
    wx.setClipboardData({
      data: url,
      success: () => {
        app.showToast('链接已复制', 'success');
      }
    });
  },

  // 跳转到作品广场
  goToWorksPage() {
    wx.switchTab({
      url: '/pages/works/works'
    });
  },

  // 点击游戏
  goToGameDetail(e) {
    const game = e.currentTarget.dataset.game;
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${game.id}`
    });
  },

  // 跳转搜索
  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  // 分享
  onShareAppMessage() {
    const appName = app.getAppName();
    const creditsHidden = app.globalData.creditsEarningHidden === true;
    return {
      title: creditsHidden ? `${appName} - 来创作你的游戏` : `${appName} - 来签到领积分，创作你的游戏`,
      path: '/pages/create/create'
    };
  }
});