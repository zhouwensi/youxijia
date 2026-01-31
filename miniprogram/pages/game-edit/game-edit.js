/**
 * 游戏编辑页面
 */
const app = getApp();

Page({
  data: {
    gameId: null,
    game: null,
    loading: true,
    saving: false,
    
    // 编辑表单
    title: '',
    prompt: '',
    visibility: 'public'
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
        const userToken = app.globalData.userToken;
        if (!userToken || result.game.author_token !== userToken) {
          app.showToast('只能编辑自己的游戏');
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
          return;
        }
        
        this.setData({
          game: result.game,
          title: result.game.title || '',
          prompt: result.game.prompt || '',
          visibility: result.game.visibility || 'public'
        });
        
        wx.setNavigationBarTitle({
          title: '编辑游戏'
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

  // 输入标题
  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  // 输入描述
  onPromptInput(e) {
    this.setData({ prompt: e.detail.value });
  },

  // 选择可见性
  onVisibilityChange(e) {
    const options = ['public', 'followers', 'private'];
    this.setData({ visibility: options[e.detail.value] });
  },

  // 保存游戏
  async saveGame() {
    const { title, prompt, visibility, gameId } = this.data;
    
    if (!title.trim()) {
      app.showToast('请输入游戏标题');
      return;
    }
    
    if (this.data.saving) return;
    this.setData({ saving: true });
    
    try {
      const result = await app.request(`/api/games/${gameId}`, {
        method: 'PUT',
        data: {
          title: title.trim(),
          prompt: prompt.trim(),
          visibility
        }
      });
      
      if (result.success) {
        app.showToast('保存成功', 'success');
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        app.showToast(result.error || '保存失败');
      }
    } catch (err) {
      console.error('保存游戏失败:', err);
      app.showToast('网络错误，请重试');
    } finally {
      this.setData({ saving: false });
    }
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
          // 返回两级（跳过详情页）
          wx.navigateBack({ delta: 2 });
        }, 1500);
      } else {
        app.showToast(result.error || '删除失败');
      }
    } catch (err) {
      console.error('删除游戏失败:', err);
      app.showToast('网络错误，请重试');
    }
  },

  // 获取可见性文本
  getVisibilityText() {
    const map = {
      'public': '所有人可见',
      'followers': '仅粉丝可见',
      'private': '仅自己可见'
    };
    return map[this.data.visibility] || '所有人可见';
  }
});
