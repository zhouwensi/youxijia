import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingOverlayProps {
  message?: string
  progress?: number
  logs?: string[]
}

export default function LoadingOverlay({ message = '加载中...', progress, logs = [] }: LoadingOverlayProps) {
  const [displayLogs, setDisplayLogs] = useState<string[]>([])

  useEffect(() => {
    setDisplayLogs(logs.slice(-5)) // 只显示最后5条日志
  }, [logs])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-cyan-500/30 shadow-2xl">
        {/* 加载动画 */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
            <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-400 animate-spin" style={{ animationDuration: '0.8s' }}></div>
          </div>
          <p className="mt-4 text-white text-lg font-medium">{message}</p>
          {progress !== undefined && (
            <div className="mt-4 w-full">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-center text-gray-400 text-sm mt-2">{progress}%</p>
            </div>
          )}
        </div>

        {/* 日志输出 */}
        {displayLogs.length > 0 && (
          <div className="mt-6 bg-black/50 rounded-lg p-4 border border-cyan-500/20">
            <div className="text-cyan-400 text-xs font-mono space-y-1 max-h-32 overflow-y-auto">
              {displayLogs.map((log, index) => (
                <div key={index} className="text-gray-300">{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
