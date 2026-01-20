import { useState, useEffect } from 'react'

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
type DownloadFormat = 'html' | 'pdf' | 'word'

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
  const [downloadAll, setDownloadAll] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [isProxyRunning, setIsProxyRunning] = useState(false)
  // 下载内容相关状态
  const [selectedFormats, setSelectedFormats] = useState<DownloadFormat[]>(['html'])
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, currentTitle: '' })
  const [isDownloading, setIsDownloading] = useState(false)

  // 监听自动获取到的Cookie
  useEffect(() => {
    const handleCookieFound = async (cookie: string) => {
      console.log('🎯 收到自动捕获的Cookie', { cookieLength: cookie.length, biz })

      setCookieString(cookie)
      setIsProxyRunning(false)
      setIsLoading(true)
      setError(null)

      // 停止自动监听
      try {
        await window.electronAPI.autoStopCookieMonitoring()
        console.log('✓ 代理服务器已停止，原始代理设置已恢复')
      } catch (err) {
        console.error('停止自动监听失败', err)
      }

      // 自动验证Cookie
      if (!biz) {
        console.error('❌ biz 为空，无法验证Cookie')
        setError('内部错误：公众号信息未提取')
        setIsLoading(false)
        return
      }

      console.log('🔍 开始自动验证Cookie', { biz })

      try {
        const verifyResult = await window.electronAPI.fetchAccountInfo(biz, cookie)
        console.log('📋 验证结果', verifyResult)

        if (verifyResult.success && verifyResult.data) {
          setAccountInfo(verifyResult.data)
          setStep('fetchList')
          setError(null)
          console.log('✅ Cookie自动验证成功，已进入下一步')
        } else {
          setError(verifyResult.error || 'Cookie验证失败')
          console.error('❌ Cookie验证失败', verifyResult.error)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Cookie验证失败'
        setError(errorMsg)
        console.error('❌ 验证Cookie异常', err)
      } finally {
        setIsLoading(false)
      }
    }

    // 注册监听器并保存清理函数
    const removeListener = window.electronAPI.onAutoCookieFound(handleCookieFound)

    // 清理函数
    return () => {
      // 移除事件监听器
      removeListener()
      console.log('🧹 清理 Cookie 监听器')
    }
  }, [biz])

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

  // 一键启动自动监听Cookie
  const handleAutoGetCookie = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 启动一键自动监听
      const result = await window.electronAPI.autoStartCookieMonitoring()

      if (result.success) {
        setIsProxyRunning(true)
        setError(null)
        // 代理启动成功后重置加载状态
        setIsLoading(false)
      } else {
        setError(result.error || '启动监听失败')
        setIsLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动监听失败')
      setIsLoading(false)
    }
  }

  // 停止自动监听
  const handleStopProxy = async () => {
    try {
      await window.electronAPI.autoStopCookieMonitoring()
      setIsProxyRunning(false)
      setIsLoading(false)
    } catch (err) {
      console.error('停止自动监听失败', err)
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
    // 如果选择下载全部，传入 0；否则传入用户设置的数量
    const count = downloadAll ? 0 : maxCount
    setProgress({ current: 0, total: count })

    try {
      const result = await window.electronAPI.fetchAllArticles(biz, cookieString, count)

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

  // 切换下载格式选择
  const toggleFormat = (format: DownloadFormat) => {
    setSelectedFormats(prev => {
      if (prev.includes(format)) {
        // 至少保留一个格式
        if (prev.length === 1) return prev
        return prev.filter(f => f !== format)
      } else {
        return [...prev, format]
      }
    })
  }

  // 下载文章内容
  const handleDownloadContent = async () => {
    if (selectedFormats.length === 0) {
      setError('请至少选择一种下载格式')
      return
    }

    setIsDownloading(true)
    setError(null)
    setDownloadProgress({ current: 0, total: articles.length, currentTitle: '' })

    try {
      const result = await window.electronAPI.downloadArticlesContent(
        articles,
        accountInfo?.nickname || '公众号',
        selectedFormats,
        cookieString
      )

      if (result.success && result.data) {
        const { outputDir, downloadedCount, errors } = result.data
        let message = `下载完成！\n\n已成功下载 ${downloadedCount} 篇文章\n保存位置：${outputDir}`
        if (errors && errors.length > 0) {
          message += `\n\n部分文章下载失败（${errors.length}篇）`
        }
        alert(message)
      } else {
        setError(result.error || '下载失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载失败')
    } finally {
      setIsDownloading(false)
      setDownloadProgress({ current: 0, total: 0, currentTitle: '' })
    }
  }

  // 复制链接到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      // 尝试使用现代 API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        alert('链接已复制到剪贴板')
        return
      }
    } catch (err) {
      console.log('navigator.clipboard failed, trying fallback', err)
    }

    // 回退方案：使用临时 textarea
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '-9999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      if (success) {
        alert('链接已复制到剪贴板')
      } else {
        alert('复制失败，请手动复制')
      }
    } catch (err) {
      console.error('Copy failed:', err)
      alert('复制失败，请手动复制')
    }
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
            {/* 一键自动获取Cookie区域 */}
            <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-3 text-lg flex items-center gap-2">
                <span className="text-2xl">✨</span>
                <span>方式一：一键自动获取 Cookie（推荐）</span>
              </h3>

              {!isProxyRunning ? (
                <div className="space-y-3">
                  <p className="text-sm text-green-800">
                    无需任何设置，点击下方按钮后，在微信中打开公众号历史消息链接，并下滑查看更多文章即可自动获取数据。
                  </p>

                  {/* 显示生成的历史列表链接 */}
                  <div className="p-3 bg-white border border-green-200 rounded-lg">
                    <p className="text-xs text-green-700 mb-2">公众号历史消息链接：</p>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={profileUrl}
                        readOnly
                        className="flex-1 px-2 py-1.5 bg-gray-50 border border-green-200 rounded text-xs text-gray-600"
                      />
                      <button
                        onClick={() => copyToClipboard(profileUrl)}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs font-medium"
                      >
                        复制
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleAutoGetCookie}
                    disabled={isLoading}
                    className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span className="text-xl">🚀</span>
                    <span>{isLoading ? '启动中...' : '点击开始自动获取'}</span>
                  </button>
                  <p className="text-xs text-green-700">
                    提示：首次使用可能需要安装证书，请按照系统提示操作
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-white border-2 border-green-400 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-semibold text-green-900">准备就绪！请在微信中打开公众号历史消息</p>
                        <p className="text-sm text-green-700 mt-1">
                          在微信（电脑版或手机版）中打开下方链接，并<strong>下滑加载更多文章</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-green-800">
                    <p className="font-medium">操作步骤：</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>复制下方的公众号历史消息链接</li>
                      <li>在微信（电脑版或手机版）中打开该链接</li>
                      <li><strong className="text-red-600">向下滑动加载更多文章</strong>（必须操作！）</li>
                      <li>等待自动捕获完成</li>
                    </ol>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={profileUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-green-300 rounded text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(profileUrl)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                    >
                      复制链接
                    </button>
                  </div>

                  <button
                    onClick={handleStopProxy}
                    className="w-full py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                  >
                    停止监听
                  </button>
                </div>
              )}
            </div>

            {/* 手动获取Cookie区域 */}
            <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-3 text-lg">方式二：手动输入 Cookie</h3>

              <details className="text-sm">
                <summary className="cursor-pointer text-blue-800 hover:text-blue-900 font-medium mb-2">
                  点击查看如何手动获取 Cookie
                </summary>

                <div className="mt-3 space-y-3 ml-4">
                  <p className="text-sm text-blue-800">
                    使用 Fiddler 等抓包工具，捕获 <code className="bg-blue-200 px-1 rounded text-xs">action=getmsg</code> 请求的 Cookie
                  </p>
                  <div className="p-2 bg-white rounded border border-blue-300">
                    <p className="text-xs text-blue-800">
                      💡 <strong>关键步骤：</strong>在微信中打开公众号历史页面后，必须<strong>向下滚动加载更多文章</strong>，才会触发包含完整Cookie的请求
                    </p>
                  </div>
                </div>
              </details>

              <div className="mt-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={profileUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(profileUrl)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                  >
                    复制链接
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-900 mb-2">
                    粘贴 Cookie 字符串
                  </label>
                  <textarea
                    value={cookieString}
                    onChange={(e) => setCookieString(e.target.value)}
                    placeholder="从抓包工具中复制的 Cookie..."
                    className="w-full h-32 px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                    disabled={isLoading}
                  />
                </div>
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

              <div className="mb-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={downloadAll}
                    onChange={(e) => setDownloadAll(e.target.checked)}
                    className="w-4 h-4 text-wechat-green border-gray-300 rounded focus:ring-wechat-green"
                  />
                  <span className="ml-2 text-sm text-gray-700">下载全部文章（不限数量）</span>
                </label>
              </div>

              <input
                type="number"
                value={maxCount}
                onChange={(e) => setMaxCount(Number(e.target.value))}
                min="1"
                max="1000"
                disabled={downloadAll}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wechat-green focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                {downloadAll
                  ? '将下载该公众号的所有历史文章，可能需要较长时间'
                  : '建议不超过 100 篇，避免请求过快被限制'}
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
                {isLoading
                  ? downloadAll
                    ? `获取中 已获取 ${progress.current} 篇...`
                    : `获取中 ${progress.current}/${progress.total}...`
                  : '开始获取文章'}
              </button>
            </div>
          </div>
        )}

        {/* 步骤4：批量下载 */}
        {step === 'export' && articles.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">✓ 文章获取成功</h3>
              <p className="text-sm text-purple-700">
                已成功获取 <span className="font-bold text-lg">{articles.length}</span> 篇文章
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
              {articles.map((article, idx) => (
                <div
                  key={idx}
                  className="p-3 border-b border-gray-200 last:border-b-0 hover:bg-gray-50"
                >
                  <div className="flex items-start space-x-3">
                    <span className="flex-shrink-0 w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800 text-sm">{article.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(article.publishTime * 1000).toLocaleDateString('zh-CN')} · {article.author}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 下载选项区域 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 下载文章链接 */}
              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <span>📋</span>
                  <span>下载文章链接</span>
                </h4>
                <p className="text-sm text-blue-700 mb-3">
                  导出包含所有文章标题、链接、发布时间等信息的Excel表格
                </p>
                <button
                  onClick={handleExportExcel}
                  disabled={isLoading || isDownloading}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
                >
                  {isLoading ? '导出中...' : '📊 导出 Excel'}
                </button>
              </div>

              {/* 下载文章内容 */}
              <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <span>📁</span>
                  <span>下载文章内容</span>
                </h4>
                <p className="text-sm text-green-700 mb-3">
                  下载文章完整内容，保存到「{accountInfo?.nickname || '公众号'}」文件夹
                </p>

                {/* 格式选择 */}
                <div className="mb-3">
                  <p className="text-xs text-green-800 mb-2">选择下载格式（可多选）：</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFormats.includes('html')}
                        onChange={() => toggleFormat('html')}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">HTML</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFormats.includes('pdf')}
                        onChange={() => toggleFormat('pdf')}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">PDF</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFormats.includes('word')}
                        onChange={() => toggleFormat('word')}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Word</span>
                    </label>
                  </div>
                </div>

                {/* 下载进度 */}
                {isDownloading && (
                  <div className="mb-3 p-2 bg-white rounded border border-green-300">
                    <div className="flex items-center justify-between text-xs text-green-800 mb-1">
                      <span>正在下载...</span>
                      <span>{downloadProgress.current}/{downloadProgress.total}</span>
                    </div>
                    <div className="w-full bg-green-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                    {downloadProgress.currentTitle && (
                      <p className="text-xs text-green-700 mt-1 truncate">
                        {downloadProgress.currentTitle}
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleDownloadContent}
                  disabled={isLoading || isDownloading || selectedFormats.length === 0}
                  className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
                >
                  {isDownloading ? '下载中...' : '📥 下载内容'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
