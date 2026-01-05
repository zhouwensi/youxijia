// LLM 提供商类型
export type LLMProvider = 'openai' | 'deepseek' | 'claude' | 'gemini' | 'moonshot' | 'qwen'

// LLM 配置接口
export interface LLMConfig {
  provider: LLMProvider
  apiKey: string
  apiUrl?: string
  enabled: boolean
}

// 所有 LLM 配置
export interface LLMConfigs {
  openai: LLMConfig
  deepseek: LLMConfig
  claude: LLMConfig
  gemini: LLMConfig
  moonshot: LLMConfig
  qwen: LLMConfig
}

// LLM 提供商信息
export interface LLMProviderInfo {
  id: LLMProvider
  name: string
  description: string
  apiUrl?: string
  defaultUrl?: string
  keyPrefix?: string
  website?: string
}

export const LLM_PROVIDERS: Record<LLMProvider, LLMProviderInfo> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5 等模型',
    defaultUrl: 'https://api.openai.com/v1',
    keyPrefix: 'sk-',
    website: 'https://platform.openai.com'
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek Chat 模型',
    defaultUrl: 'https://api.deepseek.com/v1',
    keyPrefix: 'sk-',
    website: 'https://platform.deepseek.com'
  },
  claude: {
    id: 'claude',
    name: 'Claude (Anthropic)',
    description: 'Claude 3 系列模型',
    defaultUrl: 'https://api.anthropic.com/v1',
    keyPrefix: 'sk-ant-',
    website: 'https://console.anthropic.com'
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini Pro 等模型',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1',
    keyPrefix: '',
    website: 'https://makersuite.google.com'
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot AI',
    description: 'Moonshot 模型',
    defaultUrl: 'https://api.moonshot.cn/v1',
    keyPrefix: 'sk-',
    website: 'https://platform.moonshot.cn'
  },
  qwen: {
    id: 'qwen',
    name: '通义千问 (Qwen)',
    description: '阿里云通义千问模型',
    defaultUrl: 'https://dashscope.aliyuncs.com/api/v1',
    keyPrefix: 'sk-',
    website: 'https://dashscope.console.aliyun.com'
  }
}
