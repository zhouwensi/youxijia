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
    
    // 全站最新作品
    latestGames: [],
    loadingLatestGames: false,
    
    // 高级设置（默认折叠）
    showAdvanced: false,
    advancedSettings: {
      gameName: '',
      artStyle: 'auto',
      orientation: 'auto',
      platform: 'all',
      soundEffect: 'none',
      visibility: 'public',
      gameType: 'auto'
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
    gameTypeOptions: [
      { value: 'auto', label: '自动选择' },
      { value: '2d', label: '2D平面' },
      { value: '2.5d', label: '2.5D等距' },
      { value: '3d', label: '3D立体' }
    ],
    
    // 订阅消息
    subscribed: false,
    // 订阅消息模板ID - 游戏创建完成通知
    // 请在微信公众平台 -> 小程序后台 -> 订阅消息 -> 我的模板 中获取，并替换下面的值
    tmplId: '7ByssPfgCjnVLLUZHEQoohc-i7rcepq3cOt6tx4WKgc'
  },

  onLoad() {
    this.loadLatestGames();
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

  // 加载全站最新作品
  async loadLatestGames() {
    if (this.data.loadingLatestGames) return;
    
    this.setData({ loadingLatestGames: true });
    
    try {
      const result = await app.request('/api/games', {
        data: { 
          limit: 6,
          sort: 'newest'
        }
      });
      
      if (result.success) {
        this.setData({
          latestGames: result.data || result.games || []
        });
      }
    } catch (err) {
      console.error('加载最新作品失败:', err);
    } finally {
      this.setData({ loadingLatestGames: false });
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadLatestGames().then(() => {
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

  // 切换高级设置展开/折叠
  toggleAdvanced() {
    this.setData({
      showAdvanced: !this.data.showAdvanced
    });
  },

  // 跳转到LLM设置页面
  goToLLMSettings() {
    wx.navigateTo({
      url: '/pages/llm-settings/llm-settings'
    });
  },
  
  // 跳转到我的作品列表
  goToMyWorks() {
    wx.switchTab({
      url: '/pages/mine/mine'
    });
  },

  // 跳转到作品广场页面
  goToWorksPage() {
    wx.switchTab({
      url: '/pages/works/works'
    });
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
        visibility: 'public',
        gameType: 'auto'
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

  // 请求订阅消息授权
  async requestSubscribeAuth() {
    const { tmplId } = this.data;
    
    // 如果模板ID未配置，跳过订阅
    if (!tmplId || tmplId === 'your-subscribe-template-id') {
      console.log('[Subscribe] 订阅消息模板ID未配置，跳过订阅');
      return false;
    }
    
    return new Promise((resolve) => {
      wx.requestSubscribeMessage({
        tmplIds: [tmplId],
        success: (res) => {
          console.log('[Subscribe] 订阅授权结果:', res);
          // res[tmplId] 可能是 'accept', 'reject', 'ban'
          if (res[tmplId] === 'accept') {
            this.setData({ subscribed: true });
            resolve(true);
          } else {
            console.log('[Subscribe] 用户拒绝或已被禁止订阅');
            resolve(false);
          }
        },
        fail: (err) => {
          console.error('[Subscribe] 请求订阅授权失败:', err);
          resolve(false);
        }
      });
    });
  },

  // 开始生成游戏
  async startGenerate() {
    const { prompt, generating, advancedSettings, llmSettings, showAdvanced, tmplId } = this.data;
    
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

    // 请求订阅消息授权（游戏做好后会通知用户）
    // 这里先请求授权，不论成功与否都继续生成
    const subscribed = await this.requestSubscribeAuth();
    console.log('[Generate] 订阅状态:', subscribed);

    // 开始生成
    this.setData({
      generating: true,
      progress: 0,
      progressText: subscribed ? '正在连接AI...（完成后会通知您）' : '正在连接AI...',
      generatedGame: null,
      gameUrl: ''
    });

    try {
      // 模拟进度更新
      this.startProgressAnimation();

      // 构建请求数据
      const requestData = {
        prompt: prompt.trim(),
        source: 'miniprogram',
        // 告诉后端用户是否已订阅通知
        subscribeNotify: subscribed
      };

      // 读取用户保存的 LLM 设置（从 LLM 设置页面保存的）
      const savedLLMSettings = wx.getStorageSync('llm_settings') || {};
      const selectedModel = savedLLMSettings.selectedModel || '';
      const savedApiKeys = savedLLMSettings.apiKeys || {};
      const savedCustomApi = savedLLMSettings.customApi || {};

      // 构建 llmConfig 传递给后端
      if (selectedModel) {
        if (selectedModel === 'custom' && savedCustomApi.enabled) {
          // 用户使用自定义接口
          requestData.llmConfig = {
            provider: 'custom',
            model: savedCustomApi.model || '',
            apiKey: savedCustomApi.apiKey || '',
            baseUrl: savedCustomApi.baseUrl || ''
          };
        } else {
          // 用户选择了预设模型
          requestData.llmConfig = {
            provider: selectedModel,  // 传递 modelId，后端会从 LLM_MODELS 获取完整配置
            apiKey: savedApiKeys[selectedModel] || ''  // 如果用户配置了该模型的 API Key
          };
        }
        console.log('[Generate] 使用用户选择的模型:', selectedModel);
      }

      // 添加高级设置
      if (showAdvanced) {
        requestData.advancedSettings = {
          gameName: advancedSettings.gameName || '',
          artStyle: advancedSettings.artStyle,
          orientation: advancedSettings.orientation,
          platform: advancedSettings.platform,
          soundEffect: advancedSettings.soundEffect,
          visibility: advancedSettings.visibility,
          gameType: advancedSettings.gameType
        };

        // 添加LLM设置（兼容旧的页面内 LLM 设置）
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
        
        this.setData({
          progress: 100,
          progressText: '生成完成！',
          generating: false
        });

        app.showToast('游戏生成成功！', 'success');
        
        // 重置表单状态，准备下次创作
        setTimeout(() => {
          this.setData({
            prompt: '',
            progress: 0,
            progressText: '',
            generatedGame: null,
            gameUrl: ''
          });
        }, 500);
        
        // 直接跳转到游戏详情页
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/game-detail/game-detail?id=${game.id}`
          });
        }, 800);
        
        return; // 提前返回，避免执行 finally 中的 generating: false
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
  _isPageActive: true, // 页面是否活跃标记
  
  startProgressAnimation() {
    // 先清理可能存在的旧定时器
    this.stopProgressAnimation();
    
    const steps = [
      { progress: 10, text: '正在分析需求...' },
      { progress: 25, text: 'AI正在构思游戏...' },
      { progress: 40, text: '正在编写游戏代码...' },
      { progress: 60, text: '正在优化游戏逻辑...' },
      { progress: 75, text: '正在生成界面...' },
      { progress: 90, text: '即将完成...' }
    ];
    
    let stepIndex = 0;
    const that = this; // 保存this引用
    
    this.progressTimer = setInterval(() => {
      // 安全检查：确保页面仍然活跃且this可用
      if (!that || !that._isPageActive || !that.setData) {
        clearInterval(that.progressTimer);
        return;
      }
      
      if (stepIndex < steps.length) {
        try {
          that.setData({
            progress: steps[stepIndex].progress,
            progressText: steps[stepIndex].text
          });
          stepIndex++;
        } catch (e) {
          // 捕获可能的setData错误
          console.warn('进度动画setData失败:', e);
          clearInterval(that.progressTimer);
        }
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
  },

  onHide() {
    // 页面隐藏时也清理定时器，防止后台运行导致错误
    this.stopProgressAnimation();
  }
});
