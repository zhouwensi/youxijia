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
    loadingFollow: false,
    
    // 昵称编辑弹窗
    showNicknameModal: false,
    nicknameInput: ''
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    // 更新自定义TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    
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
      const myToken = app.globalData.token;
      
      // 并行请求
      const requests = [
        app.request('/api/credits'),
        app.request('/api/account')
      ];
      
      // 如果有token，请求关注统计
      if (myToken) {
        requests.push(app.request(`/api/users/${myToken}/follow-stats`));
      }

      const [creditsResult, accountResult, statsResult] = await Promise.all(requests);

      console.log('我的页面数据:', { creditsResult, accountResult, statsResult });

      const updates = {};

      if (creditsResult && creditsResult.success !== false) {
        // 格式化积分，保留1位小数
        const credits = creditsResult.credits || 0;
        updates['stats.credits'] = Number.isInteger(credits) ? credits : parseFloat(credits.toFixed(1));
      }

      if (accountResult && accountResult.success !== false) {
        const account = accountResult.account || accountResult.data || accountResult;
        if (account && account.account_id) {
          updates.userInfo = account;
          updates['stats.games'] = account.games_count || 0;
          
          // 更新全局状态
          app.globalData.userInfo = account;
          wx.setStorageSync('userInfo', account);
        }
      }

      if (statsResult && statsResult.success !== false) {
        updates['stats.following'] = statsResult.followingCount || statsResult.following || 0;
        updates['stats.followers'] = statsResult.followerCount || statsResult.followers || 0;
        console.log('关注统计:', updates['stats.following'], updates['stats.followers']);
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
          url = '/api/my-games';
          break;
        case 'likes':
          url = '/api/my-likes';
          break;
        case 'favorites':
          url = '/api/my-favorites';
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
      const myToken = app.globalData.token;
      if (!myToken) {
        console.error('未登录，无法获取关注列表');
        return;
      }
      
      const url = type === 'following' 
        ? `/api/users/${myToken}/following` 
        : `/api/users/${myToken}/followers`;
      const result = await app.request(url);

      console.log('关注列表响应:', type, result);

      if (result.success !== false) {
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
      const loginResult = await app.wxLogin();
      this.checkLoginStatus();
      await this.loadUserData();
      this.loadListData();
      app.showToast('登录成功', 'success');
      
      // 检查是否需要引导设置昵称（新用户或默认昵称）
      this.checkNicknameGuide();
    } catch (err) {
      console.error('登录失败:', err);
      app.showToast('登录失败，请重试');
    } finally {
      wx.hideLoading();
    }
  },

  // 检查是否需要引导设置昵称
  checkNicknameGuide() {
    const userInfo = this.data.userInfo;
    if (!userInfo) return;
    
    const nickname = userInfo.nickname || '';
    // 如果昵称是默认值，引导用户设置
    const isDefaultNickname = !nickname || 
      nickname === '微信用户' || 
      nickname === '游戏玩家' ||
      nickname === userInfo.account_id;
    
    if (isDefaultNickname) {
      // 延迟弹出，避免与登录成功提示冲突
      setTimeout(() => {
        wx.showModal({
          title: '欢迎来到AI游戏工坊！',
          content: '设置一个昵称，让大家认识你吧～',
          confirmText: '去设置',
          cancelText: '稍后再说',
          success: (res) => {
            if (res.confirm) {
              this.showNicknameEditor();
            }
          }
        });
      }, 800);
    }
  },

  // 去设置页（目前跳转到LLM设置）
  goToSettings() {
    wx.navigateTo({
      url: '/pages/llm-settings/llm-settings'
    });
  },

  // 去LLM设置页
  goToLLMSettings() {
    wx.navigateTo({
      url: '/pages/llm-settings/llm-settings'
    });
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
  },

  // 显示昵称编辑弹窗
  showNicknameEditor() {
    const currentNickname = this.data.userInfo?.nickname || '';
    // 如果当前昵称是"微信用户"或与account_id相同，则显示空
    const displayNickname = (currentNickname === '微信用户' || currentNickname === this.data.userInfo?.account_id) 
      ? '' 
      : currentNickname;
    
    this.setData({
      showNicknameModal: true,
      nicknameInput: displayNickname
    });
  },

  // 关闭昵称编辑弹窗
  closeNicknameModal() {
    this.setData({
      showNicknameModal: false,
      nicknameInput: ''
    });
  },

  // 昵称输入事件
  onNicknameInput(e) {
    this.setData({
      nicknameInput: e.detail.value
    });
  },

  // 昵称输入框失去焦点（微信昵称选择完成）
  onNicknameBlur(e) {
    // 当用户从微信昵称选择器中选择昵称后，会触发blur事件
    if (e.detail.value) {
      this.setData({
        nicknameInput: e.detail.value
      });
    }
  },

  // 保存昵称
  async saveNickname() {
    const nickname = this.data.nicknameInput.trim();
    
    if (!nickname) {
      app.showToast('请输入昵称');
      return;
    }
    
    if (nickname.length < 1 || nickname.length > 20) {
      app.showToast('昵称长度1-20个字符');
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const result = await app.request('/api/account/nickname', {
        method: 'PUT',
        data: { nickname }
      });

      if (result.success !== false) {
        // 更新本地数据
        const updatedUserInfo = {
          ...this.data.userInfo,
          nickname: nickname
        };
        
        this.setData({
          userInfo: updatedUserInfo,
          showNicknameModal: false,
          nicknameInput: ''
        });

        // 更新全局状态
        app.globalData.userInfo = updatedUserInfo;
        wx.setStorageSync('userInfo', updatedUserInfo);

        app.showToast('昵称已更新', 'success');
      } else {
        app.showToast(result.error || '保存失败');
      }
    } catch (err) {
      console.error('保存昵称失败:', err);
      app.showToast('保存失败，请重试');
    } finally {
      wx.hideLoading();
    }
  }
});
