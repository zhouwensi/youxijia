/**
 * 游戏编辑页面 - 对话式界面
 */
const app = getApp();

Page({
  data: {
    gameId: null,
    game: null,
    loading: true,
    
    // 游戏信息
    gameEmoji: '🎮',
    visibility: 'public',
    
    // 对话相关
    messages: [],
    inputText: '',
    isEditing: false,
    scrollToMessage: '',
    
    // 编辑会话
    sessionId: null,
    
    // 消息ID计数器
    messageIdCounter: 0
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
        // 检查是否是作者
        const userToken = app.globalData.token;
        if (!userToken || result.game.author_token !== userToken) {
          app.showToast('只能编辑自己的游戏');
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
          return;
        }
        
        this.setData({
          game: result.game,
          visibility: result.game.visibility || 'public',
          gameEmoji: this.extractEmoji(result.game.title) || '🎮'
        });
        
        wx.setNavigationBarTitle({
          title: 'AI编辑游戏'
        });
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

  // 提取标题中的emoji
  extractEmoji(title) {
    if (!title) return null;
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/u;
    const match = title.match(emojiRegex);
    return match ? match[0] : null;
  },

  // 生成消息ID
  generateMessageId() {
    const id = this.data.messageIdCounter + 1;
    this.setData({ messageIdCounter: id });
    return `msg-${Date.now()}-${id}`;
  },

  // 获取当前时间
  getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  },

  // 输入变化
  onInputChange(e) {
    this.setData({ inputText: e.detail.value });
  },

  // 发送消息
  async sendMessage() {
    const { inputText, isEditing, gameId, game, messages } = this.data;
    
    if (!inputText.trim() || isEditing) return;
    
    const userMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content: inputText.trim(),
      time: this.getCurrentTime()
    };
    
    const aiMessage = {
      id: this.generateMessageId(),
      role: 'assistant',
      content: '',
      time: this.getCurrentTime(),
      status: 'loading'
    };
    
    // 添加用户消息和AI占位消息
    this.setData({
      messages: [...messages, userMessage, aiMessage],
      inputText: '',
      isEditing: true,
      scrollToMessage: `msg-${aiMessage.id}`
    });
    
    // 滚动到底部
    setTimeout(() => {
      this.setData({ scrollToMessage: 'scroll-bottom' });
    }, 100);
    
    try {
      // 调用AI编辑API
      await this.executeAIEdit(userMessage.content, aiMessage.id);
    } catch (err) {
      console.error('AI编辑失败:', err);
      this.updateAIMessage(aiMessage.id, {
        content: '抱歉，编辑失败了：' + (err.message || '网络错误'),
        status: 'error'
      });
    } finally {
      this.setData({ isEditing: false });
    }
  },

  // 执行AI编辑
  async executeAIEdit(instruction, aiMessageId) {
    const { gameId, game, sessionId } = this.data;
    
    this.updateAIMessage(aiMessageId, {
      content: '正在分析您的需求...'
    });
    
    try {
      // 如果没有会话，先开始会话
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const startResult = await app.request(`/api/games/${gameId}/edit`, {
          method: 'POST',
          data: {
            action: 'start'
          }
        });
        
        if (startResult.success && startResult.sessionId) {
          currentSessionId = startResult.sessionId;
          this.setData({ sessionId: currentSessionId });
        } else {
          throw new Error(startResult.error || '开始编辑会话失败');
        }
      }
      
      this.updateAIMessage(aiMessageId, {
        content: '🔄 AI正在修改游戏代码，请稍候...\n（这可能需要1-2分钟）'
      });
      
      // 发送编辑消息（后端是同步处理的，会等待LLM完成后返回）
      const result = await app.request(`/api/games/${gameId}/edit`, {
        method: 'POST',
        data: {
          action: 'message',
          sessionId: currentSessionId,
          message: instruction
        }
      });

      if (result.success && result.code) {
        // 编辑成功，自动保存
        this.updateAIMessage(aiMessageId, {
          content: '✅ 代码修改完成，正在保存...'
        });
        
        // 调用save保存更改
        const saveResult = await app.request(`/api/games/${gameId}/edit`, {
          method: 'POST',
          data: {
            action: 'save',
            sessionId: currentSessionId,
            saveAsNew: false
          }
        });
        
        if (saveResult.success) {
          this.updateAIMessage(aiMessageId, {
            content: `✅ 编辑完成！游戏已更新。\n\n${result.message || ''}\n\n你可以点击右上角的预览按钮查看效果，或继续告诉我其他修改需求~`,
            status: 'success'
          });
          
          // 重置会话ID，下次编辑会开始新会话
          this.setData({ sessionId: null });
          
          // 刷新游戏详情
          this.loadGameDetail(this.data.gameId);
          
          // 刷新用户积分
          app.loadUserInfo && app.loadUserInfo();
        } else {
          throw new Error(saveResult.error || '保存失败');
        }
      } else {
        throw new Error(result.error || 'AI编辑失败');
      }
    } catch (err) {
      throw err;
    }
  },

  // 更新AI消息
  updateAIMessage(messageId, updates) {
    const messages = this.data.messages.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, ...updates };
      }
      return msg;
    });
    this.setData({ messages });
  },

  // 重试消息
  retryMessage(e) {
    const { index } = e.currentTarget.dataset;
    const messages = [...this.data.messages];
    
    // 找到对应的用户消息
    const userMessageIndex = index - 1;
    if (userMessageIndex >= 0 && messages[userMessageIndex].role === 'user') {
      const instruction = messages[userMessageIndex].content;
      
      // 移除失败的AI消息
      messages.splice(index, 1);
      this.setData({ messages });
      
      // 重新发送
      this.setData({ inputText: instruction });
      this.sendMessage();
    }
  },

  // 查看游戏
  viewGame() {
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${this.data.gameId}`
    });
  },

  // 删除游戏
  deleteGame() {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个游戏吗？',
      confirmColor: '#ff4444',
      success: async (res) => {
        if (res.confirm) {
          await this.executeDelete();
        }
      }
    });
  },

  // 执行删除
  async executeDelete() {
    try {
      const result = await app.request(`/api/games/${this.data.gameId}`, {
        method: 'DELETE'
      });
      
      if (result.success) {
        app.showToast('删除成功', 'success');
        setTimeout(() => {
          wx.navigateBack({ delta: 2 });
        }, 1500);
      } else {
        app.showToast(result.error || '删除失败');
      }
    } catch (err) {
      console.error('删除游戏失败:', err);
      app.showToast('网络错误，请重试');
    }
  }
});