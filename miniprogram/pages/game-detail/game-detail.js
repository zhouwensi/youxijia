/**
 * 游戏详情页 - 增强版
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
    viewCount: 0,
    commentCount: 0,
    
    // 作者关注状态
    authorFollowed: false,
    followingAuthor: false,
    
    // 评论
    comments: [],
    loadingComments: false,
    commentText: '',
    submittingComment: false,
    
    // 作者操作状态
    isOwner: false,
    isSelfGame: false,  // 是否是自己的游戏
    repairing: false,
    repairCost: 0.5
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

  // 下拉刷新
  async onPullDownRefresh() {
    const { gameId } = this.data;
    if (gameId) {
      await this.loadGameDetail(gameId);
    }
    wx.stopPullDownRefresh();
  },

  // 加载游戏详情
  async loadGameDetail(id) {
    this.setData({ loading: true });
    
    try {
      const result = await app.request(`/api/games/${id}`);
      
      if (result.success && result.game) {
        // 判断是否是作者（使用正确的token字段）
        const userToken = app.globalData.token || app.globalData.userToken;
        const isOwner = userToken && result.game.author_token === userToken;
        
        console.log('[游戏详情] 作者判断:', { 
          userToken: userToken ? userToken.substring(0, 8) + '...' : null, 
          authorToken: result.game.author_token ? result.game.author_token.substring(0, 8) + '...' : null,
          isOwner: isOwner 
        });
        
        // 获取统计数据，兼容多种字段名
        const gameData = result.game;
        const viewCount = gameData.play_count || gameData.plays || gameData.view_count || gameData.views || 0;
        const likeCount = gameData.like_count || gameData.likes || 0;
        const commentCount = gameData.comment_count || gameData.comments_count || 0;
        
        console.log('[游戏详情] 统计数据:', { viewCount, likeCount, commentCount, raw: gameData });
        
        this.setData({
          game: result.game,
          viewCount: viewCount,
          likeCount: likeCount,
          commentCount: commentCount,
          isOwner: isOwner,
          // 如果是自己的游戏，关注按钮状态应该隐藏
          isSelfGame: isOwner
        });
        
        // 设置页面标题
        wx.setNavigationBarTitle({
          title: result.game.title || '游戏详情'
        });

        // 并行加载状态
        this.loadInteractionStatus(id, result.game.author_token);
        
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

  // 并行加载交互状态
  async loadInteractionStatus(gameId, authorToken) {
    try {
      const requests = [
        app.request(`/api/games/${gameId}/like-status`),
        app.request(`/api/games/${gameId}/favorite-status`)
      ];

      // 如果有作者token，加载关注状态
      if (authorToken) {
        requests.push(app.request(`/api/users/${authorToken}/follow-status`));
      }

      const [likeResult, favoriteResult, followResult] = await Promise.all(requests);

      const updates = {};
      if (likeResult?.success) {
        updates.liked = likeResult.liked;
      }
      if (favoriteResult?.success) {
        updates.favorited = favoriteResult.favorited;
      }
      if (followResult?.success) {
        // 服务端返回的字段是 'following' 不是 'followed'
        updates.authorFollowed = followResult.following || followResult.followed || false;
      }

      console.log('交互状态:', { likeResult, favoriteResult, followResult, updates });
      this.setData(updates);
    } catch (err) {
      console.error('加载交互状态失败:', err);
    }
  },

  // 加载评论
  async loadComments(id) {
    this.setData({ loadingComments: true });
    
    try {
      const result = await app.request(`/api/games/${id}/comments`, {
        data: { limit: 50 }
      });
      
      if (result.success) {
        const comments = result.comments || [];
        // 同步更新评论数
        this.setData({ 
          comments: comments,
          commentCount: comments.length
        });
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
      
      if (result.success) {
        // 刷新积分（点赞可能有积分变化）
        if (result.creditChange) {
          this.refreshUserCredits();
        }
      } else {
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

  // 关注作者
  async handleFollowAuthor() {
    if (!app.globalData.isLoggedIn) {
      app.showToast('请先登录');
      return;
    }

    const game = this.data.game;
    if (!game || !game.author_token) {
      app.showToast('作者信息不可用');
      return;
    }

    // 不能关注自己
    if (this.data.isSelfGame) {
      app.showToast('不能关注自己哦');
      return;
    }

    // 防止重复点击
    if (this.data.followingAuthor) return;
    this.setData({ followingAuthor: true });

    const currentFollowed = this.data.authorFollowed;
    
    // 乐观更新
    this.setData({ authorFollowed: !currentFollowed });

    try {
      const result = await app.request(`/api/users/${game.author_token}/follow`, {
        method: 'POST'
      });
      
      if (result.success) {
        app.showToast(currentFollowed ? '已取消关注' : '关注成功', 'success');
      } else {
        this.setData({ authorFollowed: currentFollowed });
        app.showToast(result.error || '操作失败');
      }
    } catch (err) {
      this.setData({ authorFollowed: currentFollowed });
      app.showToast('网络错误');
    } finally {
      this.setData({ followingAuthor: false });
    }
  },

  // 分享
  onShareAppMessage() {
    const game = this.data.game;
    const appName = app.getAppName();
    return {
      title: game ? `来玩这个AI生成的游戏: ${game.title}` : appName,
      path: `/pages/game-detail/game-detail?id=${this.data.gameId}`,
      imageUrl: '' // 可以添加游戏截图
    };
  },

  // 查看作者主页
  viewAuthor() {
    const game = this.data.game;
    if (!game || !game.author_token) {
      app.showToast('作者信息不可用');
      return;
    }
    
    wx.navigateTo({
      url: `/pages/user/user?token=${game.author_token}`
    });
  },

  // AI修复游戏
  async handleRepair() {
    if (!app.globalData.isLoggedIn) {
      app.showToast('请先登录');
      return;
    }

    if (this.data.repairing) {
      app.showToast('正在修复中，请稍候...');
      return;
    }

    // 确认对话框（小程序端无需积分）
    wx.showModal({
      title: '🔧 AI修复游戏',
      content: 'AI将自动分析并修复游戏代码中的错误',
      success: async (res) => {
        if (res.confirm) {
          await this.executeRepair();
        }
      }
    });
  },

  // 执行修复
  async executeRepair() {
    this.setData({ repairing: true });
    app.showToast('开始修复游戏...', 'loading');

    try {
      const result = await app.request(`/api/games/${this.data.gameId}/repair`, {
        method: 'POST',
        data: { creditCost: this.data.repairCost }
      });

      if (result.success) {
        // 开始轮询修复状态
        this.pollRepairStatus();
      } else {
        app.showToast(result.error || '修复失败');
        this.setData({ repairing: false });
      }
    } catch (err) {
      console.error('修复请求失败:', err);
      app.showToast('网络错误，请重试');
      this.setData({ repairing: false });
    }
  },

  // 轮询修复状态
  async pollRepairStatus() {
    const maxAttempts = 60; // 最多轮询60次（约2分钟）
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        app.showToast('修复超时，请稍后查看');
        this.setData({ repairing: false });
        return;
      }

      try {
        const result = await app.request(`/api/games/${this.data.gameId}/repair-status`);
        
        if (result.status === 'completed') {
          app.showToast('修复成功！', 'success');
          this.setData({ repairing: false });
          // 刷新游戏详情
          this.loadGameDetail(this.data.gameId);
          // 刷新积分
          app.loadUserInfo();
          return;
        } else if (result.status === 'failed') {
          app.showToast(result.error || '修复失败');
          this.setData({ repairing: false });
          return;
        }

        // 继续轮询
        attempts++;
        setTimeout(poll, 2000);
      } catch (err) {
        console.error('轮询修复状态失败:', err);
        attempts++;
        setTimeout(poll, 2000);
      }
    };

    poll();
  },

  // 编辑游戏
  handleEdit() {
    if (!app.globalData.isLoggedIn) {
      app.showToast('请先登录');
      return;
    }

    // 跳转到编辑页面
    wx.navigateTo({
      url: `/pages/game-edit/game-edit?id=${this.data.gameId}`
    });
  },

  // 评论输入
  onCommentInput(e) {
    this.setData({ commentText: e.detail.value });
  },

  // 提交评论
  async submitComment() {
    if (!app.globalData.isLoggedIn) {
      app.showToast('请先登录');
      return;
    }

    const content = this.data.commentText.trim();
    if (!content) {
      app.showToast('请输入评论内容');
      return;
    }

    if (content.length > 500) {
      app.showToast('评论内容不能超过500字');
      return;
    }

    if (this.data.submittingComment) return;
    this.setData({ submittingComment: true });

    try {
      const result = await app.request(`/api/games/${this.data.gameId}/comments`, {
        method: 'POST',
        data: { content }
      });

      if (result.success) {
        // 清空输入框
        this.setData({ commentText: '' });
        
        // 添加新评论到列表顶部
        const newComment = result.comment || {
          id: Date.now(),
          content: content,
          user_name: app.globalData.userInfo?.name || '我',
          user_avatar: app.globalData.userInfo?.avatar || '👤',
          created_at: '刚刚'
        };
        
        const comments = [newComment, ...this.data.comments];
        // 同步更新评论数
        this.setData({ 
          comments,
          commentCount: comments.length
        });
        
        app.showToast('评论成功', 'success');
        
        // 刷新积分（评论可能有积分奖励）
        if (result.creditAwarded) {
          app.loadUserInfo();
        }
      } else {
        app.showToast(result.error || '评论失败');
      }
    } catch (err) {
      console.error('提交评论失败:', err);
      app.showToast('网络错误，请重试');
    } finally {
      this.setData({ submittingComment: false });
    }
  },

  // 刷新用户积分
  async refreshUserCredits() {
    try {
      const result = await app.request('/api/credits');
      if (result && result.success !== false) {
        // 更新全局积分信息
        if (app.globalData.userInfo) {
          app.globalData.userInfo.credits = result.credits || 0;
        }
      }
    } catch (err) {
      console.error('刷新积分失败:', err);
    }
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
