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
    
    // 订阅通知
    subscribeCount: 0,
    subscribing: false,
    
    // 创作中的任务
    creatingTasks: [],
    
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
    nicknameInput: '',
    
    // 功能开关（从全局配置读取）
    llmDisabled: false,
    creditsHidden: false,  // 为 true 时完全隐藏积分相关
    // 网站激活状态
    webActivated: false,
    /** 是否已设置网站登录密码（与 GET /api/account hasPassword 一致） */
    hasWebPassword: false
  },

  onLoad() {
    // 从全局配置读取功能开关
    this.setData({
      llmDisabled: app.globalData.miniprogramLLMDisabled === true,
      creditsHidden: app.globalData.creditsEarningHidden === true
    });
    
    this.checkLoginStatus();
  },

  onShow() {
    // 更新自定义TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    
    // 刷新功能开关（配置可能在运行时更新）
    this.setData({
      llmDisabled: app.globalData.miniprogramLLMDisabled === true,
      creditsHidden: app.globalData.creditsEarningHidden === true
    });
    
    this.checkLoginStatus();
    if (app.globalData.isLoggedIn) {
      this.loadUserData();
      this.loadListData();
      
      // 启动草稿状态轮询（检测创作中游戏是否完成）
      this.startDraftPolling();
    }
  },

  onHide() {
    // 停止轮询
    this.stopDraftPolling();
  },

  onUnload() {
    // 停止轮询
    this.stopDraftPolling();
  },

  // 启动草稿状态轮询
  startDraftPolling() {
    // 先停止旧的轮询
    this.stopDraftPolling();
    
    // 每5秒检查一次是否有草稿状态变化
    this._draftPollTimer = setInterval(() => {
      this.checkDraftStatus();
    }, 5000);
  },

  // 停止草稿状态轮询
  stopDraftPolling() {
    if (this._draftPollTimer) {
      clearInterval(this._draftPollTimer);
      this._draftPollTimer = null;
    }
  },

  // 检查草稿状态是否有变化
  async checkDraftStatus() {
    const listData = this.data.listData || [];
    const hasDraft = listData.some(item => item.status === 'draft');
    
    // 如果没有草稿，不需要轮询
    if (!hasDraft) {
      this.stopDraftPolling();
      return;
    }
    
    try {
      // 重新加载列表数据
      const result = await app.request('/api/my-games', {
        data: { page: 1, limit: 20 }
      });
      
      if (result.success) {
        const newData = result.data || result.games || [];
        const oldDraftIds = listData.filter(item => item.status === 'draft').map(item => item.id);
        const newDraftIds = newData.filter(item => item.status === 'draft').map(item => item.id);
        
        // 检查是否有草稿状态变化（草稿变成已发布）
        const hasChange = oldDraftIds.some(id => !newDraftIds.includes(id));
        
        if (hasChange) {
          console.log('[草稿轮询] 检测到状态变化，刷新列表');
          this.setData({
            listData: newData,
            hasMore: newData.length >= 20
          });
          
          // 刷新用户数据（作品数量可能变了）
          this.loadUserData();
          
          // 显示提示
          wx.showToast({
            title: '游戏创作完成！',
            icon: 'success',
            duration: 2000
          });
        }
      }
    } catch (err) {
      console.error('[草稿轮询] 检查失败:', err);
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    app.checkLoginStatus();
    const isLoggedIn = app.globalData.isLoggedIn;
    const userInfo = app.globalData.userInfo
      ? app.normalizeUserInfo(app.globalData.userInfo)
      : null;

    this.setData({
      isLoggedIn,
      userInfo,
    });
  },

  // 加载用户数据
  async loadUserData() {
    const safeRequest = async (label, fn) => {
      try {
        return { ok: true, data: await fn() };
      } catch (e) {
        console.warn(`[我的] ${label} 请求失败:`, e && e.message ? e.message : e);
        return { ok: false, err: e };
      }
    };

    try {
      app.checkLoginStatus();
      let myToken = app.globalData.token;
      if (!myToken) {
        myToken = wx.getStorageSync('userToken') || wx.getStorageSync('token') || '';
        if (myToken) app.globalData.token = myToken;
      }
      const creditsHidden = app.globalData.creditsEarningHidden === true;

      // 各接口独立失败，避免 Cloudflare 版未实现或单接口 404 拖垮整页
      const [creditsR, accountR, subscribeR, statsR] = await Promise.all([
        creditsHidden
          ? Promise.resolve({ ok: true, data: null })
          : safeRequest('credits', () => app.request('/api/credits')),
        safeRequest('account', () => app.request('/api/account')),
        safeRequest('subscribe-count', () => app.request('/api/user/subscribe-count')),
        myToken
          ? safeRequest('follow-stats', () =>
              app.request(`/api/users/${encodeURIComponent(myToken)}/follow-stats`),
            )
          : Promise.resolve({ ok: true, data: null }),
      ]);

      const creditsResult = creditsR.ok ? creditsR.data : null;
      const accountResult = accountR.ok ? accountR.data : null;
      const subscribeResult = subscribeR.ok ? subscribeR.data : null;
      const statsResult = statsR.ok ? statsR.data : null;

      console.log('我的页面数据:', { creditsResult, accountResult, statsResult });

      const updates = {};

      if (!creditsHidden && creditsResult && creditsResult.success !== false) {
        const credits = creditsResult.credits || 0;
        updates['stats.credits'] = app.formatCredits(credits);
      }

      if (accountResult && accountResult.success !== false) {
        const account = accountResult.account || accountResult.data || accountResult;
        const aid = account && (account.accountId || account.account_id);
        if (account && aid) {
          const merged = app.normalizeUserInfo({
            ...(this.data.userInfo || {}),
            ...account,
            avatar_emoji: (this.data.userInfo && this.data.userInfo.avatar_emoji) || '🎮',
          });
          updates.userInfo = merged;
          updates['stats.games'] = account.games_count || 0;
          updates.hasWebPassword = !!(account.hasPassword === true || account.has_password === true);

          // 更新全局状态
          app.globalData.userInfo = merged;
          wx.setStorageSync('userInfo', merged);
        }
      }

      if (subscribeResult && subscribeResult.success !== false) {
        updates.subscribeCount = subscribeResult.subscribeCount || 0;
      }

      if (statsResult && statsResult.success !== false) {
        updates['stats.following'] = statsResult.followingCount || statsResult.following || 0;
        updates['stats.followers'] = statsResult.followerCount || statsResult.followers || 0;
        console.log('关注统计:', updates['stats.following'], updates['stats.followers']);
      }

      // GET /api/account 失败时仍保持微信登录态（wxLogin 已写入 globalData / storage）
      if (app.globalData.isLoggedIn) {
        updates.isLoggedIn = true;
        if (updates.userInfo == null && app.globalData.userInfo) {
          updates.userInfo = app.normalizeUserInfo(app.globalData.userInfo);
        }
      }

      this.setData(updates);
      
      // 检查网站激活状态（异步，不阻塞主流程）
      this.checkWebActivateStatus();

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

      // 如果是"我的作品"tab且第一页，同时加载创作中的任务
      if (currentTab === 'games' && !isLoadMore) {
        this.loadCreatingTasks();
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

  // 加载创作中的任务
  async loadCreatingTasks() {
    try {
      const result = await app.request('/api/user/creating-tasks');
      if (result && result.success) {
        this.setData({
          creatingTasks: result.tasks || []
        });
        console.log('[创作中任务] 加载到', result.tasks?.length || 0, '个任务');
      }
    } catch (err) {
      console.error('[创作中任务] 加载失败:', err);
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

  goEmailAuth() {
    wx.navigateTo({ url: '/pages/auth/auth' });
  },

  // 登录
  async handleLogin() {
    wx.showLoading({ title: '登录中...' });
    
    try {
      const loginResult = await app.wxLogin();
      this.checkLoginStatus();
      // 立即切到已登录 UI，不依赖后续 /api/account（可能 404 或与 credits 库不一致）
      this.setData({
        isLoggedIn: true,
        userInfo: app.normalizeUserInfo(app.globalData.userInfo || {}),
      });
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
    const accId = userInfo.account_id || userInfo.accountId || '';
    // 如果昵称是默认值，引导用户设置
    const isDefaultNickname = !nickname || 
      nickname === '微信用户' || 
      nickname === '游戏玩家' ||
      nickname === accId;
    
    if (isDefaultNickname) {
      // 延迟弹出，避免与登录成功提示冲突
      setTimeout(() => {
        wx.showModal({
          title: `欢迎来到${app.getAppName()}！`,
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

  // 去设置页 - 弹出设置菜单
  goToSettings() {
    const that = this;
    const webActivated = this.data.webActivated;
    
    // 构建菜单项（已移除LLM设置，现在由后台统一配置）
    const menuItems = [];
    const menuActions = [];
    
    // 访问网页版
    menuItems.push('🌐 访问网页版');
    menuActions.push('web');
    
    // 设置 / 修改网站登录密码（与浏览器网站同一套密码）
    menuItems.push(
      this.data.hasWebPassword ? '🔐 修改登录密码' : '🔐 设置网站登录密码（网页登录用）'
    );
    menuActions.push('changepwd');

    // 微信用户绑定邮箱，与网站同一账号
    menuItems.push('📧 绑定邮箱（与网站同账号）');
    menuActions.push('bindemail');

    // 绑定网站/重置密码（旧流程，可选）
    menuItems.push(webActivated ? '🔑 网站激活链接(旧)' : '🔗 网站激活链接(旧)');
    menuActions.push('activate');
    
    // 关于我们
    menuItems.push('ℹ️ 关于我们');
    menuActions.push('about');
    
    wx.showActionSheet({
      itemList: menuItems,
      success(res) {
        const action = menuActions[res.tapIndex];
        switch (action) {
          case 'web':
            that.goToWeb();
            break;
          case 'changepwd':
            wx.navigateTo({ url: '/pages/auth/auth?mode=changepwd' });
            break;
          case 'bindemail':
            wx.navigateTo({ url: '/pages/auth/auth?mode=bindEmail' });
            break;
          case 'activate':
            that.generateWebActivateLink();
            break;
          case 'about':
            that.showAbout();
            break;
        }
      }
    });
  },

  // 显示积分信息（积分隐藏时不展示）
  showCreditsInfo() {
    if (app.globalData.creditsEarningHidden) return;
    wx.showModal({
      title: '我的积分',
      content: `当前积分: ${this.data.stats.credits}\n\n获取积分方式:\n• 每日登录\n• 邀请好友\n• 观看广告`,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 处理草稿游戏点击
  handleDraftTap(e) {
    const game = e.currentTarget.dataset.game;
    if (!game) return;
    
    wx.showModal({
      title: '🎮 游戏创作中',
      content: `"${game.title || '新游戏'}" 正在由AI创作中...\n\n您可以：\n• 点击🔔订阅完成通知\n• 稍后刷新页面查看`,
      confirmText: '订阅通知',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          // 触发草稿订阅
          this.handleDraftSubscribe({ currentTarget: { dataset: { game } } });
        }
      }
    });
  },

  // 处理草稿游戏的订阅（找到对应的创作中任务并订阅）
  async handleDraftSubscribe(e) {
    const game = e.currentTarget.dataset.game;
    if (!game) {
      app.showToast('游戏信息无效');
      return;
    }
    
    // 先刷新创作中任务列表，确保数据最新
    await this.loadCreatingTasks();
    
    // 在创作中任务列表中查找对应的任务
    const { creatingTasks } = this.data;
    let matchedTask = null;
    
    // 匹配策略：
    // 1. 通过 prompt 匹配（草稿游戏的 prompt 和创作任务的 prompt 应该一致）
    // 2. 通过标题匹配（草稿游戏的 title 通常是 prompt 的前50字符）
    if (game.prompt) {
      matchedTask = creatingTasks.find(t => t.prompt === game.prompt);
    }
    if (!matchedTask && game.title) {
      matchedTask = creatingTasks.find(t => 
        t.prompt && (t.prompt === game.title || t.prompt.startsWith(game.title))
      );
    }
    // 3. 通过 gameId 匹配（编辑/修复任务有 gameId）
    if (!matchedTask && game.id) {
      matchedTask = creatingTasks.find(t => t.gameId === game.id);
    }
    
    if (matchedTask) {
      // 找到对应任务，检查是否已订阅
      if (matchedTask.subscribed) {
        app.showToast('已订阅此任务');
        return;
      }
      console.log('[草稿订阅] 找到匹配任务:', matchedTask.taskId);
      this.handleTaskSubscribe({ currentTarget: { dataset: { task: matchedTask } } });
    } else {
      // 没有找到对应任务（可能任务已完成或内存已清理）
      console.log('[草稿订阅] 未找到匹配任务，creatingTasks:', creatingTasks.length, '游戏:', game.title);
      
      // 可能游戏已完成或任务过期，给用户选择
      wx.showModal({
        title: '创作任务已结束',
        content: '该游戏的创作任务可能已完成或已过期。\n\n建议刷新页面查看最新状态，或删除此草稿重新创作。',
        confirmText: '刷新页面',
        cancelText: '删除草稿',
        success: async (res) => {
          if (res.confirm) {
            // 刷新页面
            this.loadUserData();
            this.loadListData();
          } else if (res.cancel && game.id) {
            // 用户选择删除草稿
            try {
              const deleteResult = await app.request(`/api/games/${game.id}`, {
                method: 'DELETE'
              });
              if (deleteResult && deleteResult.success) {
                app.showToast('草稿已删除', 'success');
                this.loadListData();
              } else {
                app.showToast('删除失败');
              }
            } catch (err) {
              console.error('删除草稿失败:', err);
              app.showToast('删除失败');
            }
          }
        }
      });
    }
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
    const appName = app.getAppName();
    return {
      title: userInfo ? `${userInfo.nickname || userInfo.account_id}邀请你来玩AI游戏` : `${appName} - 一句话生成游戏`,
      path: '/pages/create/create'
    };
  },

  // 关于
  showAbout() {
    const appName = app.getAppName();
    wx.showModal({
      title: `关于${appName}`,
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
    // 先清空输入，延迟关闭弹窗，避免editor相关错误
    this.setData({
      nicknameInput: ''
    });
    // 延迟关闭，确保input组件完全销毁
    setTimeout(() => {
      this.setData({
        showNicknameModal: false
      });
    }, 100);
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

        // 检查是否获得积分奖励（积分隐藏时不展示积分文案）
        if (result.creditsEarned && result.creditsEarned > 0 && !app.globalData.creditsEarningHidden) {
          wx.showModal({
            title: '🎉 恭喜获得奖励',
            content: result.rewardMessage || `设置昵称成功！获得${result.creditsEarned}积分奖励`,
            showCancel: false,
            confirmText: '太棒了'
          });
        } else {
          app.showToast('昵称已更新', 'success');
        }
      } else {
        app.showToast(result.error || '保存失败');
      }
    } catch (err) {
      console.error('保存昵称失败:', err);
      app.showToast('保存失败，请重试');
    } finally {
      wx.hideLoading();
    }
  },

  // 复制账号ID
  copyAccountId(e) {
    const accountId = e.currentTarget.dataset.id;
    
    if (!accountId) {
      app.showToast('账号ID不存在');
      return;
    }

    wx.setClipboardData({
      data: accountId,
      success: () => {
        app.showToast('账号ID已复制', 'success');
      },
      fail: () => {
        app.showToast('复制失败，请重试');
      }
    });
  },

  // 检查网站激活状态
  async checkWebActivateStatus() {
    try {
      const result = await app.request('/api/user/web-status');
      if (result && result.success) {
        this.setData({
          webActivated: result.activated === true
        });
      }
    } catch (err) {
      console.error('检查网站激活状态失败:', err);
    }
  },

  // 生成网站激活链接
  async generateWebActivateLink() {
    const isReset = this.data.webActivated;
    
    // 确认操作
    const confirmResult = await new Promise(resolve => {
      wx.showModal({
        title: isReset ? '重置网站密码' : '绑定网站账号',
        content: isReset 
          ? '将生成一个重置链接，复制后在浏览器打开即可重新设置密码' 
          : '将生成一个激活链接，复制后在浏览器打开设置密码，即可用账号密码登录网站',
        confirmText: '生成链接',
        cancelText: '取消',
        success: resolve
      });
    });

    if (!confirmResult.confirm) return;

    wx.showLoading({ title: '生成中...' });

    try {
      const result = await app.request('/api/user/generate-activate-token', {
        method: 'POST',
        data: { type: isReset ? 'reset' : 'activate' }
      });

      wx.hideLoading();

      if (!result || !result.success) {
        // 显示详细错误信息
        wx.showModal({
          title: '生成失败',
          content: result?.error || '未知错误，请稍后重试',
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }

      // 复制链接到剪贴板
      const url = result.activateUrl;
      const expiresIn = result.expiresInMinutes || 10;

      wx.setClipboardData({
        data: url,
        success: () => {
          wx.showModal({
            title: '链接已复制 ✓',
            content: `请在浏览器中打开此链接完成${isReset ? '密码重置' : '账号激活'}\n\n⏰ 链接${expiresIn}分钟内有效\n🔒 链接仅可使用一次`,
            confirmText: '知道了',
            showCancel: false
          });
        },
        fail: () => {
          // 复制失败，显示链接让用户手动复制
          wx.showModal({
            title: '请手动复制链接',
            content: url,
            confirmText: '好的',
            showCancel: false
          });
        }
      });

    } catch (err) {
      wx.hideLoading();
      console.error('生成激活链接失败:', err);
      app.showToast('生成失败，请重试');
    }
  },

  // 处理任务订阅通知（订阅特定的创作中任务）
  async handleTaskSubscribe(e) {
    const task = e.currentTarget.dataset.task;
    if (!task || !task.taskId) {
      app.showToast('任务信息无效');
      return;
    }
    
    // 检查是否已订阅
    if (task.subscribed) {
      app.showToast('已订阅此任务');
      return;
    }
    
    if (this.data.subscribing) return;
    
    this.setData({ subscribing: true });
    
    try {
      // 获取订阅消息模板ID（从配置中读取）
      const tmplId = app.globalData.config?.wxSubscribeTmplId;
      
      if (!tmplId) {
        app.showToast('订阅功能暂未配置');
        console.error('[订阅] 未配置订阅消息模板ID');
        return;
      }
      
      // 调用微信订阅消息API
      const subscribeResult = await new Promise((resolve, reject) => {
        wx.requestSubscribeMessage({
          tmplIds: [tmplId],
          success: resolve,
          fail: reject
        });
      });
      
      console.log('[订阅] 订阅结果:', subscribeResult);
      
      // 检查用户是否同意订阅
      if (subscribeResult[tmplId] === 'accept') {
        // 调用后端接口订阅特定任务
        const result = await app.request(`/api/task/${task.taskId}/subscribe`, {
          method: 'POST'
        });
        
        if (result && result.success) {
          // 更新任务的订阅状态
          const tasks = this.data.creatingTasks.map(t => {
            if (t.taskId === task.taskId) {
              return { ...t, subscribed: true };
            }
            return t;
          });
          this.setData({ creatingTasks: tasks });
          
          // 显示订阅成功提示（积分隐藏时不展示积分文案）
          const reward = result.creditsReward || 0;
          if (reward > 0 && !app.globalData.creditsEarningHidden) {
            app.showToast(`订阅成功！+${reward}积分`, 'success');
            this.loadUserData();
          } else {
            app.showToast('订阅成功', 'success');
          }
        } else if (result && result.alreadySubscribed) {
          app.showToast('已订阅此任务');
          // 同步状态
          const tasks = this.data.creatingTasks.map(t => {
            if (t.taskId === task.taskId) {
              return { ...t, subscribed: true };
            }
            return t;
          });
          this.setData({ creatingTasks: tasks });
        } else {
          app.showToast(result?.error || '订阅失败');
        }
      } else if (subscribeResult[tmplId] === 'reject') {
        app.showToast('您拒绝了订阅');
      } else {
        // ban 或其他状态
        console.log('[订阅] 用户选择了其他:', subscribeResult[tmplId]);
      }
      
    } catch (err) {
      console.error('[订阅] 订阅失败:', err);
      
      // 处理用户取消的情况
      if (err.errCode === 10001) {
        app.showToast('请在设置中开启订阅消息权限');
      } else if (err.errCode === 20004) {
        app.showToast('请先登录微信');
      } else {
        app.showToast('订阅失败，请重试');
      }
    } finally {
      this.setData({ subscribing: false });
    }
  },

  // 兼容旧的通用订阅（仍可用于草稿游戏，但引导去任务列表订阅）
  handleSubscribe() {
    // 如果有创作中的任务，引导用户去任务上订阅
    if (this.data.creatingTasks && this.data.creatingTasks.length > 0) {
      app.showToast('请在上方创作中的任务上点击🔔订阅');
    } else {
      app.showToast('暂无创作中的任务');
    }
  }
});
