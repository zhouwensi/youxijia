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
    
    // 排序类型（游戏榜）
    currentType: 'likes',
    
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
    // 更新自定义TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
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
      const { currentCategory, currentPeriod, currentType, page, pageSize } = this.data;
      
      let url, params;
      
      if (currentCategory === 'games') {
        // 游戏排行榜 - 使用 /api/leaderboard/games
        url = '/api/leaderboard/games';
        params = {
          type: currentType, // likes, plays, recent
          limit: pageSize,
          period: currentPeriod
        };
      } else {
        // 作者排行榜 - 使用 /api/author-leaderboard/popularity (热度榜)
        // 支持的type: fans(粉丝榜), works(作品榜), credits(积分榜), popularity(热度榜), newstar(新星榜)
        url = '/api/author-leaderboard/popularity';
        params = {
          limit: pageSize,
          offset: (page - 1) * pageSize,
          period: currentPeriod === 'total' ? 'all' : currentPeriod // 服务端用 'all' 表示总榜
        };
      }

      console.log('排行榜请求:', url, params);

      const result = await app.request(url, {
        data: params
      });

      console.log('排行榜响应:', result);

      if (result.success !== false) {
        let newList = [];
        
        if (currentCategory === 'games') {
          // 游戏榜数据
          newList = result.games || result.data || result.list || [];
          // 添加排名
          newList = newList.map((item, index) => ({
            ...item,
            rank: (page - 1) * pageSize + index + 1
          }));
        } else {
          // 作者榜数据
          newList = result.creators || result.list || result.data || [];
          // 添加排名（如果没有）
          newList = newList.map((item, index) => ({
            ...item,
            rank: item.rank || ((page - 1) * pageSize + index + 1)
          }));
        }
        
        const rankList = isLoadMore ? [...this.data.rankList, ...newList] : newList;
        
        this.setData({
          rankList,
          hasMore: newList.length >= pageSize,
          page: isLoadMore ? page + 1 : 2
        });
      } else {
        console.error('排行榜加载失败:', result.error);
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
    if (game && game.id) {
      wx.navigateTo({
        url: `/pages/game-detail/game-detail?id=${game.id}`
      });
    }
  },

  // 点击作者
  goToUserProfile(e) {
    const user = e.currentTarget.dataset.user;
    const token = user.token || user.user_token || user.author_token;
    if (token) {
      wx.navigateTo({
        url: `/pages/user/user?token=${token}`
      });
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'AI游戏工坊 - 排行榜',
      path: '/pages/rank/rank'
    };
  }
});