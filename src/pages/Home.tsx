import { useNavigate } from 'react-router-dom'
import { Play, Wand2, Zap, Settings } from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 relative">
      <div className="container mx-auto px-4 py-16">
        {/* 设置按钮 */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => navigate('/llm-config')}
            className="flex items-center gap-2 bg-white/20 backdrop-blur-lg text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-all shadow-lg"
            title="LLM 配置"
          >
            <Settings className="w-5 h-5" />
            <span className="hidden sm:inline">LLM 配置</span>
          </button>
        </div>
        {/* 头部 */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
            一键游戏开发平台
          </h1>
          <p className="text-xl text-white/90 mb-8">
            无需编程，轻松创建你的专属游戏
          </p>
          <button
            onClick={() => navigate('/editor')}
            className="bg-white text-purple-600 px-8 py-4 rounded-full text-xl font-semibold hover:bg-purple-50 transition-all transform hover:scale-105 shadow-2xl flex items-center gap-2 mx-auto"
          >
            <Wand2 className="w-6 h-6" />
            开始创作
          </button>
        </div>

        {/* 特性展示 */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <FeatureCard
            icon={<Zap className="w-12 h-12" />}
            title="快速开发"
            description="选择模板，配置参数，几分钟内完成游戏创作"
          />
          <FeatureCard
            icon={<Play className="w-12 h-12" />}
            title="实时预览"
            description="随时预览游戏效果，所见即所得"
          />
          <FeatureCard
            icon={<Wand2 className="w-12 h-12" />}
            title="一键导出"
            description="生成完整游戏代码，支持下载和部署"
          />
        </div>

        {/* 示例游戏 */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            游戏模板
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <TemplateCard
              emoji="🦘"
              name="平台跳跃"
              description="经典的跳跃游戏"
            />
            <TemplateCard
              emoji="🎯"
              name="射击游戏"
              description="消灭敌人获得分数"
            />
            <TemplateCard
              emoji="🧩"
              name="解谜游戏"
              description="收集物品解开谜题"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center text-white border border-white/20 hover:bg-white/20 transition-all">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-white/80">{description}</p>
    </div>
  )
}

function TemplateCard({ emoji, name, description }: {
  emoji: string
  name: string
  description: string
}) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center text-white border border-white/20 hover:bg-white/20 transition-all cursor-pointer">
      <div className="text-6xl mb-4">{emoji}</div>
      <h3 className="text-xl font-semibold mb-2">{name}</h3>
      <p className="text-white/80">{description}</p>
    </div>
  )
}
