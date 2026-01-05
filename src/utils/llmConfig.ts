import { LLMConfigs, LLMProvider } from '../types/llm'
import { LLM_PROVIDERS } from '../types/llm'

const STORAGE_KEY = 'llm_configs'

// 获取默认配置
export function getDefaultConfigs(): LLMConfigs {
  return {
    openai: {
      provider: 'openai',
      apiKey: '',
      apiUrl: LLM_PROVIDERS.openai.defaultUrl,
      enabled: false
    },
    deepseek: {
      provider: 'deepseek',
      apiKey: '',
      apiUrl: LLM_PROVIDERS.deepseek.defaultUrl,
      enabled: false
    },
    claude: {
      provider: 'claude',
      apiKey: '',
      apiUrl: LLM_PROVIDERS.claude.defaultUrl,
      enabled: false
    },
    gemini: {
      provider: 'gemini',
      apiKey: '',
      apiUrl: LLM_PROVIDERS.gemini.defaultUrl,
      enabled: false
    },
    moonshot: {
      provider: 'moonshot',
      apiKey: '',
      apiUrl: LLM_PROVIDERS.moonshot.defaultUrl,
      enabled: false
    },
    qwen: {
      provider: 'qwen',
      apiKey: '',
      apiUrl: LLM_PROVIDERS.qwen.defaultUrl,
      enabled: false
    }
  }
}

// 从 localStorage 加载配置
export function loadLLMConfigs(): LLMConfigs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const configs = JSON.parse(stored)
      // 合并默认配置，确保所有字段都存在
      const defaults = getDefaultConfigs()
      return { ...defaults, ...configs }
    }
  } catch (error) {
    console.error('Failed to load LLM configs:', error)
  }
  return getDefaultConfigs()
}

// 保存配置到 localStorage
export function saveLLMConfigs(configs: LLMConfigs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
  } catch (error) {
    console.error('Failed to save LLM configs:', error)
  }
}

// 获取特定提供商的配置
export function getLLMConfig(provider: LLMProvider) {
  const configs = loadLLMConfigs()
  return configs[provider]
}

// 获取当前启用的配置
export function getEnabledConfigs(): LLMConfigs {
  const configs = loadLLMConfigs()
  const enabled: Partial<LLMConfigs> = {}
  
  Object.keys(configs).forEach(key => {
    const provider = key as LLMProvider
    if (configs[provider].enabled && configs[provider].apiKey) {
      enabled[provider] = configs[provider]
    }
  })
  
  return enabled as LLMConfigs
}

// 验证 API Key 格式（基础验证）
export function validateAPIKey(provider: LLMProvider, apiKey: string): boolean {
  if (!apiKey.trim()) return false
  
  const providerInfo = LLM_PROVIDERS[provider]
  if (providerInfo.keyPrefix && apiKey.startsWith(providerInfo.keyPrefix)) {
    return true
  }
  
  // 如果没有前缀要求，至少检查长度
  return apiKey.length > 10
}
