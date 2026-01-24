/**
 * 游戏详情页
 */
const app = getApp();

Page({
  data: {
    gameId: null,
    game: null,
    loading: true,
    
    // 交互状态
    liked: false,
    favorited: false,
    likeCount: 0,
    
    // 评论
    comments: [],
    loadingComments: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ gameId: options.id });
      this.loadGameDetail(options.id);
    } else {
      app.showToast('游戏不存在');
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载游戏详情
  async loadGameDetail(id) {
    this.setData({ loading: true });
    
    try {
      const result = await app.request(`/api/games/${id}`);
      
      if (result.success && result.game) {
        this.setData({
          game: result.game,
          likeCount: result.game.likes || 0
        });
        
        // 设置页面标题
        wx.setNavigationBarTitle({
          title: result.game.title || '游戏详情'
        });

        // 加载点赞状态
        this.loadLikeStatus(id);
        
        // 加载评论
        this.loadComments(id);
        
        // 记录访问
        this.recordPlay(id);
      } else {
        app.showToast('游戏不存在或已删除');
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (err) {
      console.error('加载游戏详情失败:', err);
      app.showToast('加载失败，请重试');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载点赞状态
  async loadLikeStatus(id) {
    try {
      const result = await app.request(`/api/games/${id}/like-status`);
      if (result.success) {
        this.setData({ liked: result.liked });
      }
    } catch (err) {
      console.error('加载点赞状态失败:', err);
    }
  },

  // 加载评论
  async loadComments(id) {
    this.setData({ loadingComments: true });
    
    try {
      const result = await app.request(`/api/games/${id}/comments`, {
        data: { limit: 10 }
      });
      
      if (result.success) {
        this.setData({ comments: result.comments || [] });
      }
    } catch (err) {
      console.error('加载评论失败:', err);
    } finally {
      this.setData({ loadingComments: false });
    }
  },

  // 记录访问
  async recordPlay(id) {
    try {
      await app.request(`/api/games/${id}/play`, { method: 'POST' });
    } catch (err) {
      // 忽略错误
    }
  },

  // 去网页玩游戏
  playGame() {
    const game = this.data.game;
    if (!game) return;
    
    // 构建游戏URL
    const gameUrl = `${app.globalData.config.webUrl}/g/${game.id.substring(0, 2)}/${game.id}.html`;
    
    app.copyAndOpenWeb(gameUrl, '链接已复制！请在浏览器中打开玩游戏');
  },

  // 点赞
  async handleLike() {
    if (!app.globalData.isLoggedIn) {
      app.showToast('请先登录');
      return;
    }

    const gameId = this.data.gameId;
    const currentLiked = this.data.liked;
    
    // 乐观更新
    this.setData({
      liked: !currentLiked,
      likeCount: this.data.likeCount + (currentLiked ? -1 : 1)
    });

    try {
      const result = await app.request(`/api/games/${gameId}/like`, {
        method: 'POST'
      });
      
      if (!result.success) {
        // 回滚
        this.setData({
          liked: currentLiked,
          likeCount: this.data.likeCount + (currentLiked ? 1 : -1)
        });
        app.showToast(result.error || '操作失败');
      }
    } catch (err) {
      // 回滚
      this.setData({
        liked: currentLiked,
        likeCount: this.data.likeCount + (currentLiked ? 1 : -1)
      });
      app.showToast('网络错误');
    }
  },

  // 收藏
  async handleFavorite() {
    if (!app.globalData.isLoggedIn) {
      app.showToast('请先登录');
      return;
    }

    const gameId = this.data.gameId;
    const currentFavorited = this.data.favorited;
    
    this.setData({ favorited: !currentFavorited });

    try {
      const result = await app.request(`/api/games/${gameId}/favorite`, {
        method: 'POST'
      });
      
      if (result.success) {
        app.showToast(currentFavorited ? '已取消收藏' : '收藏成功', 'success');
      } else {
        this.setData({ favorited: currentFavorited });
        app.showToast(result.error || '操作失败');
      }
    } catch (err) {
      this.setData({ favorited: currentFavorited });
      app.showToast('网络错误');
    }
  },

  // 分享
  onShareAppMessage() {
    const game = this.data.game;
    return {
      title: game ? `来玩这个AI生成的游戏: ${game.title}` : 'AI游戏工坊',
      path: `/pages/game-detail/game-detail?id=${this.data.gameId}`,
      imageUrl: '' // 可以添加游戏截图
    };
  },

  // 查看作者
  viewAuthor() {
    const game = this.data.game;
    if (!game || !game.author_token) {
      app.showToast('作者信息不可用');
      return;
    }
    
    // 跳转到网页查看作者
    app.copyAndOpenWeb(
      `${app.globalData.config.webUrl}#user/${game.author_token}`,
      '请在浏览器中查看作者主页'
    );
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
});
