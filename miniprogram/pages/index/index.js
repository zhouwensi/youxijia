/**
 * 首页 - 游戏列表
 */
const app = getApp();

Page({
  data: {
    // 轮播Tab
    currentTab: 0,
    tabs: [
      { id: 'featured', name: '精选' },
      { id: 'recent', name: '最新' },
      { id: 'hot', name: '热门' }
    ],
    
    // 游戏列表数据
    games: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    
    // 下拉刷新状态
    refreshing: false
  },

  onLoad() {
    this.loadGames();
  },

  onShow() {
    // 页面显示时检查登录状态
    if (!app.globalData.isLoggedIn) {
      app.silentLogin();
    }
  },

  // 切换Tab
  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    if (index !== this.data.currentTab) {
      this.setData({
        currentTab: index,
        games: [],
        page: 1,
        hasMore: true
      });
      this.loadGames();
    }
  },

  // 加载游戏列表
  async loadGames(isLoadMore = false) {
    if (this.data.loading) return;
    if (isLoadMore && !this.data.hasMore) return;

    this.setData({ loading: true });

    try {
      const tab = this.data.tabs[this.data.currentTab];
      let url = '/api/games';
      
      // 根据Tab选择不同的API
      switch (tab.id) {
        case 'featured':
          url = '/api/games/featured';
          break;
        case 'recent':
          url = '/api/games/recent';
          break;
        case 'hot':
          url = '/api/games/hot';
          break;
      }

      const result = await app.request(url, {
        data: {
          page: this.data.page,
          limit: this.data.pageSize
        }
      });

      if (result.success) {
        const newGames = result.data || result.games || [];
        const games = isLoadMore ? [...this.data.games, ...newGames] : newGames;
        
        this.setData({
          games,
          hasMore: newGames.length >= this.data.pageSize,
          page: isLoadMore ? this.data.page + 1 : 2
        });
      } else {
        app.showToast(result.error || '加载失败');
      }
    } catch (err) {
      console.error('加载游戏列表失败:', err);
      app.showToast('网络错误，请重试');
    } finally {
      this.setData({ loading: false, refreshing: false });
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ 
      refreshing: true,
      page: 1,
      hasMore: true
    });
    this.loadGames().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadGames(true);
    }
  },

  // 点击游戏卡片 - 进入详情页
  goToGameDetail(e) {
    const game = e.currentTarget.dataset.game;
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${game.id}`
    });
  },

  // 去网页创作
  goToCreate() {
    const url = app.globalData.config.webUrl;
    app.copyAndOpenWeb(url, '请在浏览器中打开链接进行游戏创作');
  },

  // 搜索
  goToSearch() {
    // 简化版暂不实现搜索，提示去网页
    app.copyAndOpenWeb(app.globalData.config.webUrl, '请在浏览器中使用搜索功能');
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'AI游戏工坊 - 一句话生成游戏',
      path: '/pages/index/index',
      imageUrl: '' // 可以添加分享图片
    };
  }
});
