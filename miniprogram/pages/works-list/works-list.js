/**
 * 分类列表页面 - 查看更多游戏
 */
const app = getApp();

Page({
  data: {
    type: '',           // 分类类型
    title: '',          // 页面标题
    games: [],          // 游戏列表
    loading: false,     // 加载中
    hasMore: true,      // 是否有更多
    page: 1,            // 当前页
    pageSize: 20        // 每页数量
  },

  onLoad(options) {
    const { type, title } = options;
    this.setData({
      type: type || 'recent',
      title: decodeURIComponent(title || '游戏列表')
    });
    
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: this.data.title
    });
    
    this.loadGames();
  },

  // 加载游戏列表
  async loadGames(isLoadMore = false) {
    if (this.data.loading) return;
    if (isLoadMore && !this.data.hasMore) return;

    this.setData({ loading: true });

    try {
      let url = '/api/games';
      let params = {
        page: this.data.page,
        limit: this.data.pageSize
      };

      // 根据分类选择不同的API
      switch (this.data.type) {
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
      this.setData({ loading: false });
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    this.setData({
      page: 1,
      hasMore: true,
      games: []
    });
    await this.loadGames();
    wx.stopPullDownRefresh();
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadGames(true);
    }
  },

  // 点击游戏卡片
  goToGameDetail(e) {
    const game = e.currentTarget.dataset.game;
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${game.id}`
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.title} - AI游戏工坊`,
      path: `/pages/works-list/works-list?type=${this.data.type}&title=${encodeURIComponent(this.data.title)}`
    };
  }
});
