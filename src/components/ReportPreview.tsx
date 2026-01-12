import { ArticleData, ArticleStats, AnalysisResult } from '../types'

interface ReportPreviewProps {
  article: ArticleData
  stats: ArticleStats
  analysis: AnalysisResult
}

export default function ReportPreview({ article, stats, analysis }: ReportPreviewProps) {
  const formatNumber = (num: number | null): string => {
    if (num === null) return '-'
    return num.toLocaleString()
  }

  const getSentimentLabel = (label: string) => {
    switch (label) {
      case 'positive': return '正面'
      case 'negative': return '负面'
      default: return '中性'
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">报告预览</h2>

      <div className="border border-gray-200 rounded-lg p-6 bg-white" id="report-content">
        {/* 报告头部 */}
        <div className="text-center border-b border-gray-200 pb-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            微信公众号文章分析报告
          </h1>
          <p className="text-sm text-gray-500">
            生成时间：{new Date().toLocaleString('zh-CN')}
          </p>
        </div>

        {/* 文章基本信息 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">
            一、文章基本信息
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-2 text-gray-500 w-24">标题</td>
                <td className="py-2 text-gray-800">{article.title}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-500">作者</td>
                <td className="py-2 text-gray-800">{article.author || '未知'}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-500">发布时间</td>
                <td className="py-2 text-gray-800">{article.publishTime || '未知'}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-500">文章字数</td>
                <td className="py-2 text-gray-800">{article.wordCount} 字</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-500">图片数量</td>
                <td className="py-2 text-gray-800">{article.imageCount} 张</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 数据统计 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">
            二、数据统计
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xl font-bold text-wechat-green">{formatNumber(stats.readCount)}</p>
              <p className="text-xs text-gray-500">阅读量</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xl font-bold text-blue-500">{formatNumber(stats.likeCount)}</p>
              <p className="text-xs text-gray-500">点赞数</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xl font-bold text-orange-500">{formatNumber(stats.wowCount)}</p>
              <p className="text-xs text-gray-500">在看数</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xl font-bold text-purple-500">{formatNumber(stats.shareCount)}</p>
              <p className="text-xs text-gray-500">转发数</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xl font-bold text-pink-500">{formatNumber(stats.favoriteCount)}</p>
              <p className="text-xs text-gray-500">收藏数</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xl font-bold text-indigo-500">{formatNumber(stats.commentCount)}</p>
              <p className="text-xs text-gray-500">评论数</p>
            </div>
          </div>
          {stats.isManualInput && (
            <p className="text-xs text-gray-400 mt-2">* 数据为手动输入</p>
          )}
        </section>

        {/* 关键词分析 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">
            三、关键词分析
          </h2>
          <div className="flex flex-wrap gap-2">
            {analysis.keywords.map((keyword, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
              >
                {keyword.word}
                <span className="text-xs text-blue-400 ml-1">
                  ({(keyword.weight * 100).toFixed(0)})
                </span>
              </span>
            ))}
          </div>
        </section>

        {/* 内容摘要 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">
            四、内容摘要
          </h2>
          <p className="text-gray-700 leading-relaxed text-sm">{analysis.summary}</p>
        </section>

        {/* 情感分析 */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">
            五、情感分析
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">情感倾向</p>
              <p className="text-lg font-semibold">{getSentimentLabel(analysis.sentiment.label)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">情感分数</p>
              <p className="text-lg font-semibold">{(analysis.sentiment.score * 100).toFixed(0)} / 100</p>
            </div>
          </div>
          {analysis.sentiment.positiveWords.length > 0 && (
            <div className="mt-3">
              <p className="text-sm text-gray-500 mb-1">正面词汇</p>
              <p className="text-sm text-green-600">{analysis.sentiment.positiveWords.slice(0, 10).join('、')}</p>
            </div>
          )}
          {analysis.sentiment.negativeWords.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-1">负面词汇</p>
              <p className="text-sm text-red-600">{analysis.sentiment.negativeWords.slice(0, 10).join('、')}</p>
            </div>
          )}
        </section>

        {/* 报告尾部 */}
        <div className="text-center pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            本报告由「微信公众号文章分析工具 V1.0」自动生成
          </p>
        </div>
      </div>
    </div>
  )
}
