import { useState } from 'react'

interface BatchAnalyzerProps {
  url: string
  onBack: () => void
}

interface AccountInfo {
  biz: string
  nickname: string
  avatar: string
  signature: string
}

interface ArticleItem {
  title: string
  url: string
  cover: string
  digest: string
  publishTime: number
  author: string
}

type Step = 'extract' | 'getCookie' | 'fetchList' | 'analyze' | 'export'

export default function BatchAnalyzer({ url, onBack }: BatchAnalyzerProps) {
  const [step, setStep] = useState<Step>('extract')
  const [biz, setBiz] = useState('')
  const [profileUrl, setProfileUrl] = useState('')
  const [cookieString, setCookieString] = useState('')
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [articles, setArticles] = useState<ArticleItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maxCount, setMaxCount] = useState(50)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  // 步骤1：提取公众号信息
  const handleExtractAccount = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.extractAccountInfo(url)

      if (result.success && result.data) {
        setBiz(result.data.biz)
        setProfileUrl(result.data.profileUrl)
        setStep('getCookie')
      } else {
        setError(result.error || '提取公众号信息失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提取失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 步骤2：验证Cookie并获取公众号信息
  const handleVerifyCookie = async () => {
    if (!cookieString.trim()) {
      setError('请输入 Cookie')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.fetchAccountInfo(biz, cookieString)

      if (result.success && result.data) {
        setAccountInfo(result.data)
        setStep('fetchList')
      } else {
        setError(result.error || 'Cookie验证失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cookie验证失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 步骤3：批量获取文章列表
  const handleFetchArticles = async () => {
    setIsLoading(true)
    setError(null)
    setProgress({ current: 0, total: maxCount })

    try {
      const result = await window.electronAPI.fetchAllArticles(biz, cookieString, maxCount)

      if (result.success && result.data) {
        setArticles(result.data)
        setStep('export')
      } else {
        setError(result.error || '获取文章列表失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 步骤4：导出Excel
  const handleExportExcel = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 转换数据格式
      const exportData = articles.map(article => ({
        title: article.title,
        url: article.url,
        author: article.author,
        publishTime: new Date(article.publishTime * 1000).toLocaleString('zh-CN'),
        readCount: null,
        likeCount: null,
        wowCount: null,
        shareCount: null,
        favoriteCount: null,
        commentCount: null,
        wordCount: 0,
        digest: article.digest
      }))

      const result = await window.electronAPI.exportExcel(
        exportData,
        accountInfo?.nickname || '公众号'
      )

      if (result.success) {
        alert(`Excel文件已保存至：\n${result.path}`)
        onBack()
      } else {
        setError(result.error || '导出失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 复制链接到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('链接已复制到剪贴板')
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">批量分析公众号文章</h2>
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800"
          >
            返回
          </button>
        </div>

        {/* 进度指示器 */}
        <div className="flex items-center justify-between mb-8">
          {['extract', 'getCookie', 'fetchList', 'export'].map((s, idx) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step === s
                    ? 'bg-wechat-green text-white'
                    : step > s || (s === 'export' && articles.length > 0)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {idx + 1}
              </div>
              {idx < 3 && (
                <div
                  className={`w-20 h-1 mx-2 ${
                    step > s ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-sm underline"
            >
              关闭
            </button>
          </div>
        )}

        {/* 步骤1：提取公众号信息 */}
        {step === 'extract' && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                我们将从以下文章链接中提取公众号信息：
              </p>
              <p className="mt-2 text-sm text-gray-600 break-all">{url}</p>
            </div>

            <button
              onClick={handleExtractAccount}
              disabled={isLoading}
              className="w-full py-3 bg-wechat-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {isLoading ? '提取中...' : '开始提取公众号信息'}
            </button>
          </div>
        )}

        {/* 步骤2：获取Cookie */}
        {step === 'getCookie' && (
          <div className="space-y-4">
            <div className="p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-3 text-lg">
                📢 重要步骤：获取登录密钥
              </h3>
              <ol className="text-sm text-yellow-800 space-y-3 list-decimal list-inside">
                <li>点击下方按钮复制公众号历史消息页面链接</li>
                <li>打开微信，找到"文件传输助手"</li>
                <li>将复制的链接粘贴并发送给自己</li>
                <li>点击链接在微信中打开该页面</li>
                <li>使用抓包工具（如Fiddler）获取 Cookie</li>
                <li>或从浏览器开发者工具中复制 Cookie</li>
                <li>将 Cookie 粘贴到下方输入框</li>
              </ol>

              <div className="mt-4 flex items-center space-x-3">
                <input
                  type="text"
                  value={profileUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-yellow-300 rounded text-sm"
                />
                <button
                  onClick={() => copyToClipboard(profileUrl)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm font-medium"
                >
                  复制链接
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                粘贴 Cookie 字符串
              </label>
              <textarea
                value={cookieString}
                onChange={(e) => setCookieString(e.target.value)}
                placeholder="从微信或浏览器开发者工具中复制的 Cookie..."
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wechat-green focus:border-transparent resize-none font-mono text-sm"
                disabled={isLoading}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setStep('extract')}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                上一步
              </button>
              <button
                onClick={handleVerifyCookie}
                disabled={isLoading || !cookieString.trim()}
                className="flex-1 py-3 bg-wechat-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {isLoading ? '验证中...' : '验证 Cookie'}
              </button>
            </div>
          </div>
        )}

        {/* 步骤3：获取文章列表 */}
        {step === 'fetchList' && accountInfo && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-4">
                {accountInfo.avatar && (
                  <img
                    src={accountInfo.avatar}
                    alt={accountInfo.nickname}
                    className="w-16 h-16 rounded-full"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-green-900 text-lg">
                    {accountInfo.nickname}
                  </h3>
                  <p className="text-sm text-green-700">{accountInfo.signature}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                获取文章数量
              </label>
              <input
                type="number"
                value={maxCount}
                onChange={(e) => setMaxCount(Number(e.target.value))}
                min="1"
                max="1000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wechat-green focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                建议不超过 100 篇，避免请求过快被限制
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setStep('getCookie')}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                上一步
              </button>
              <button
                onClick={handleFetchArticles}
                disabled={isLoading}
                className="flex-1 py-3 bg-wechat-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {isLoading ? `获取中 ${progress.current}/${progress.total}...` : '开始获取文章'}
              </button>
            </div>
          </div>
        )}

        {/* 步骤4：导出Excel */}
        {step === 'export' && articles.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">✓ 文章获取成功</h3>
              <p className="text-sm text-purple-700">
                已成功获取 <span className="font-bold text-lg">{articles.length}</span> 篇文章
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              {articles.map((article, idx) => (
                <div
                  key={idx}
                  className="p-4 border-b border-gray-200 last:border-b-0 hover:bg-gray-50"
                >
                  <div className="flex items-start space-x-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800">{article.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(article.publishTime * 1000).toLocaleDateString('zh-CN')} · {article.author}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleExportExcel}
              disabled={isLoading}
              className="w-full py-3 bg-wechat-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium"
            >
              {isLoading ? '导出中...' : '📊 导出为 Excel 文件'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
