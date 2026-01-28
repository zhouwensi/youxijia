/**
 * 创作页面 - 首页 (AI游戏生成)
 */
const app = getApp();

Page({
  data: {
    prompt: '',
    generating: false,
    progress: 0,
    progressText: '',
    
    // 生成结果
    generatedGame: null,
    gameUrl: '',
    
    // 灵感推荐（示例提示词）
    inspirations: [
      { text: '贪吃蛇', icon: '🐍' },
      { text: '打砖块', icon: '🧱' },
      { text: '2048', icon: '🔢' },
      { text: '跳一跳', icon: '🦘' },
      { text: '俄罗斯方块', icon: '🟦' },
      { text: '飞机大战', icon: '✈️' },
      { text: '记忆翻牌', icon: '🃏' },
      { text: '弹球', icon: '⚪' }
    ],
    
    // 最新创作
    recentGames: [],
    loadingGames: false,
    
    // 高级设置
    showAdvanced: false,
    advancedSettings: {
      gameName: '',
      artStyle: 'auto',
      orientation: 'auto',
      platform: 'all',
      soundEffect: 'none',
      visibility: 'public'
    },
    
    // LLM设置
    showLLMSettings: false,
    llmSettings: {
      model: '',
      apiKey: '',
      apiUrl: ''
    },
    
    // 高级设置选项
    artStyleOptions: [
      { value: 'auto', label: '自动' },
      { value: 'pixel', label: '像素风' },
      { value: 'cartoon', label: '卡通风' },
      { value: 'minimal', label: '极简风' },
      { value: 'realistic', label: '写实风' }
    ],
    orientationOptions: [
      { value: 'auto', label: '自动' },
      { value: 'portrait', label: '竖屏' },
      { value: 'landscape', label: '横屏' }
    ],
    platformOptions: [
      { value: 'all', label: '全部' },
      { value: 'mobile', label: '移动端' },
      { value: 'pc', label: 'PC端' }
    ],
    soundOptions: [
      { value: 'none', label: '无音效' },
      { value: 'enabled', label: '开启' }
    ],
    visibilityOptions: [
      { value: 'public', label: '公开' },
      { value: 'private', label: '私密' }
    ],
    
    // 订阅消息
    subscribed: false,
    tmplId: ''
  },

  onLoad() {
    this.loadRecentGames();
  },

  onShow() {
    // 更新自定义TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    
    // 检查登录状态
    if (!app.globalData.isLoggedIn) {
      app.silentLogin();
    }
  },

  // 加载最新创作
  async loadRecentGames() {
    if (this.data.loadingGames) return;
    
    this.setData({ loadingGames: true });
    
    try {
      const result = await app.request('/api/games/recent', {
        data: { limit: 10 }
      });
      
      if (result.success) {
        this.setData({
          recentGames: result.data || result.games || []
        });
      }
    } catch (err) {
      console.error('加载最新创作失败:', err);
    } finally {
      this.setData({ loadingGames: false });
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadRecentGames().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 输入提示词
  onPromptInput(e) {
    this.setData({ prompt: e.detail.value });
  },

  // 点击灵感推荐
  useInspiration(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ prompt: text });
  },

  // 清空输入
  clearPrompt() {
    this.setData({ prompt: '' });
  },

  // 切换高级设置显示
  toggleAdvanced() {
    this.setData({ showAdvanced: !this.data.showAdvanced });
  },

  // 切换LLM设置显示
  toggleLLMSettings() {
    this.setData({ showLLMSettings: !this.data.showLLMSettings });
  },

  // 更新高级设置
  onAdvancedChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`advancedSettings.${field}`]: value
    });
  },

  // Picker选择
  onPickerChange(e) {
    const field = e.currentTarget.dataset.field;
    const options = this.data[`${field}Options`];
    const index = e.detail.value;
    this.setData({
      [`advancedSettings.${field}`]: options[index].value
    });
  },

  // 获取Picker显示值
  getPickerDisplay(field) {
    const value = this.data.advancedSettings[field];
    const options = this.data[`${field}Options`];
    const option = options.find(o => o.value === value);
    return option ? option.label : '自动';
  },

  // 更新LLM设置
  onLLMChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`llmSettings.${field}`]: value
    });
  },

  // 重置高级设置
  resetAdvancedSettings() {
    this.setData({
      advancedSettings: {
        gameName: '',
        artStyle: 'auto',
        orientation: 'auto',
        platform: 'all',
        soundEffect: 'none',
        visibility: 'public'
      },
      llmSettings: {
        model: '',
        apiKey: '',
        apiUrl: ''
      },
      showLLMSettings: false
    });
    app.showToast('已重置');
  },

  // 开始生成游戏
  async startGenerate() {
    const { prompt, generating, advancedSettings, llmSettings, showAdvanced } = this.data;
    
    if (generating) return;
    
    if (!prompt.trim()) {
      app.showToast('请输入游戏描述');
      return;
    }

    if (prompt.trim().length < 2) {
      app.showToast('描述太短了，多说几个字吧');
      return;
    }

    // 检查登录
    if (!app.globalData.isLoggedIn) {
      this.showLoginTip();
      return;
    }

    // 开始生成
    this.setData({
      generating: true,
      progress: 0,
      progressText: '正在连接AI...',
      generatedGame: null,
      gameUrl: ''
    });

    try {
      // 模拟进度更新
      this.startProgressAnimation();

      // 构建请求数据
      const requestData = {
        prompt: prompt.trim(),
        source: 'miniprogram'
      };

      // 添加高级设置
      if (showAdvanced) {
        requestData.advancedSettings = {
          gameName: advancedSettings.gameName || '',
          artStyle: advancedSettings.artStyle,
          orientation: advancedSettings.orientation,
          platform: advancedSettings.platform,
          soundEffect: advancedSettings.soundEffect,
          visibility: advancedSettings.visibility
        };

        // 添加LLM设置
        if (this.data.showLLMSettings && (llmSettings.model || llmSettings.apiKey || llmSettings.apiUrl)) {
          requestData.advancedSettings.llmOverride = {
            model: llmSettings.model || null,
            apiKey: llmSettings.apiKey || null,
            apiUrl: llmSettings.apiUrl || null
          };
        }
      }

      // 使用异步生成API（解决Cloudflare 524超时问题）
      const startResult = await app.request('/api/generate-async', {
        method: 'POST',
        data: requestData
      });

      if (!startResult.success || !startResult.taskId) {
        throw new Error(startResult.error || '无法启动生成任务');
      }

      const taskId = startResult.taskId;
      console.log('异步任务已创建:', taskId);

      this.setData({
        progress: 10,
        progressText: '任务已创建，AI正在思考...'
      });

      // 轮询任务状态
      const result = await this.pollTaskStatus(taskId);

      // 停止进度动画
      this.stopProgressAnimation();

      if (result.success && result.result && result.result.game) {
        // 生成成功
        const game = result.result.game;
        const gameUrl = `${app.globalData.config.webUrl}/g/${game.id.substring(0, 2)}/${game.id}.html`;
        
        this.setData({
          progress: 100,
          progressText: '生成完成！',
          generatedGame: game,
          gameUrl: gameUrl
        });

        app.showToast('游戏生成成功！', 'success');
        
        // 刷新最新创作列表
        this.loadRecentGames();
      } else {
        throw new Error(result.error || '生成失败');
      }
    } catch (err) {
      console.error('生成游戏失败:', err);
      this.stopProgressAnimation();
      
      this.setData({
        progress: 0,
        progressText: ''
      });
      
      // 显示错误信息
      let errorMsg = err.message || '生成失败，请重试';
      if (errorMsg.includes('积分')) {
        wx.showModal({
          title: '积分不足',
          content: '您的积分不足，需要获取更多积分才能继续创作',
          confirmText: '去获取',
          success: (res) => {
            if (res.confirm) {
              wx.switchTab({ url: '/pages/mine/mine' });
            }
          }
        });
      } else {
        app.showToast(errorMsg);
      }
    } finally {
      this.setData({ generating: false });
    }
  },

  // 显示登录提示
  showLoginTip() {
    wx.showModal({
      title: '提示',
      content: '请先登录后再创作游戏',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({ url: '/pages/mine/mine' });
        }
      }
    });
  },

  // 进度动画
  progressTimer: null,
  startProgressAnimation() {
    const steps = [
      { progress: 10, text: '正在分析需求...' },
      { progress: 25, text: 'AI正在构思游戏...' },
      { progress: 40, text: '正在编写游戏代码...' },
      { progress: 60, text: '正在优化游戏逻辑...' },
      { progress: 75, text: '正在生成界面...' },
      { progress: 90, text: '即将完成...' }
    ];
    
    let stepIndex = 0;
    this.progressTimer = setInterval(() => {
      if (stepIndex < steps.length) {
        this.setData({
          progress: steps[stepIndex].progress,
          progressText: steps[stepIndex].text
        });
        stepIndex++;
      }
    }, 2000);
  },

  stopProgressAnimation() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  },

  // 复制游戏链接
  copyGameUrl() {
    if (!this.data.gameUrl) return;
    
    wx.setClipboardData({
      data: this.data.gameUrl,
      success: () => {
        app.showToast('链接已复制', 'success');
      }
    });
  },

  // 去玩游戏
  playGame() {
    if (!this.data.gameUrl) return;
    app.copyAndOpenWeb(this.data.gameUrl, '链接已复制！请在浏览器中打开玩游戏');
  },

  // 继续创作
  createAnother() {
    this.setData({
      prompt: '',
      progress: 0,
      progressText: '',
      generatedGame: null,
      gameUrl: ''
    });
  },

  // 查看游戏详情
  viewGameDetail() {
    const game = this.data.generatedGame;
    if (game) {
      wx.navigateTo({
        url: `/pages/game-detail/game-detail?id=${game.id}`
      });
    }
  },

  // 点击最新游戏
  goToGameDetail(e) {
    const game = e.currentTarget.dataset.game;
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${game.id}`
    });
  },

  // 跳转搜索
  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  // 分享
  onShareAppMessage() {
    const game = this.data.generatedGame;
    if (game) {
      return {
        title: `我用AI创作了一个游戏：${game.title}`,
        path: `/pages/game-detail/game-detail?id=${game.id}`
      };
    }
    return {
      title: 'AI游戏工坊 - 一句话生成游戏',
      path: '/pages/create/create'
    };
  },

  // 轮询任务状态
  async pollTaskStatus(taskId) {
    const maxWaitTime = 30 * 60 * 1000; // 最长等待30分钟
    const pollInterval = 3000; // 每3秒轮询一次
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          // 检查是否超时
          if (Date.now() - startTime > maxWaitTime) {
            reject(new Error('生成超时，请稍后重试'));
            return;
          }
          
          // 查询任务状态
          const result = await app.request(`/api/generate-status/${taskId}`);
          
          console.log('轮询任务状态:', result);
          
          // 更新进度
          if (result.progress !== undefined) {
            this.setData({
              progress: result.progress,
              progressText: result.progressText || '正在生成...'
            });
          }
          
          // 检查状态
          if (result.status === 'completed') {
            resolve(result);
            return;
          }
          
          if (result.status === 'failed') {
            reject(new Error(result.error || '生成失败'));
            return;
          }
          
          if (result.status === 'not_found') {
            reject(new Error('任务不存在或已过期'));
            return;
          }
          
          // 继续轮询
          setTimeout(poll, pollInterval);
          
        } catch (err) {
          console.error('轮询失败:', err);
          // 网络错误时继续尝试
          setTimeout(poll, pollInterval);
        }
      };
      
      // 开始轮询
      poll();
    });
  },

  onUnload() {
    this.stopProgressAnimation();
  }
});
