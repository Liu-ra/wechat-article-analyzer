import { AnalysisResult } from '../types'

interface AnalysisResultViewProps {
  analysis: AnalysisResult
}

export default function AnalysisResultView({ analysis }: AnalysisResultViewProps) {
  const getSentimentColor = (label: string) => {
    switch (label) {
      case 'positive': return 'text-green-600'
      case 'negative': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getSentimentLabel = (label: string) => {
    switch (label) {
      case 'positive': return '正面'
      case 'negative': return '负面'
      default: return '中性'
    }
  }

  const getSentimentBgColor = (label: string) => {
    switch (label) {
      case 'positive': return 'bg-green-50 border-green-200'
      case 'negative': return 'bg-red-50 border-red-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* 关键词 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">关键词提取</h2>
        <div className="flex flex-wrap gap-2">
          {analysis.keywords.map((keyword, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
              style={{
                fontSize: `${Math.max(12, Math.min(18, 12 + keyword.weight * 6))}px`,
                opacity: Math.max(0.6, Math.min(1, 0.6 + keyword.weight * 0.4))
              }}
            >
              {keyword.word}
            </span>
          ))}
        </div>
      </div>

      {/* 内容摘要 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">内容摘要</h2>
        <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
      </div>

      {/* 情感分析 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">情感分析</h2>

        <div className={`p-4 rounded-lg border ${getSentimentBgColor(analysis.sentiment.label)}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-sm text-gray-500">情感倾向</span>
              <p className={`text-2xl font-bold ${getSentimentColor(analysis.sentiment.label)}`}>
                {getSentimentLabel(analysis.sentiment.label)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-500">情感分数</span>
              <p className={`text-2xl font-bold ${getSentimentColor(analysis.sentiment.label)}`}>
                {(analysis.sentiment.score * 100).toFixed(0)}
              </p>
            </div>
          </div>

          {/* 情感分数条 */}
          <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-400 via-gray-400 to-green-400"
              style={{ width: '100%' }}
            />
            <div
              className="absolute top-0 w-3 h-4 bg-white border-2 border-gray-600 rounded-full transform -translate-x-1/2"
              style={{ left: `${(analysis.sentiment.score + 1) * 50}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>负面</span>
            <span>中性</span>
            <span>正面</span>
          </div>
        </div>

        {/* 情感词汇 */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          {analysis.sentiment.positiveWords.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-700 mb-2">正面词汇</h4>
              <div className="flex flex-wrap gap-1">
                {analysis.sentiment.positiveWords.slice(0, 10).map((word, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}
          {analysis.sentiment.negativeWords.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-700 mb-2">负面词汇</h4>
              <div className="flex flex-wrap gap-1">
                {analysis.sentiment.negativeWords.slice(0, 10).map((word, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
