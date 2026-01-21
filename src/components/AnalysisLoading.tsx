import { useState, useEffect } from 'react'

interface AnalysisLoadingProps {
  isVisible: boolean
  status: string
  thinkingContent?: string
}

export default function AnalysisLoading({ isVisible, status, thinkingContent }: AnalysisLoadingProps) {
  const [dots, setDots] = useState('')

  // 动画效果：循环显示点点点
  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)

    return () => clearInterval(interval)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4">
        {/* AI 图标动画 */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* 外圈旋转 */}
            <div className="w-20 h-20 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600"></div>
            {/* 内圈图标 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-10 h-10 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* 状态文字 */}
        <div className="text-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            DeepSeek AI 正在分析
          </h3>
          <p className="text-purple-600 font-medium">
            {status}{dots}
          </p>
        </div>

        {/* 进度条动画 */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"
               style={{ width: '100%', animation: 'loading-progress 2s ease-in-out infinite' }}>
          </div>
        </div>

        {/* 思考内容显示（如果有） */}
        {thinkingContent && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-48 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500">AI 思考过程</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
              {thinkingContent}
            </p>
          </div>
        )}

        {/* 提示信息 */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            AI 分析需要一定时间，请耐心等待
          </p>
        </div>
      </div>

      <style>{`
        @keyframes loading-progress {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}
