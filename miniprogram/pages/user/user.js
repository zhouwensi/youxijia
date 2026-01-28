/**
 * 用户主页
 */
const app = getApp();

Page({
  data: {
    userToken: '',
    userInfo: null,
    isFollowing: false,
    isSelf: false,
    
    // 统计数据
    stats: {
      following: 0,
      followers: 0,
      games: 0
    },
    
    // 作品列表
    games: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20
  },

  onLoad(options) {
    const { token } = options;
    if (token) {
      this.setData({ userToken: token });
      this.loadUserProfile();
      this.loadUserGames();
    } else {
      app.showToast('用户不存在');
      wx.navigateBack();
    }
  },

  // 加载用户信息
  async loadUserProfile() {
    try {
      const { userToken } = this.data;
      const myToken = app.globalData.userToken;
      
      // 并行请求用户信息和关注状态
      const [profileRes, statsRes, followRes] = await Promise.all([
        app.request(`/api/users/${userToken}/profile`),
        app.request(`/api/users/${userToken}/follow-stats`),
        myToken ? app.request(`/api/users/${userToken}/follow-status`) : Promise.resolve({ success: false })
      ]);

      if (profileRes.success) {
        this.setData({
          userInfo: profileRes.data,
          isSelf: userToken === myToken
        });
        
        // 设置页面标题
        wx.setNavigationBarTitle({
          title: profileRes.data.nickname || '用户主页'
        });
      }

      if (statsRes.success) {
        this.setData({
          stats: {
            following: statsRes.followingCount || statsRes.following || 0,
            followers: statsRes.followerCount || statsRes.followers || 0,
            games: statsRes.gamesCount || 0
          }
        });
      }

      if (followRes.success) {
        this.setData({ isFollowing: followRes.following });
      }
    } catch (err) {
      console.error('加载用户信息失败:', err);
      app.showToast('加载失败');
    }
  },

  // 加载用户作品
  async loadUserGames(isLoadMore = false) {
    if (this.data.loading) return;
    if (isLoadMore && !this.data.hasMore) return;

    this.setData({ loading: true });

    try {
      const { userToken, page, pageSize } = this.data;
      const result = await app.request(`/api/users/${userToken}/games`, {
        data: { page, limit: pageSize }
      });

      if (result.success) {
        const newGames = result.data || result.games || [];
        const games = isLoadMore ? [...this.data.games, ...newGames] : newGames;
        
        this.setData({
          games,
          hasMore: newGames.length >= pageSize,
          page: isLoadMore ? page + 1 : 2
        });
      }
    } catch (err) {
      console.error('加载作品失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 关注/取消关注
  async toggleFollow() {
    if (this.data.isSelf) {
      app.showToast('不能关注自己');
      return;
    }

    if (!app.globalData.isLoggedIn) {
      app.showToast('请先登录');
      return;
    }

    try {
      const { userToken, isFollowing, stats } = this.data;
      const result = await app.request(`/api/users/${userToken}/follow`, {
        method: 'POST'
      });

      if (result.success) {
        this.setData({
          isFollowing: result.following,
          'stats.followers': result.following ? stats.followers + 1 : stats.followers - 1
        });
        app.showToast(result.following ? '关注成功' : '已取消关注');
      }
    } catch (err) {
      console.error('关注操作失败:', err);
      app.showToast('操作失败');
    }
  },

  // 查看关注列表
  showFollowing() {
    // TODO: 打开关注列表弹窗
    app.showToast('功能开发中');
  },

  // 查看粉丝列表
  showFollowers() {
    // TODO: 打开粉丝列表弹窗
    app.showToast('功能开发中');
  },

  // 点击游戏
  goToGameDetail(e) {
    const game = e.currentTarget.dataset.game;
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${game.id}`
    });
  },

  // 上拉加载
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadUserGames(true);
    }
  },

  // 分享
  onShareAppMessage() {
    const { userInfo, userToken } = this.data;
    return {
      title: `${userInfo?.nickname || '游戏家用户'}的主页`,
      path: `/pages/user/user?token=${userToken}`
    };
  }
});
