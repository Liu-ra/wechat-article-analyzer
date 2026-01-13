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

  // 步骤2：自动获取Cookie
  const handleAutoGetCookie = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 调用自动获取Cookie API
      const result = await window.electronAPI.autoGetCookie(profileUrl)

      if (result.success && result.data) {
        const obtainedCookie = result.data.cookieString
        setCookieString(obtainedCookie)

        // 自动验证获取到的Cookie
        const verifyResult = await window.electronAPI.fetchAccountInfo(biz, obtainedCookie)

        if (verifyResult.success && verifyResult.data) {
          setAccountInfo(verifyResult.data)
          setStep('fetchList')
        } else {
          setError(verifyResult.error || 'Cookie验证失败')
        }
      } else {
        setError(result.error || '自动获取Cookie失败，请尝试手动粘贴方式')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '自动获取Cookie失败')
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
            {/* 自动获取Cookie推荐区域 */}
            <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-3 text-lg flex items-center gap-2">
                <span className="text-2xl">✨</span>
                <span>方式一：自动获取 Cookie（推荐）</span>
              </h3>
              <p className="text-sm text-green-800 mb-4">
                点击下方按钮，将自动打开微信登录窗口。您只需使用微信扫码登录，系统会自动提取 Cookie 并验证，无需手动复制粘贴！
              </p>
              <button
                onClick={handleAutoGetCookie}
                disabled={isLoading}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>正在获取...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl">🚀</span>
                    <span>一键自动获取 Cookie</span>
                  </>
                )}
              </button>
            </div>

            {/* 手动获取Cookie区域 */}
            <div className="p-6 bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-300 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3 text-lg flex items-center gap-2">
                <span className="text-2xl">📋</span>
                <span>方式二：手动粘贴 Cookie</span>
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                如果自动获取失败，可以手动复制链接到微信中打开，使用抓包工具获取 Cookie
              </p>

              <div className="flex items-center space-x-3 mb-4">
                <input
                  type="text"
                  value={profileUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={() => copyToClipboard(profileUrl)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium"
                >
                  复制链接
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  粘贴 Cookie 字符串
                </label>
                <textarea
                  value={cookieString}
                  onChange={(e) => setCookieString(e.target.value)}
                  placeholder="从微信或浏览器开发者工具中复制的 Cookie..."
                  className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none font-mono text-sm"
                  disabled={isLoading}
                />
              </div>
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
