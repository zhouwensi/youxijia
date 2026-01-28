/**
 * 搜索页面
 */
const app = getApp();

Page({
  data: {
    keyword: '',
    searchType: 'games', // games / users
    results: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    showResult: false
  },

  onLoad(options) {
    if (options.keyword) {
      this.setData({ keyword: options.keyword });
      this.doSearch();
    }
  },

  // 输入关键词
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  // 切换搜索类型
  switchType(e) {
    const type = e.currentTarget.dataset.type;
    if (type !== this.data.searchType) {
      this.setData({
        searchType: type,
        results: [],
        page: 1,
        hasMore: true
      });
      if (this.data.keyword) {
        this.doSearch();
      }
    }
  },

  // 执行搜索
  async doSearch(isLoadMore = false) {
    const { keyword, searchType, page, pageSize, loading, hasMore } = this.data;
    
    if (!keyword.trim()) {
      app.showToast('请输入搜索内容');
      return;
    }
    
    if (loading) return;
    if (isLoadMore && !hasMore) return;

    this.setData({ loading: true, showResult: true });

    try {
      const url = searchType === 'games' 
        ? `/api/games/search/${encodeURIComponent(keyword)}`
        : `/api/users/search/${encodeURIComponent(keyword)}`;

      const result = await app.request(url, {
        data: { page, limit: pageSize }
      });

      if (result.success) {
        const newResults = result.data || result.games || result.users || [];
        const results = isLoadMore ? [...this.data.results, ...newResults] : newResults;
        
        this.setData({
          results,
          hasMore: newResults.length >= pageSize,
          page: isLoadMore ? page + 1 : 2
        });
      }
    } catch (err) {
      console.error('搜索失败:', err);
      app.showToast('搜索失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 清空搜索
  clearSearch() {
    this.setData({
      keyword: '',
      results: [],
      showResult: false,
      page: 1,
      hasMore: true
    });
  },

  // 点击游戏
  goToGameDetail(e) {
    const game = e.currentTarget.dataset.game;
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${game.id}`
    });
  },

  // 点击用户
  goToUserProfile(e) {
    const user = e.currentTarget.dataset.user;
    wx.navigateTo({
      url: `/pages/user/user?token=${user.token}`
    });
  },

  // 上拉加载
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.doSearch(true);
    }
  }
});
