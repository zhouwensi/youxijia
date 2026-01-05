import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Eye, EyeOff, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { LLMConfigs, LLMProvider } from '../types/llm'
import { LLM_PROVIDERS } from '../types/llm'
import { loadLLMConfigs, saveLLMConfigs, validateAPIKey } from '../utils/llmConfig'

export default function LLMConfig() {
  const navigate = useNavigate()
  const [configs, setConfigs] = useState<LLMConfigs>(loadLLMConfigs())
  const [showKeys, setShowKeys] = useState<Record<LLMProvider, boolean>>({
    openai: false,
    deepseek: false,
    claude: false,
    gemini: false,
    moonshot: false,
    qwen: false
  })
  const [saved, setSaved] = useState(false)

  const updateConfig = (provider: LLMProvider, field: keyof LLMConfigs[LLMProvider], value: any) => {
    setConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value
      }
    }))
    setSaved(false)
  }

  const toggleShowKey = (provider: LLMProvider) => {
    setShowKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }))
  }

  const handleSave = () => {
    saveLLMConfigs(configs)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const providers: LLMProvider[] = ['openai', 'deepseek', 'claude', 'gemini', 'moonshot', 'qwen']

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回首页
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Save className="w-5 h-5" />
            {saved ? '已保存' : '保存配置'}
          </button>
        </div>

        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">LLM API 配置</h1>
          <p className="text-white/70">
            配置您要使用的 LLM 服务 API Key。配置将保存在本地浏览器中。
          </p>
        </div>

        {/* 配置卡片 */}
        <div className="space-y-6">
          {providers.map(provider => {
            const providerInfo = LLM_PROVIDERS[provider]
            const config = configs[provider]
            const isValid = config.apiKey ? validateAPIKey(provider, config.apiKey) : true
            const isEnabled = config.enabled

            return (
              <div
                key={provider}
                className={`bg-white/10 backdrop-blur-lg rounded-2xl p-6 border-2 transition-all ${
                  isEnabled ? 'border-green-500/50' : 'border-white/20'
                }`}
              >
                {/* 提供商头部 */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                        {providerInfo.name}
                        {isEnabled && config.apiKey && (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        )}
                      </h3>
                      <p className="text-white/60 text-sm mt-1">{providerInfo.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {providerInfo.website && (
                      <a
                        href={providerInfo.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        title="访问官网"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    )}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => updateConfig(provider, 'enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* API Key 输入 */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-white/90 mb-2 text-sm font-medium">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKeys[provider] ? 'text' : 'password'}
                        value={config.apiKey}
                        onChange={(e) => updateConfig(provider, 'apiKey', e.target.value)}
                        placeholder={`输入 ${providerInfo.name} API Key${providerInfo.keyPrefix ? ` (通常以 ${providerInfo.keyPrefix} 开头)` : ''}`}
                        className={`w-full px-4 py-3 bg-white/10 border-2 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all ${
                          config.apiKey && !isValid
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-white/20 focus:border-blue-500 focus:ring-blue-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(provider)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                      >
                        {showKeys[provider] ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {config.apiKey && !isValid && (
                      <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                        <XCircle className="w-4 h-4" />
                        API Key 格式可能不正确
                      </p>
                    )}
                    {providerInfo.keyPrefix && (
                      <p className="text-white/50 text-xs mt-1">
                        提示: API Key 通常以 <code className="bg-white/10 px-1 rounded">{providerInfo.keyPrefix}</code> 开头
                      </p>
                    )}
                  </div>

                  {/* API URL (可选) */}
                  {providerInfo.defaultUrl && (
                    <div>
                      <label className="block text-white/90 mb-2 text-sm font-medium">
                        API URL (可选)
                      </label>
                      <input
                        type="text"
                        value={config.apiUrl || ''}
                        onChange={(e) => updateConfig(provider, 'apiUrl', e.target.value)}
                        placeholder={providerInfo.defaultUrl}
                        className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all"
                      />
                      {!config.apiUrl && (
                        <p className="text-white/50 text-xs mt-1">
                          默认: <code className="bg-white/10 px-1 rounded">{providerInfo.defaultUrl}</code>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 使用说明 */}
        <div className="mt-8 bg-blue-500/20 backdrop-blur-lg rounded-2xl p-6 border border-blue-500/30">
          <h3 className="text-lg font-semibold text-white mb-3">使用说明</h3>
          <ul className="space-y-2 text-white/80 text-sm">
            <li>• 配置信息仅保存在您的浏览器本地，不会上传到服务器</li>
            <li>• 启用开关控制是否使用该 LLM 服务</li>
            <li>• API Key 可以在各服务商的官网获取</li>
            <li>• 建议定期检查和更新 API Key</li>
            <li>• 确保 API Key 安全，不要分享给他人</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
