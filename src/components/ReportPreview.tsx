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

        {/* 文章优点 */}
        {analysis.strengths && analysis.strengths.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">
              五、文章优点
            </h2>
            <div className="space-y-3">
              {analysis.strengths.map((strength, index) => (
                <div key={index} className="p-3 bg-green-50 rounded-lg">
                  <p className="font-medium text-green-800">{strength.title}</p>
                  <p className="text-sm text-green-600 mt-1">{strength.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 文章缺点与建议 */}
        {analysis.weaknesses && analysis.weaknesses.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">
              六、改进建议
            </h2>
            <div className="space-y-3">
              {analysis.weaknesses.map((weakness, index) => (
                <div key={index} className="p-3 bg-orange-50 rounded-lg">
                  <p className="font-medium text-orange-800">{weakness.title}</p>
                  <p className="text-sm text-orange-600 mt-1">{weakness.description}</p>
                  <p className="text-sm text-blue-600 mt-2">
                    <span className="font-medium">建议：</span>{weakness.suggestion}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 配图建议 */}
        {analysis.imageSuggestions && analysis.imageSuggestions.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">
              七、配图建议
            </h2>
            <div className="space-y-3">
              {analysis.imageSuggestions.map((suggestion, index) => (
                <div key={index} className="p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-purple-200 text-purple-800 rounded text-xs">{suggestion.type}</span>
                    <span className="text-sm text-purple-600">{suggestion.position}</span>
                  </div>
                  <p className="text-sm text-purple-700 mt-2">{suggestion.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 报告尾部 */}
        <div className="text-center pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            本报告由「微信公众号文章分析工具 V2.0」自动生成
          </p>
        </div>
      </div>
    </div>
  )
}
