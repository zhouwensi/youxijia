/**
 * 积分中心页面 - 小程序积分引流核心页面
 */
const app = getApp();

Page({
  data: {
    // 用户积分信息
    credits: 0,
    totalEarned: 0,
    
    // 邀请码信息
    inviteCode: '',
    inviteLink: '',
    inviteReward: 3,  // 邀请奖励积分（从后端配置读取）
    
    // 签到状态
    checkinStatus: {
      checkedInToday: false,
      streakDays: 0,
      monthCheckins: 0,
      nextBonus: null
    },
    
    // 成就数据
    achievements: {
      daily: [],
      weekly: [],
      monthly: [],
      permanent: []
    },
    claimableCount: 0,
    claimableCredits: 0,
    
    // 互动奖励
    actionRewards: [],
    actionClaimableCredits: 0,
    
    // 进行中成就（文档6.1节进行中区域）
    inProgressAchievements: {
      daily: [],
      weekly: [],
      monthly: [],
      permanent: []
    },
    hasInProgress: false,
    
    // 积分明细
    creditLogs: [],
    
    // 积分明细统计（文档6.1节要求）
    logStats: {
      today: 0,
      week: 0,
      month: 0
    },
    
    // 当前Tab
    currentTab: 'rewards', // rewards / achievements / logs
    
    // 加载状态
    loading: false,
    checkinLoading: false,
    claimLoading: false,
    logsLoading: false,  // 积分明细加载状态
    
    // 智能贴士（文档6.1节底部设计）
    smartTip: {
      show: false,
      text: ''
    }
  },

  onLoad(options) {
    // 处理邀请码参数（被邀请者通过分享链接进入）
    if (options.ref) {
      this.handleInviteRef(options.ref);
    }
    this.loadAllData();
  },
  
  // 处理邀请码（被邀请者）
  async handleInviteRef(refCode) {
    try {
      console.log('收到邀请码:', refCode);
      const result = await app.request('/api/invite/link-visit', {
        method: 'POST',
        data: { refCode: refCode }
      });
      
      if (result && result.success) {
        // 邀请成功，显示提示（后端逻辑：进入即得3积分）
        const earned = result.earned || 3;
        wx.showModal({
          title: '🎉 欢迎加入',
          content: `你已通过好友邀请进入！\n\n🎁 获得 ${earned} 积分\n\n你的好友也获得了 ${earned} 积分奖励~`,
          showCancel: false,
          confirmText: '太棒了'
        });
        // 刷新积分显示
        this.loadCredits();
      } else if (result && result.alreadyUsed) {
        // 已使用过邀请链接，不提示
        console.log('邀请码已使用过');
      } else {
        console.log('邀请码处理结果:', result?.error);
      }
    } catch (err) {
      console.error('处理邀请码失败:', err);
    }
  },

  onShow() {
    this.loadAllData();
  },

  onPullDownRefresh() {
    this.loadAllData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载所有数据
  async loadAllData() {
    this.setData({ loading: true });
    
    try {
      await Promise.all([
        this.loadCredits(),
        this.loadCheckinStatus(),
        this.loadAchievements(),
        this.loadActionRewards(),
        this.loadCreditLogs(),
        this.loadInviteCode(),  // 加载邀请码
        this.loadInviteConfig()  // 加载邀请配置
      ]);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },
  
  // 加载邀请配置（从后端读取积分配置）
  async loadInviteConfig() {
    try {
      // 从 /api/site-config 读取邀请积分配置
      const result = await app.request('/api/site-config');
      if (result && result.inviteReward) {
        this.setData({
          inviteReward: result.inviteReward
        });
        console.log('邀请配置加载成功, 奖励积分:', result.inviteReward);
      }
    } catch (err) {
      console.error('加载邀请配置失败:', err);
    }
  },
  
  // 加载邀请码
  async loadInviteCode() {
    try {
      // 正确的接口路径是 /api/invite/my-link
      const result = await app.request('/api/invite/my-link');
      if (result && result.success) {
        const webUrl = app.globalData.config?.webUrl || 'https://www.yijuhuayouxi.com';
        this.setData({
          inviteCode: result.code || '',
          inviteLink: result.link ? (webUrl + result.link) : ''
        });
        console.log('邀请码加载成功:', result.code);
      } else {
        console.error('邀请码加载失败:', result?.error);
      }
    } catch (err) {
      console.error('加载邀请码失败:', err);
    }
  },

  // 加载积分
  async loadCredits() {
    try {
      const result = await app.request('/api/credits');
      if (result && result.success !== false) {
        this.setData({
          credits: result.credits || 0,
          totalEarned: result.total_earned || 0
        });
      }
    } catch (err) {
      console.error('加载积分失败:', err);
    }
  },

  // 加载签到状态
  async loadCheckinStatus() {
    try {
      const result = await app.request('/api/user/checkin-status');
      if (result && result.success) {
        this.setData({
          'checkinStatus.checkedInToday': result.data.checked_in_today,
          'checkinStatus.streakDays': result.data.streak_days,
          'checkinStatus.monthCheckins': result.data.month_checkins,
          'checkinStatus.nextBonus': result.data.next_bonus
        });
      }
    } catch (err) {
      console.error('加载签到状态失败:', err);
    }
  },

  // 加载成就
  async loadAchievements() {
    try {
      const result = await app.request('/api/achievements');
      if (result && result.success) {
        const daily = result.data.grouped.daily || [];
        const weekly = result.data.grouped.weekly || [];
        const monthly = result.data.grouped.monthly || [];
        const permanent = result.data.grouped.permanent || [];
        
        // 筛选进行中的成就（未完成且未领取）
        const inProgressDaily = daily.filter(a => !a.is_completed && !a.is_claimed && a.progress > 0);
        const inProgressWeekly = weekly.filter(a => !a.is_completed && !a.is_claimed && a.progress > 0);
        const inProgressMonthly = monthly.filter(a => !a.is_completed && !a.is_claimed && a.progress > 0);
        const inProgressPermanent = permanent.filter(a => !a.is_completed && !a.is_claimed && a.progress > 0 && a.target > 1);
        
        const hasInProgress = inProgressDaily.length > 0 || inProgressWeekly.length > 0 || 
                             inProgressMonthly.length > 0 || inProgressPermanent.length > 0;
        
        this.setData({
          'achievements.daily': daily,
          'achievements.weekly': weekly,
          'achievements.monthly': monthly,
          'achievements.permanent': permanent,
          claimableCount: result.data.claimable_count || 0,
          claimableCredits: result.data.claimable_credits || 0,
          // 进行中成就
          'inProgressAchievements.daily': inProgressDaily,
          'inProgressAchievements.weekly': inProgressWeekly,
          'inProgressAchievements.monthly': inProgressMonthly,
          'inProgressAchievements.permanent': inProgressPermanent,
          hasInProgress: hasInProgress
        });
      }
    } catch (err) {
      console.error('加载成就失败:', err);
    }
  },

  // 加载互动奖励
  async loadActionRewards() {
    try {
      const result = await app.request('/api/user/action-rewards');
      if (result && result.success) {
        this.setData({
          actionRewards: result.data.rewards || [],
          actionClaimableCredits: result.data.total_claimable || 0
        });
        
        // 更新智能贴士（文档6.1节底部设计）
        this.updateSmartTip(result.data.rewards || []);
      }
    } catch (err) {
      console.error('加载互动奖励失败:', err);
    }
  },
  
  // 更新智能贴士 - 显示最接近完成的任务
  updateSmartTip(rewards) {
    if (!rewards || rewards.length === 0) {
      this.setData({ 'smartTip.show': false });
      return;
    }
    
    // 找到最接近完成的任务（排除已满的）
    let closestTask = null;
    let minRemaining = Infinity;
    
    rewards.forEach(reward => {
      const remaining = reward.target - reward.current_progress;
      if (remaining > 0 && remaining < minRemaining && reward.can_claim_count === 0) {
        minRemaining = remaining;
        closestTask = reward;
      }
    });
    
    if (closestTask && minRemaining <= 5) {
      const actionNames = {
        'like': '点赞', 'favorite': '收藏', 'comment': '评论', 'follow': '关注'
      };
      const actionName = actionNames[closestTask.type] || closestTask.name;
      
      this.setData({
        'smartTip.show': true,
        'smartTip.text': `再${actionName}${minRemaining}次即可领取${closestTask.reward_per_set || 1}积分！`
      });
    } else {
      this.setData({ 'smartTip.show': false });
    }
  },

  // 加载积分明细（含统计数据）
  async loadCreditLogs() {
    this.setData({ logsLoading: true });
    
    try {
      const result = await app.request('/api/credits/logs', {
        data: { limit: 20, include_stats: 1 }
      });
      if (result && result.success) {
        this.setData({
          creditLogs: result.data || result.logs || [],
          // 更新统计数据（后端新增字段）
          'logStats.today': result.stats?.today_earned || 0,
          'logStats.week': result.stats?.week_earned || 0,
          'logStats.month': result.stats?.month_earned || 0
        });
      }
    } catch (err) {
      console.error('加载积分明细失败:', err);
    } finally {
      this.setData({ logsLoading: false });
    }
  },

  // 签到
  async handleCheckin() {
    if (this.data.checkinStatus.checkedInToday) {
      app.showToast('今日已签到');
      return;
    }
    
    if (this.data.checkinLoading) return;
    
    this.setData({ checkinLoading: true });
    
    try {
      const result = await app.request('/api/user/checkin', {
        method: 'POST'
      });
      
      if (result && result.success) {
        const data = result.data;
        
        // 更新状态
        this.setData({
          credits: data.total_credits,
          'checkinStatus.checkedInToday': true,
          'checkinStatus.streakDays': data.streak_days,
          'checkinStatus.nextBonus': data.next_bonus
        });
        
        // 显示签到成功
        let message = `签到成功 +${data.total_earned}积分`;
        if (data.bonus_credits > 0) {
          message += `\n(含连续签到加成 +${data.bonus_credits})`;
        }
        
        wx.showModal({
          title: '🎉 签到成功',
          content: message + `\n\n连续签到: ${data.streak_days}天`,
          showCancel: false,
          confirmText: '太棒了'
        });
        
        // 刷新数据（使用await确保加载完成）
        await this.loadCreditLogs();
      } else {
        app.showToast(result?.error || '签到失败');
      }
    } catch (err) {
      console.error('签到失败:', err);
      app.showToast('签到失败，请重试');
    } finally {
      this.setData({ checkinLoading: false });
    }
  },

  // 一键领取所有成就奖励
  async claimAllAchievements() {
    if (this.data.claimableCount === 0) {
      app.showToast('暂无可领取的成就');
      return;
    }
    
    if (this.data.claimLoading) return;
    
    this.setData({ claimLoading: true });
    
    try {
      const result = await app.request('/api/achievements/claim-all', {
        method: 'POST'
      });
      
      if (result && result.success) {
        const data = result.data;
        
        this.setData({
          credits: data.total_credits
        });
        
        wx.showModal({
          title: '🎊 领取成功',
          content: `领取了${data.claimed_count}个成就奖励\n共获得 ${data.total_credits_earned} 积分`,
          showCancel: false,
          confirmText: '开心'
        });
        
        // 刷新数据
        await Promise.all([
          this.loadAchievements(),
          this.loadCreditLogs()
        ]);
      } else {
        app.showToast(result?.error || '领取失败');
      }
    } catch (err) {
      console.error('领取失败:', err);
      app.showToast('领取失败，请重试');
    } finally {
      this.setData({ claimLoading: false });
    }
  },

  // 领取单个成就
  async claimAchievement(e) {
    const achievement = e.currentTarget.dataset.achievement;
    if (!achievement.can_claim) return;
    
    try {
      const result = await app.request(`/api/achievements/${achievement.id}/claim`, {
        method: 'POST'
      });
      
      if (result && result.success) {
        app.showToast(`+${result.data.credits_earned}积分`, 'success');
        
        this.setData({
          credits: result.data.total_credits
        });
        
        await this.loadAchievements();
        await this.loadCreditLogs();
      } else {
        app.showToast(result?.error || '领取失败');
      }
    } catch (err) {
      console.error('领取失败:', err);
      app.showToast('领取失败');
    }
  },

  // 领取互动奖励
  async claimActionReward(e) {
    const action = e.currentTarget.dataset.action;
    if (action.can_claim_count <= 0) return;
    
    try {
      const result = await app.request(`/api/user/action-rewards/${action.type}/claim`, {
        method: 'POST'
      });
      
      if (result && result.success) {
        app.showToast(`+${result.data.credits_earned}积分`, 'success');
        
        this.setData({
          credits: result.data.total_credits
        });
        
        await this.loadActionRewards();
        await this.loadCreditLogs();
      } else {
        app.showToast(result?.error || '领取失败');
      }
    } catch (err) {
      console.error('领取失败:', err);
      app.showToast('领取失败');
    }
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    
    // 切换到明细Tab时，主动刷新最新数据
    if (tab === 'logs') {
      this.loadCreditLogs();
    }
  },

  // 去网站做任务（复制带邀请码的链接）
  goToWebsite() {
    // 使用带邀请码的链接
    const url = this.data.inviteLink || (app.globalData.config?.webUrl || 'https://www.yijuhuayouxi.com');
    app.copyAndOpenWeb(url, '复制链接后在浏览器打开，完成互动任务可获得积分');
  },

  // 邀请好友
  handleInvite() {
    const inviteLink = this.data.inviteLink;
    const inviteCode = this.data.inviteCode;
    const reward = this.data.inviteReward;
    
    wx.showActionSheet({
      itemList: ['分享小程序给好友', '复制邀请链接'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 分享小程序 - 由于微信限制，无法通过代码直接触发分享
          // 需要引导用户点击右上角或使用分享按钮
          wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
          });
          wx.showModal({
            title: '📤 分享小程序',
            content: `请点击右上角"..."按钮，选择"发送给朋友"即可分享。\n\n好友通过分享链接进入后，双方立即各得${reward}积分！`,
            showCancel: false,
            confirmText: '知道了'
          });
        } else if (res.tapIndex === 1) {
          // 复制邀请链接
          if (inviteLink) {
            const reward = this.data.inviteReward;
            wx.setClipboardData({
              data: inviteLink,
              success: () => {
                wx.showModal({
                  title: '✅ 复制成功',
                  content: `邀请链接已复制！\n\n邀请码: ${inviteCode}\n\n分享给好友，好友通过链接进入后，双方立即各得${reward}积分！`,
                  showCancel: false,
                  confirmText: '知道了'
                });
              }
            });
          } else {
            app.showToast('获取邀请链接失败，请重试');
          }
        }
      }
    });
  },

  // 分享（带邀请码参数）
  onShareAppMessage() {
    const inviteCode = this.data.inviteCode;
    // 分享路径带上邀请码参数
    const path = inviteCode 
      ? `/pages/credits/credits?ref=${inviteCode}` 
      : '/pages/credits/credits';
    
    return {
      title: '来游戏家签到领积分，积分可以生成游戏哦~',
      path: path
    };
  }
});
