/**
 * 作品页面 - 展示6个游戏分类列表
 */
const app = getApp();

Page({
  data: {
    appName: 'AI游戏工坊', // 从全局配置获取
    // 各分类数据
    sections: [
      { id: 'recent', title: '🆕 最新', games: [], loading: true },
      { id: 'featured', title: '✨ 推荐', games: [], loading: true },
      { id: 'hot', title: '🔥 热门', games: [], loading: true },
      { id: 'likes', title: '❤️ 点赞', games: [], loading: true },
      { id: 'favorites', title: '⭐ 收藏', games: [], loading: true },
      { id: 'comments', title: '💬 评论', games: [], loading: true }
    ],
    refreshing: false
  },

  onLoad() {
    this.loadAllSections();
  },

  onShow() {
    // 设置TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    // 更新应用名称
    this.setData({ appName: app.getAppName() });
  },

  // 加载所有分类数据
  async loadAllSections() {
    const sections = this.data.sections;
    
    // 并行加载所有分类
    const promises = sections.map((section, index) => 
      this.loadSectionData(section.id, index)
    );
    
    await Promise.all(promises);
  },

  // 加载单个分类数据
  async loadSectionData(sectionId, index) {
    try {
      let url = '/api/games';
      let params = { limit: 6 };
      
      // 根据分类选择不同的API
      switch (sectionId) {
        case 'recent':
          url = '/api/games/recent';
          break;
        case 'featured':
          url = '/api/games/featured';
          break;
        case 'hot':
          params.sort = 'plays';
          break;
        case 'likes':
          params.sort = 'likes';
          break;
        case 'favorites':
          params.sort = 'favorites';
          break;
        case 'comments':
          params.sort = 'comments';
          break;
      }

      const result = await app.request(url, { data: params });

      if (result.success) {
        const games = result.data || result.games || [];
        const key = `sections[${index}].games`;
        const loadingKey = `sections[${index}].loading`;
        this.setData({
          [key]: games.slice(0, 6),
          [loadingKey]: false
        });
      }
    } catch (err) {
      console.error(`加载${sectionId}失败:`, err);
      const loadingKey = `sections[${index}].loading`;
      this.setData({ [loadingKey]: false });
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    this.setData({ refreshing: true });
    
    // 重置所有分类的loading状态
    const sections = this.data.sections.map(s => ({
      ...s,
      loading: true,
      games: []
    }));
    this.setData({ sections });
    
    await this.loadAllSections();
    
    this.setData({ refreshing: false });
    wx.stopPullDownRefresh();
  },

  // 查看更多
  viewMore(e) {
    const { id, title } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/works-list/works-list?type=${id}&title=${encodeURIComponent(title)}`
    });
  },

  // 点击游戏卡片
  goToGameDetail(e) {
    const game = e.currentTarget.dataset.game;
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${game.id}`
    });
  },

  // 跳转搜索页
  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  // 分享
  onShareAppMessage() {
    const appName = app.getAppName();
    return {
      title: `${appName} - 发现有趣的AI游戏`,
      path: '/pages/works/works'
    };
  }
});
