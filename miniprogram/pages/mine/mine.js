/**
 * 我的页面 - 增强版
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
      credits: 0,
      following: 0,
      followers: 0
    },
    
    // Tab切换
    currentTab: 'games', // games / likes / favorites
    tabs: [
      { id: 'games', name: '我的作品', icon: '🎮' },
      { id: 'likes', name: '我的点赞', icon: '❤️' },
      { id: 'favorites', name: '我的收藏', icon: '⭐' }
    ],
    
    // 列表数据
    listData: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    
    // 关注弹窗
    showFollowModal: false,
    followModalTab: 'following', // following / followers
    followList: [],
    loadingFollow: false
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
    if (app.globalData.isLoggedIn) {
      this.loadUserData();
      this.loadListData();
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
      // 并行请求
      const [creditsResult, accountResult, statsResult] = await Promise.all([
        app.request('/api/credits'),
        app.request('/api/account'),
        app.request('/api/account/follow-stats')
      ]);

      const updates = {};

      if (creditsResult.success) {
        updates['stats.credits'] = creditsResult.credits || 0;
      }

      if (accountResult.success) {
        updates.userInfo = accountResult.account;
        updates['stats.games'] = accountResult.account.games_count || 0;
        
        // 更新全局状态
        app.globalData.userInfo = accountResult.account;
        wx.setStorageSync('userInfo', accountResult.account);
      }

      if (statsResult.success) {
        updates['stats.following'] = statsResult.followingCount || statsResult.following || 0;
        updates['stats.followers'] = statsResult.followerCount || statsResult.followers || 0;
      }

      this.setData(updates);

    } catch (err) {
      console.error('加载用户数据失败:', err);
    }
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.currentTab) {
      this.setData({
        currentTab: tab,
        listData: [],
        page: 1,
        hasMore: true
      });
      this.loadListData();
    }
  },

  // 加载列表数据
  async loadListData(isLoadMore = false) {
    if (this.data.loading) return;
    if (isLoadMore && !this.data.hasMore) return;

    this.setData({ loading: true });

    try {
      const { currentTab, page, pageSize } = this.data;
      
      let url = '';
      switch (currentTab) {
        case 'games':
          url = '/api/account/games';
          break;
        case 'likes':
          url = '/api/account/likes';
          break;
        case 'favorites':
          url = '/api/account/favorites';
          break;
      }

      const result = await app.request(url, {
        data: { page, limit: pageSize }
      });

      if (result.success) {
        const newData = result.data || result.games || [];
        const listData = isLoadMore ? [...this.data.listData, ...newData] : newData;
        
        this.setData({
          listData,
          hasMore: newData.length >= pageSize,
          page: isLoadMore ? page + 1 : 2
        });
      }
    } catch (err) {
      console.error('加载列表失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadListData(true);
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadUserData();
    this.setData({ page: 1, hasMore: true });
    this.loadListData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 点击关注数
  showFollowing() {
    this.setData({
      showFollowModal: true,
      followModalTab: 'following',
      followList: []
    });
    this.loadFollowList('following');
  },

  // 点击粉丝数
  showFollowers() {
    this.setData({
      showFollowModal: true,
      followModalTab: 'followers',
      followList: []
    });
    this.loadFollowList('followers');
  },

  // 切换关注弹窗Tab
  switchFollowTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.followModalTab) {
      this.setData({
        followModalTab: tab,
        followList: []
      });
      this.loadFollowList(tab);
    }
  },

  // 加载关注/粉丝列表
  async loadFollowList(type) {
    if (this.data.loadingFollow) return;

    this.setData({ loadingFollow: true });

    try {
      const url = type === 'following' ? '/api/account/following' : '/api/account/followers';
      const result = await app.request(url);

      if (result.success) {
        this.setData({
          followList: result.data || result.users || []
        });
      }
    } catch (err) {
      console.error('加载关注列表失败:', err);
    } finally {
      this.setData({ loadingFollow: false });
    }
  },

  // 关闭关注弹窗
  closeFollowModal() {
    this.setData({ showFollowModal: false });
  },

  // 阻止弹窗内容点击穿透
  preventClose() {},

  // 跳转用户主页
  goToUserProfile(e) {
    const user = e.currentTarget.dataset.user;
    this.closeFollowModal();
    wx.navigateTo({
      url: `/pages/user/user?token=${user.token}`
    });
  },

  // 点击游戏
  goToGameDetail(e) {
    const game = e.currentTarget.dataset.game;
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${game.id}`
    });
  },

  // 登录
  async handleLogin() {
    wx.showLoading({ title: '登录中...' });
    
    try {
      await app.wxLogin();
      this.checkLoginStatus();
      this.loadUserData();
      this.loadListData();
      app.showToast('登录成功', 'success');
    } catch (err) {
      console.error('登录失败:', err);
      app.showToast('登录失败，请重试');
    } finally {
      wx.hideLoading();
    }
  },

  // 去设置页
  goToSettings() {
    // TODO: 跳转设置页
    app.showToast('功能开发中');
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
    wx.switchTab({ url: '/pages/create/create' });
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
      path: '/pages/create/create'
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
  }
});