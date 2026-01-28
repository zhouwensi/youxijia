/**
 * 排行榜页面
 */
const app = getApp();

Page({
  data: {
    // 主分类：游戏榜/作者榜
    currentCategory: 'games',
    categories: [
      { id: 'games', name: '🎮 游戏榜' },
      { id: 'authors', name: '👑 作者榜' }
    ],
    
    // 时间维度
    currentPeriod: 'total',
    periods: [
      { id: 'day', name: '日榜' },
      { id: 'week', name: '周榜' },
      { id: 'month', name: '月榜' },
      { id: 'total', name: '总榜' }
    ],
    
    // 列表数据
    rankList: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20
  },

  onLoad() {
    this.loadRankList();
  },

  onShow() {
    // 刷新数据
  },

  // 切换主分类
  switchCategory(e) {
    const category = e.currentTarget.dataset.category;
    if (category !== this.data.currentCategory) {
      this.setData({
        currentCategory: category,
        rankList: [],
        page: 1,
        hasMore: true
      });
      this.loadRankList();
    }
  },

  // 切换时间维度
  switchPeriod(e) {
    const period = e.currentTarget.dataset.period;
    if (period !== this.data.currentPeriod) {
      this.setData({
        currentPeriod: period,
        rankList: [],
        page: 1,
        hasMore: true
      });
      this.loadRankList();
    }
  },

  // 加载排行榜数据
  async loadRankList(isLoadMore = false) {
    if (this.data.loading) return;
    if (isLoadMore && !this.data.hasMore) return;

    this.setData({ loading: true });

    try {
      const { currentCategory, currentPeriod, page, pageSize } = this.data;
      const url = currentCategory === 'games' 
        ? '/api/rank/games' 
        : '/api/rank/authors';

      const result = await app.request(url, {
        data: {
          period: currentPeriod,
          page: page,
          limit: pageSize
        }
      });

      if (result.success) {
        const newList = result.data || [];
        const rankList = isLoadMore ? [...this.data.rankList, ...newList] : newList;
        
        this.setData({
          rankList,
          hasMore: newList.length >= pageSize,
          page: isLoadMore ? page + 1 : 2
        });
      } else {
        app.showToast(result.error || '加载失败');
      }
    } catch (err) {
      console.error('加载排行榜失败:', err);
      app.showToast('网络错误，请重试');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    this.loadRankList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadRankList(true);
    }
  },

  // 点击游戏
  goToGameDetail(e) {
    const game = e.currentTarget.dataset.game;
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${game.id}`
    });
  },

  // 点击作者
  goToUserProfile(e) {
    const user = e.currentTarget.dataset.user;
    wx.navigateTo({
      url: `/pages/user/user?token=${user.token}`
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'AI游戏工坊 - 排行榜',
      path: '/pages/rank/rank'
    };
  }
});
