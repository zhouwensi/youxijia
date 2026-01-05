import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Download, Sparkles, Zap } from 'lucide-react'
import { gameTemplates } from '../data/templates'
import { GameConfig, GameSettings } from '../types/game'
import { Logger } from '../utils/logger'
import LoadingOverlay from '../components/LoadingOverlay'

export default function GameEditor() {
  const navigate = useNavigate()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [gameConfig, setGameConfig] = useState<Partial<GameSettings>>({})
  const [loading, setLoading] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState<string[]>([])
  const [loadingProgress, setLoadingProgress] = useState(0)

  const handleTemplateSelect = (templateId: string) => {
    Logger.info(`选择模板: ${templateId}`)
    const template = gameTemplates.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(templateId)
      setGameConfig(template.config)
      Logger.success('模板加载成功')
    }
  }

  const handlePreview = async () => {
    if (!selectedTemplate || !gameConfig) return

    setLoading(true)
    setLoadingProgress(0)
    setLoadingLogs([])

    const addLog = (msg: string) => {
      setLoadingLogs(prev => [...prev, msg])
      Logger.info(msg)
    }

    try {
      addLog('准备游戏配置...')
      setLoadingProgress(20)

      await new Promise(resolve => setTimeout(resolve, 300))

      addLog('验证配置参数...')
      setLoadingProgress(40)

      const config: GameConfig = {
        id: Date.now().toString(),
        name: '我的游戏',
        type: 'platformer',
        template: gameTemplates.find(t => t.id === selectedTemplate)!,
        settings: gameConfig as GameSettings,
        createdAt: new Date().toISOString()
      }

      addLog('保存游戏配置...')
      setLoadingProgress(60)

      localStorage.setItem('gameConfig', JSON.stringify(config))

      addLog('配置保存成功')
      setLoadingProgress(80)
      await new Promise(resolve => setTimeout(resolve, 200))

      addLog('打开预览窗口...')
      setLoadingProgress(100)

      window.open('/preview', '_blank')
      
      setTimeout(() => {
        setLoading(false)
        setLoadingLogs([])
        setLoadingProgress(0)
      }, 500)
    } catch (error) {
      Logger.error(`预览失败: ${error}`)
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!selectedTemplate || !gameConfig) return

    setLoading(true)
    setLoadingProgress(0)
    setLoadingLogs([])

    const addLog = (msg: string) => {
      setLoadingLogs(prev => [...prev, msg])
      Logger.info(msg)
    }

    try {
      addLog('准备导出游戏...')
      setLoadingProgress(30)

      const config: GameConfig = {
        id: Date.now().toString(),
        name: '我的游戏',
        type: 'platformer',
        template: gameTemplates.find(t => t.id === selectedTemplate)!,
        settings: gameConfig as GameSettings,
        createdAt: new Date().toISOString()
      }

      addLog('生成配置文件...')
      setLoadingProgress(60)

      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `game-${Date.now()}.json`
      
      addLog('下载配置文件...')
      setLoadingProgress(90)

      a.click()
      URL.revokeObjectURL(url)

      addLog('导出完成！')
      setLoadingProgress(100)

      setTimeout(() => {
        setLoading(false)
        setLoadingLogs([])
        setLoadingProgress(0)
      }, 500)
    } catch (error) {
      Logger.error(`导出失败: ${error}`)
      setLoading(false)
    }
  }

  const updateConfig = (path: string, value: any) => {
    setGameConfig(prev => {
      const keys = path.split('.')
      const newConfig = { ...prev }
      let current: any = newConfig
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {}
        current = current[keys[i]]
      }
      
      current[keys[keys.length - 1]] = value
      return newConfig
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>返回</span>
          </button>
          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={!selectedTemplate || loading}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-2.5 rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 disabled:shadow-none"
            >
              <Play className="w-5 h-5" />
              预览
            </button>
            <button
              onClick={handleExport}
              disabled={!selectedTemplate || loading}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2.5 rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 disabled:shadow-none"
            >
              <Download className="w-5 h-5" />
              导出
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* 左侧：模板选择 */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">选择模板</h2>
              </div>
              <div className="space-y-3">
                {gameTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedTemplate === template.id
                        ? 'border-cyan-400 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 shadow-lg shadow-cyan-500/30'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">{template.preview}</span>
                      <div>
                        <h3 className={`font-semibold ${selectedTemplate === template.id ? 'text-cyan-300' : 'text-white'}`}>
                          {template.name}
                        </h3>
                        <p className="text-white/60 text-sm mt-1">{template.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧：配置面板 */}
          <div className="lg:col-span-2">
            {selectedTemplate ? (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
                <div className="flex items-center gap-2 mb-6">
                  <Zap className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white">游戏配置</h2>
                </div>
                
                <div className="space-y-6">
                  {/* 基础设置 */}
                  <ConfigSection title="基础设置">
                    <ConfigItem
                      label="游戏宽度"
                      value={gameConfig.width || 800}
                      onChange={(v) => updateConfig('width', parseInt(v))}
                      type="number"
                    />
                    <ConfigItem
                      label="游戏高度"
                      value={gameConfig.height || 600}
                      onChange={(v) => updateConfig('height', parseInt(v))}
                      type="number"
                    />
                    <ConfigItem
                      label="背景颜色"
                      value={gameConfig.backgroundColor || '#87CEEB'}
                      onChange={(v) => updateConfig('backgroundColor', v)}
                      type="color"
                    />
                  </ConfigSection>

                  {/* 玩家设置 */}
                  {gameConfig.player && (
                    <ConfigSection title="玩家设置">
                      <ConfigItem
                        label="移动速度"
                        value={gameConfig.player.speed || 200}
                        onChange={(v) => updateConfig('player.speed', parseInt(v))}
                        type="number"
                      />
                      <ConfigItem
                        label="跳跃力度"
                        value={gameConfig.player.jumpPower || 400}
                        onChange={(v) => updateConfig('player.jumpPower', parseInt(v))}
                        type="number"
                      />
                      <ConfigItem
                        label="玩家颜色"
                        value={gameConfig.player.color || '#FF6B6B'}
                        onChange={(v) => updateConfig('player.color', v)}
                        type="color"
                      />
                      <ConfigItem
                        label="玩家大小"
                        value={gameConfig.player.size || 32}
                        onChange={(v) => updateConfig('player.size', parseInt(v))}
                        type="number"
                      />
                    </ConfigSection>
                  )}

                  {/* 游戏设置 */}
                  <ConfigSection title="游戏设置">
                    <ConfigItem
                      label="重力"
                      value={gameConfig.gravity || 800}
                      onChange={(v) => updateConfig('gravity', parseInt(v))}
                      type="number"
                    />
                    {gameConfig.level && (
                      <>
                        <ConfigItem
                          label="关卡名称"
                          value={gameConfig.level.name || ''}
                          onChange={(v) => updateConfig('level.name', v)}
                          type="text"
                        />
                        <ConfigItem
                          label="难度"
                          value={gameConfig.level.difficulty || 'easy'}
                          onChange={(v) => updateConfig('level.difficulty', v)}
                          type="select"
                          options={['easy', 'medium', 'hard']}
                        />
                      </>
                    )}
                  </ConfigSection>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-12 border border-white/10 text-center shadow-2xl">
                <Sparkles className="w-16 h-16 text-white/30 mx-auto mb-4" />
                <p className="text-white/70 text-lg">
                  请选择一个游戏模板开始
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 加载遮罩 */}
      {loading && (
        <LoadingOverlay 
          message={loadingLogs[loadingLogs.length - 1] || '处理中...'}
          progress={loadingProgress}
          logs={loadingLogs}
        />
      )}
    </div>
  )
}

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/10 pb-6 last:border-0 last:pb-0">
      <h3 className="text-lg font-semibold text-white/90 mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function ConfigItem({ label, value, onChange, type, options }: {
  label: string
  value: any
  onChange: (value: string) => void
  type: 'text' | 'number' | 'color' | 'select'
  options?: string[]
}) {
  return (
    <div>
      <label className="block text-white/80 mb-2 text-sm font-medium">{label}</label>
      {type === 'select' && options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all backdrop-blur-sm"
        >
          {options.map(opt => (
            <option key={opt} value={opt} className="bg-gray-900">
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all backdrop-blur-sm placeholder-white/30"
        />
      )}
    </div>
  )
}
