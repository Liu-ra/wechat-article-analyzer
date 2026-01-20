import { ArticleData } from '../types'

interface ArticlePreviewProps {
  article: ArticleData
}

export default function ArticlePreview({ article }: ArticlePreviewProps) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">文章预览</h2>

      <div className="space-y-4">
        {/* 基本信息 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500">标题</label>
            <p className="text-gray-800 font-medium">{article.title || '未获取到标题'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">作者</label>
            <p className="text-gray-800">{article.author || '未知'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">发布时间</label>
            <p className="text-gray-800">{article.publishTime || '未知'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">字数/图片</label>
            <p className="text-gray-800">
              {article.wordCount} 字 / {article.imageCount} 张图片
            </p>
          </div>
        </div>

        {/* 文章内容预览 */}
        <div>
          <label className="text-sm text-gray-500 mb-2 block">内容预览</label>
          <div className="max-h-60 overflow-y-auto p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed">
            {article.content.slice(0, 500)}
            {article.content.length > 500 && '...'}
          </div>
        </div>

        {/* 图片预览 */}
        {article.images.length > 0 && (
          <div>
            <label className="text-sm text-gray-500 mb-2 block">
              图片 ({article.images.length} 张)
            </label>
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {article.images.slice(0, 5).map((img, index) => {
                // base64图片不需要crossOrigin和referrerPolicy
                const isBase64 = img.startsWith('data:')
                return (
                  <img
                    key={index}
                    src={img}
                    alt={`图片 ${index + 1}`}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                    {...(!isBase64 && { referrerPolicy: "no-referrer", crossOrigin: "anonymous" })}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      if (target.dataset.failed) return // 避免重复设置
                      target.dataset.failed = 'true'
                      target.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#f3f4f6"/><text x="40" y="40" text-anchor="middle" dominant-baseline="middle" fill="#9ca3af" font-size="12" font-family="sans-serif">加载失败</text></svg>'
                      )
                    }}
                  />
                )
              })}
              {article.images.length > 5 && (
                <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-sm flex-shrink-0">
                  +{article.images.length - 5}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
