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
    },
    
    // 公众号互动相关
    showWechatVerify: false,       // 是否展开公众号验证区域
    showArticleCode: false,        // 是否展开文章验证码区域
    wechatOfficialName: '一句话游戏',  // 公众号名称（从配置加载）
    wechatReward: 3,              // 关注公众号奖励积分
    articleReward: 1,             // 文章验证码奖励积分
    wechatVerifyCode: '',         // 公众号验证码输入
    articleCode: '',              // 文章验证码输入
    wechatVerifyLoading: false,   // 验证公众号loading
    articleRedeemLoading: false,  // 兑换文章码loading
    wechatStatus: {
      followed: false             // 是否已关注公众号并领取
    },
    articleStatus: {
      usedToday: 0,               // 今日已使用次数
      dailyLimit: 3               // 每日限制次数
    },
    
    // 邮箱验证相关
    showEmailVerify: false,        // 是否展开邮箱验证区域
    emailInput: '',                // 邮箱输入
    emailVerifyCode: '',           // 邮箱验证码输入
    emailCodeSent: false,          // 验证码是否已发送
    emailSending: false,           // 发送验证码loading
    emailVerifying: false,         // 验证loading
    emailCooldown: 0,              // 发送冷却倒计时
    emailCooldownTimer: null,      // 冷却倒计时定时器
    emailConfig: {
      smtpConfigured: false,       // SMTP是否已配置
      verifyCredits: 3             // 验证邮箱奖励积分
    },
    emailStatus: {
      verified: false,             // 是否已验证邮箱
      email: ''                    // 已验证的邮箱地址
    },
    
    // 昵称设置奖励相关
    nicknameConfig: {
      nicknameCredits: 3           // 设置昵称奖励积分
    },
    nicknameStatus: {
      rewarded: false,             // 是否已领取昵称奖励
      nickname: '',                // 当前昵称
      isDefaultNickname: true,     // 是否是默认昵称
      canClaimReward: false        // 是否可以领取奖励（老用户情况）
    },
    nicknameClaimLoading: false,    // 领取昵称奖励loading
    
    // 激励视频广告相关
    adConfig: {
      enabled: false,             // 功能是否启用
      reward: 3,                  // 每次观看奖励积分
      dailyLimit: 30              // 每日观看上限
    },
    adStatus: {
      todayCount: 0,              // 今日已观看次数
      remainingToday: 0           // 今日剩余次数
    },
    adLoading: false,              // 广告加载状态
    rewardedVideoAd: null         // 激励视频广告实例
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

  onUnload() {
    // 清理邮箱验证倒计时定时器
    if (this.data.emailCooldownTimer) {
      clearInterval(this.data.emailCooldownTimer);
      this.setData({ emailCooldownTimer: null, emailCooldown: 0 });
    }
    
    // 销毁广告实例
    if (this.data.rewardedVideoAd) {
      this.data.rewardedVideoAd.destroy();
      this.setData({ rewardedVideoAd: null });
    }
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
        this.loadInviteConfig(),  // 加载邀请配置
        this.loadWechatStatus(),  // 加载公众号互动状态
        this.loadAdConfig()  // 加载广告配置
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
          credits: app.formatCredits(result.credits || 0),
          totalEarned: app.formatCredits(result.total_earned || 0)
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
  },

  // ==================== 公众号互动相关方法 ====================

  // 切换公众号验证区域展开/收起
  toggleWechatVerify() {
    if (this.data.wechatStatus.followed) {
      // 已关注，不需要展开
      return;
    }
    this.setData({
      showWechatVerify: !this.data.showWechatVerify,
      showArticleCode: false  // 收起另一个
    });
  },

  // 切换文章验证码区域展开/收起
  toggleArticleCode() {
    this.setData({
      showArticleCode: !this.data.showArticleCode,
      showWechatVerify: false  // 收起另一个
    });
  },

  // 公众号验证码输入
  onWechatCodeInput(e) {
    this.setData({
      wechatVerifyCode: e.detail.value
    });
  },

  // 文章验证码输入
  onArticleCodeInput(e) {
    this.setData({
      articleCode: e.detail.value
    });
  },

  // 验证公众号关注并领取积分
  async verifyWechatFollow() {
    const code = this.data.wechatVerifyCode.trim();
    if (!code) {
      app.showToast('请输入验证码');
      return;
    }

    if (this.data.wechatVerifyLoading) return;
    this.setData({ wechatVerifyLoading: true });

    try {
      const result = await app.request('/api/credits/follow-wechat', {
        method: 'POST',
        data: { verifyCode: code }
      });

      if (result && result.success) {
        // 验证成功
        this.setData({
          'wechatStatus.followed': true,
          showWechatVerify: false,
          wechatVerifyCode: ''
        });

        wx.showModal({
          title: '🎉 领取成功',
          content: `感谢关注公众号！\n\n获得 ${result.credits || this.data.wechatReward} 积分`,
          showCancel: false,
          confirmText: '太棒了'
        });

        // 刷新积分
        this.loadCredits();
        this.loadCreditLogs();
      } else {
        app.showToast(result?.error || '验证失败');
      }
    } catch (err) {
      console.error('验证公众号关注失败:', err);
      app.showToast('验证失败，请重试');
    } finally {
      this.setData({ wechatVerifyLoading: false });
    }
  },

  // 兑换文章验证码领取积分
  async redeemArticleCode() {
    const code = this.data.articleCode.trim();
    if (!code) {
      app.showToast('请输入验证码');
      return;
    }

    if (this.data.articleStatus.usedToday >= this.data.articleStatus.dailyLimit) {
      app.showToast('今日兑换次数已用完');
      return;
    }

    if (this.data.articleRedeemLoading) return;
    this.setData({ articleRedeemLoading: true });

    try {
      const result = await app.request('/api/credits/redeem-code', {
        method: 'POST',
        data: { code: code }
      });

      if (result && result.success) {
        // 兑换成功
        this.setData({
          articleCode: '',
          'articleStatus.usedToday': this.data.articleStatus.usedToday + 1
        });

        app.showToast(`+${result.credits || this.data.articleReward}积分`, 'success');

        // 刷新积分
        this.loadCredits();
        this.loadCreditLogs();
      } else {
        app.showToast(result?.error || '兑换失败');
      }
    } catch (err) {
      console.error('兑换文章验证码失败:', err);
      app.showToast('兑换失败，请重试');
    } finally {
      this.setData({ articleRedeemLoading: false });
    }
  },

  // 加载公众号互动状态（在 loadAllData 中调用）
  async loadWechatStatus() {
    try {
      const result = await app.request('/api/credits');
      if (result && result.success !== false) {
        this.setData({
          'wechatStatus.followed': result.followedWechat === true,
          wechatReward: result.extraConfig?.followWechat?.credits || this.data.wechatReward,
          articleReward: result.extraConfig?.article?.credits || this.data.articleReward,
          'articleStatus.dailyLimit': result.extraConfig?.article?.dailyLimit || 3,
          'articleStatus.usedToday': result.dailyCounts?.article || 0
        });
        
        // 加载公众号名称
        if (app.globalData.config?.wechatOfficialName) {
          this.setData({
            wechatOfficialName: app.globalData.config.wechatOfficialName
          });
        }
      }
    } catch (err) {
      console.error('加载公众号状态失败:', err);
    }
    
    // 加载邮箱验证状态
    await this.loadEmailStatus();
  },

  // ==================== 邮箱验证相关方法 ====================

  // 切换邮箱验证区域展开/收起
  toggleEmailVerify() {
    if (this.data.emailStatus.verified) {
      app.showToast('您已验证过邮箱');
      return;
    }
    this.setData({
      showEmailVerify: !this.data.showEmailVerify,
      showWechatVerify: false,
      showArticleCode: false
    });
  },

  // 邮箱输入
  onEmailInput(e) {
    this.setData({
      emailInput: e.detail.value
    });
  },

  // 邮箱验证码输入
  onEmailCodeInput(e) {
    this.setData({
      emailVerifyCode: e.detail.value
    });
  },

  // 发送邮箱验证码
  async sendEmailCode() {
    const email = this.data.emailInput.trim();
    
    if (!email) {
      app.showToast('请输入邮箱地址');
      return;
    }
    
    // 简单的邮箱格式验证
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      app.showToast('请输入有效的邮箱地址');
      return;
    }
    
    if (this.data.emailSending || this.data.emailCooldown > 0) return;
    
    this.setData({ emailSending: true });
    
    try {
      const result = await app.request('/api/account/send-email-code', {
        method: 'POST',
        data: { email: email, type: 'verify' }
      });
      
      if (result && result.success) {
        app.showToast('验证码已发送', 'success');
        
        this.setData({
          emailCodeSent: true
        });
        
        // 开始60秒倒计时
        this.startEmailCooldown(60);
      } else {
        app.showToast(result?.error || '发送失败');
        
        // 如果是限流，也开始倒计时
        if (result?.error?.includes('60秒')) {
          this.startEmailCooldown(60);
        }
      }
    } catch (err) {
      console.error('发送邮箱验证码失败:', err);
      app.showToast('发送失败，请重试');
    } finally {
      this.setData({ emailSending: false });
    }
  },

  // 开始发送验证码倒计时
  startEmailCooldown(seconds) {
    this.setData({ emailCooldown: seconds });
    
    // 清除已有的定时器
    if (this.data.emailCooldownTimer) {
      clearInterval(this.data.emailCooldownTimer);
    }
    
    const timer = setInterval(() => {
      const newCooldown = this.data.emailCooldown - 1;
      if (newCooldown <= 0) {
        clearInterval(timer);
        this.setData({ 
          emailCooldown: 0,
          emailCooldownTimer: null
        });
      } else {
        this.setData({ emailCooldown: newCooldown });
      }
    }, 1000);
    
    this.setData({ emailCooldownTimer: timer });
  },

  // 验证邮箱
  async verifyEmail() {
    const code = this.data.emailVerifyCode.trim();
    const email = this.data.emailInput.trim();
    
    if (!code) {
      app.showToast('请输入验证码');
      return;
    }
    
    if (!email) {
      app.showToast('请先输入邮箱地址');
      return;
    }
    
    if (this.data.emailVerifying) return;
    
    this.setData({ emailVerifying: true });
    
    try {
      const result = await app.request('/api/account/verify-email', {
        method: 'POST',
        data: { email: email, code: code }
      });
      
      if (result && result.success) {
        // 验证成功
        this.setData({
          'emailStatus.verified': true,
          'emailStatus.email': email,
          showEmailVerify: false,
          emailCodeSent: false,
          emailInput: '',
          emailVerifyCode: ''
        });
        
        // 清除倒计时
        if (this.data.emailCooldownTimer) {
          clearInterval(this.data.emailCooldownTimer);
          this.setData({ emailCooldown: 0, emailCooldownTimer: null });
        }
        
        wx.showModal({
          title: '🎉 验证成功',
          content: result.message || `邮箱验证成功！\n\n获得 ${result.creditsEarned || this.data.emailConfig.verifyCredits} 积分`,
          showCancel: false,
          confirmText: '太棒了'
        });
        
        // 刷新积分
        this.loadCredits();
        this.loadCreditLogs();
      } else {
        app.showToast(result?.error || '验证失败');
      }
    } catch (err) {
      console.error('验证邮箱失败:', err);
      app.showToast('验证失败，请重试');
    } finally {
      this.setData({ emailVerifying: false });
    }
  },

  // 加载邮箱验证状态
  async loadEmailStatus() {
    try {
      const result = await app.request('/api/account/email-status');
      
      if (result && result.success) {
        this.setData({
          'emailConfig.smtpConfigured': result.smtpConfigured === true,
          'emailConfig.verifyCredits': result.verifyEmailCredits || 3,
          'emailStatus.verified': result.emailVerified === true,
          'emailStatus.email': result.email || ''
        });
      }
    } catch (err) {
      console.error('加载邮箱状态失败:', err);
    }
    
    // 加载昵称奖励状态
    await this.loadNicknameStatus();
  },

  // 加载昵称奖励状态
  async loadNicknameStatus() {
    try {
      const result = await app.request('/api/account/nickname-status');
      
      if (result && result.success) {
        // 计算是否可以直接领取奖励（已设置自定义昵称但未领取奖励，针对老用户）
        const hasCustomNickname = !result.isDefaultNickname;
        const notRewarded = !result.nicknameRewarded;
        const canClaimDirectly = hasCustomNickname && notRewarded;
        
        this.setData({
          'nicknameConfig.nicknameCredits': result.nicknameCredits || 3,
          'nicknameStatus.rewarded': result.nicknameRewarded === true,
          'nicknameStatus.nickname': result.nickname || '',
          'nicknameStatus.isDefaultNickname': result.isDefaultNickname === true,
          'nicknameStatus.canClaimReward': canClaimDirectly
        });
      }
    } catch (err) {
      console.error('加载昵称状态失败:', err);
    }
  },

  // 跳转到我的页面设置昵称
  goToSetNickname() {
    wx.switchTab({
      url: '/pages/mine/mine',
      success: () => {
        // 延迟调用打开昵称编辑弹窗
        setTimeout(() => {
          const pages = getCurrentPages();
          const minePage = pages[pages.length - 1];
          if (minePage && minePage.showNicknameEditor) {
            minePage.showNicknameEditor();
          }
        }, 300);
      }
    });
  },

  // 直接领取昵称奖励（老用户已设置昵称但未领取奖励的情况）
  async claimNicknameReward() {
    if (this.data.nicknameClaimLoading) return;
    
    const currentNickname = this.data.nicknameStatus.nickname;
    if (!currentNickname) {
      app.showToast('请先设置昵称');
      return;
    }
    
    this.setData({ nicknameClaimLoading: true });
    
    try {
      // 使用专用的昵称奖励领取接口
      const result = await app.request('/api/account/claim-nickname-reward', {
        method: 'POST'
      });
      
      if (result && result.success) {
        if (result.creditsEarned && result.creditsEarned > 0) {
          // 领取成功
          this.setData({
            'nicknameStatus.rewarded': true,
            'nicknameStatus.canClaimReward': false
          });
          
          wx.showModal({
            title: '🎉 领取成功',
            content: result.rewardMessage || `设置昵称奖励已领取！\n\n获得 ${result.creditsEarned} 积分`,
            showCancel: false,
            confirmText: '太棒了'
          });
          
          // 刷新积分
          this.loadCredits();
          this.loadCreditLogs();
        } else {
          // 没有获得积分，可能已经领取过
          this.setData({
            'nicknameStatus.rewarded': true,
            'nicknameStatus.canClaimReward': false
          });
          app.showToast('奖励已领取过');
        }
      } else {
        app.showToast(result?.error || '领取失败');
      }
    } catch (err) {
      console.error('领取昵称奖励失败:', err);
      app.showToast('领取失败，请重试');
    } finally {
      this.setData({ nicknameClaimLoading: false });
    }
  },
  
  // ==================== 激励视频广告相关方法 ====================
  
  // 加载广告配置
  async loadAdConfig() {
    try {
      const result = await app.request('/api/site-config');
      if (result && result.extraConfig && result.extraConfig.ad) {
        const adConfig = result.extraConfig.ad;
        this.setData({
          'adConfig.enabled': adConfig.enabled === true,
          'adConfig.reward': adConfig.reward || 3,
          'adConfig.dailyLimit': adConfig.dailyLimit || 30
        });
        
        // 如果功能启用，加载今日观看次数
        if (adConfig.enabled) {
          await this.loadAdStatus();
        }
      }
    } catch (err) {
      console.error('加载广告配置失败:', err);
    }
  },
  
  // 加载广告状态（今日观看次数）
  async loadAdStatus() {
    try {
      // 调用专用接口获取今日观看次数（避免日期格式解析问题）
      const result = await app.request('/api/credits/ad-status');
      
      if (result && result.success) {
        const dailyLimit = result.dailyLimit || this.data.adConfig.dailyLimit || 30;
        this.setData({
          'adStatus.todayCount': result.todayCount || 0,
          'adStatus.remainingToday': result.remainingToday !== undefined ? result.remainingToday : Math.max(0, dailyLimit - (result.todayCount || 0)),
          'adConfig.dailyLimit': dailyLimit
        });
      }
    } catch (err) {
      console.error('加载广告状态失败:', err);
    }
  },
  
  // 处理观看广告
  async handleWatchAd() {
    // 检查功能是否启用
    if (!this.data.adConfig.enabled) {
      app.showToast('激励视频广告功能暂未启用');
      return;
    }
    
    // 检查今日观看次数
    if (this.data.adStatus.remainingToday <= 0) {
      app.showToast(`今日观看次数已达上限（${this.data.adConfig.dailyLimit}次）`);
      return;
    }
    
    // 检查是否正在加载
    if (this.data.adLoading) {
      return;
    }
    
    this.setData({ adLoading: true });
    
    try {
      // 获取广告单元ID（从站点配置或全局配置读取）
      const adUnitId = app.globalData.config?.rewardedVideoAdUnitId || 
                       app.globalData.siteConfig?.rewardedVideoAdUnitId;
      
      if (!adUnitId) {
        app.showToast('广告配置未完成，请联系管理员');
        this.setData({ adLoading: false });
        return;
      }
      
      // 创建或复用广告实例
      let rewardedVideoAd = this.data.rewardedVideoAd;
      if (!rewardedVideoAd) {
        rewardedVideoAd = wx.createRewardedVideoAd({
          adUnitId: adUnitId
        });
        
        // 监听广告加载成功
        rewardedVideoAd.onLoad(() => {
          console.log('激励视频广告加载成功');
        });
        
        // 监听广告加载失败
        rewardedVideoAd.onError((err) => {
          console.error('激励视频广告加载失败:', err);
          this.setData({ adLoading: false });
          
          let errorMsg = '广告加载失败，请稍后重试';
          if (err.errCode === 1004) {
            errorMsg = '暂无广告可观看，请稍后再试';
          } else if (err.errCode === 1005) {
            errorMsg = '广告播放失败，请重试';
          }
          
          // 延迟显示弹窗，避免editor相关错误
          setTimeout(() => {
            wx.showModal({
              title: '提示',
              content: errorMsg,
              showCancel: false,
              confirmText: '知道了'
            });
          }, 300);
        });
        
        // 监听广告关闭
        rewardedVideoAd.onClose((res) => {
          // 延迟更新状态和后续操作，避免editor相关错误
          // 给页面足够时间完成广告关闭动画和状态恢复
          setTimeout(() => {
            this.setData({ adLoading: false });
            
            if (res && res.isEnded) {
              // 用户完整观看了广告，发放积分
              // 再次延迟调用，确保页面状态完全稳定
              setTimeout(() => {
                this.claimAdReward();
              }, 200);
            } else {
              // 用户提前退出，不发放积分
              setTimeout(() => {
                app.showToast('需要完整观看广告才能获得积分');
              }, 200);
            }
          }, 500);
        });
        
        this.setData({ rewardedVideoAd: rewardedVideoAd });
        
        // 创建广告实例后立即加载广告
        rewardedVideoAd.load().catch((loadErr) => {
          console.error('广告预加载失败:', loadErr);
          // 预加载失败不影响后续操作，会在 show() 时重试
        });
      }
      
      // 显示广告前，先确保广告已加载
      try {
        // 先尝试加载广告（如果还未加载）
        await rewardedVideoAd.load();
      } catch (loadErr) {
        console.log('广告加载中，继续尝试显示...');
      }
      
      // 显示广告
      await rewardedVideoAd.show().catch((err) => {
        console.error('显示广告失败:', err);
        this.setData({ adLoading: false });
        
        // 检查是否是广告未加载的错误
        const isNotLoaded = err.errCode === 1004 || 
                           (err.errMsg && err.errMsg.includes('no advertisement data available'));
        
        if (isNotLoaded) {
          // 如果广告未加载，先加载再显示
          rewardedVideoAd.load()
            .then(() => {
              return rewardedVideoAd.show();
            })
            .then(() => {
              // 显示成功，不需要额外处理
            })
            .catch((loadErr) => {
              console.error('加载并显示广告失败:', loadErr);
              app.showToast('广告加载失败，请稍后重试');
            });
        } else {
          app.showToast('广告播放失败，请重试');
        }
      });
      
    } catch (err) {
      console.error('观看广告失败:', err);
      this.setData({ adLoading: false });
      app.showToast('观看广告失败，请重试');
    }
  },
  
  // 领取广告奖励
  async claimAdReward() {
    try {
      const result = await app.request('/api/credits/watch-ad', {
        method: 'POST'
      });
      
      if (result && result.success) {
        // 计算剩余次数（优先使用后端返回，否则使用本地计算）
        const todayCount = result.todayCount !== undefined ? result.todayCount : (this.data.adStatus.todayCount + 1);
        const dailyLimit = this.data.adConfig.dailyLimit || 30;
        const remainingToday = result.remainingToday !== undefined ? result.remainingToday : Math.max(0, dailyLimit - todayCount);
        
        // 延迟更新状态，确保页面完全稳定后再操作
        setTimeout(() => {
          // 更新积分和广告状态
          this.setData({
            credits: app.formatCredits(result.credits || 0),
            'adStatus.todayCount': todayCount,
            'adStatus.remainingToday': remainingToday
          });
          
          // 再次延迟显示弹窗，避免editor相关错误
          setTimeout(() => {
            wx.showModal({
              title: '🎉 观看成功',
              content: `恭喜获得 ${result.creditsAwarded || this.data.adConfig.reward} 积分！\n\n今日剩余 ${remainingToday} 次`,
              showCancel: false,
              confirmText: '太棒了',
              success: () => {
                // 弹窗显示成功后，刷新广告状态（确保数据同步）
                setTimeout(() => {
                  this.loadAdStatus().catch(err => {
                    console.error('刷新广告状态失败:', err);
                  });
                }, 100);
              }
            });
          }, 500);
        }, 300);
        
        // 刷新积分明细（异步执行，不阻塞）
        setTimeout(() => {
          this.loadCreditLogs().catch(err => {
            console.error('刷新积分明细失败:', err);
          });
        }, 200);
      } else {
        app.showToast(result?.error || '领取积分失败');
        
        // 如果是因为达到上限，更新状态
        if (result?.todayCount !== undefined) {
          const dailyLimit = this.data.adConfig.dailyLimit || 30;
          const remainingToday = result.remainingToday !== undefined 
            ? result.remainingToday 
            : Math.max(0, dailyLimit - result.todayCount);
          
          this.setData({
            'adStatus.todayCount': result.todayCount,
            'adStatus.remainingToday': remainingToday
          });
        }
      }
    } catch (err) {
      console.error('领取广告奖励失败:', err);
      app.showToast('领取积分失败，请重试');
    }
  }
});
