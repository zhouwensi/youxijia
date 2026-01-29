/**
 * LLM设置页面 - 参考网站样式实现
 * 选择默认模型并配置 API Key
 */
const app = getApp();

Page({
  data: {
    // 可用模型列表
    models: [],
    // 默认选中的模型ID
    selectedModel: '',
    // 各模型的API Key
    apiKeys: {},
    // 自定义接口设置
    customApi: {
      enabled: false,
      baseUrl: '',
      model: '',
      apiKey: ''
    },
    // 状态
    loading: true,
    saving: false,
    // 密码可见性
    showApiKey: {}
  },

  onLoad() {
    this.loadSettings();
  },

  // 加载设置
  async loadSettings() {
    this.setData({ loading: true });

    try {
      // 从服务端获取模型列表
      let models = [];
      let defaultModelId = 'deepseek-v3';
      
      try {
        console.log('[LLM设置] 开始从服务端获取模型列表...');
        const result = await app.request('/api/turbo-models');
        console.log('[LLM设置] API返回:', result);
        
        if (result.success && result.models && result.models.length > 0) {
          models = result.models.map(m => ({
            id: m.id,
            name: m.name,
            hasDefaultKey: m.hasDefaultKey || false,
            needsUserKey: m.needsUserKey || (!m.hasDefaultKey && m.creditCost === 0),
            speedLevel: m.speedLevel || 'normal',
            quality: m.quality || 'medium',
            creditCost: m.creditCost || 1
          }));
          
          // 获取服务端返回的默认模型
          if (result.defaultModel) {
            defaultModelId = result.defaultModel;
          }
          
          console.log(`[LLM设置] 成功获取 ${models.length} 个模型，默认模型: ${defaultModelId}`);
        }
      } catch (e) {
        console.error('[LLM设置] 获取模型列表失败:', e);
      }

      // 如果服务端没有返回，使用本地默认列表
      if (models.length === 0) {
        console.log('[LLM设置] 使用本地默认模型列表');
        models = [
          { id: 'deepseek-v3', name: 'DeepSeek V3', hasDefaultKey: true, needsUserKey: false, quality: 'high' },
          { id: 'deepseek-r1', name: 'DeepSeek R1', hasDefaultKey: true, needsUserKey: false, quality: 'very-high' },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', hasDefaultKey: true, needsUserKey: false, quality: 'high' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', hasDefaultKey: false, needsUserKey: true, quality: 'medium' },
          { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', hasDefaultKey: false, needsUserKey: true, quality: 'high' }
        ];
      }

      // 添加自定义接口选项
      models.push({
        id: 'custom',
        name: '🔧 自定义接口',
        hasDefaultKey: false,
        needsUserKey: true,
        quality: 'custom'
      });

      // 从本地存储加载已保存的设置
      const savedSettings = wx.getStorageSync('llm_settings') || {};
      // 优先使用保存的设置，否则使用服务端返回的默认模型
      const selectedModel = savedSettings.selectedModel || defaultModelId;
      const apiKeys = savedSettings.apiKeys || {};
      const customApi = savedSettings.customApi || {
        enabled: false,
        baseUrl: '',
        model: '',
        apiKey: ''
      };

      this.setData({
        models,
        selectedModel,
        apiKeys,
        customApi,
        loading: false
      });
    } catch (err) {
      console.error('加载LLM设置失败:', err);
      this.setData({ loading: false });
      app.showToast('加载设置失败');
    }
  },

  // 选择默认模型
  selectModel(e) {
    const modelId = e.currentTarget.dataset.id;
    this.setData({ selectedModel: modelId });

    // 如果选择自定义接口，自动启用
    if (modelId === 'custom') {
      this.setData({ 'customApi.enabled': true });
    }
  },

  // 输入API Key
  onApiKeyInput(e) {
    const modelId = e.currentTarget.dataset.id;
    const value = e.detail.value;
    const key = `apiKeys.${modelId}`;
    this.setData({ [key]: value });
  },

  // 切换API Key可见性
  toggleApiKeyVisibility(e) {
    const modelId = e.currentTarget.dataset.id;
    const key = `showApiKey.${modelId}`;
    const current = this.data.showApiKey[modelId] || false;
    this.setData({ [key]: !current });
  },

  // 切换自定义接口
  toggleCustomApi() {
    const enabled = !this.data.customApi.enabled;
    this.setData({ 'customApi.enabled': enabled });
  },

  // 自定义接口输入
  onCustomApiInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const key = `customApi.${field}`;
    this.setData({ [key]: value });
  },

  // 切换自定义API Key可见性
  toggleCustomApiKeyVisibility() {
    const current = this.data.showApiKey.custom || false;
    this.setData({ 'showApiKey.custom': !current });
  },

  // 保存设置
  async saveSettings() {
    if (this.data.saving) return;

    // 验证自定义接口
    if (this.data.selectedModel === 'custom') {
      const { baseUrl, model, apiKey } = this.data.customApi;
      if (!baseUrl || !model || !apiKey) {
        app.showToast('请完整填写自定义接口配置');
        return;
      }
    }

    this.setData({ saving: true });

    try {
      const settings = {
        selectedModel: this.data.selectedModel,
        apiKeys: this.data.apiKeys,
        customApi: this.data.customApi
      };

      // 保存到本地存储
      wx.setStorageSync('llm_settings', settings);

      // 同步到全局数据
      app.globalData.llmSettings = settings;

      app.showToast('保存成功', 'success');

      // 延迟返回
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (err) {
      console.error('保存LLM设置失败:', err);
      app.showToast('保存失败');
    } finally {
      this.setData({ saving: false });
    }
  },

  // 取消/重置设置
  resetSettings() {
    wx.navigateBack();
  }
});