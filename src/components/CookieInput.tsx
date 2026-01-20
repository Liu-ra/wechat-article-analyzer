import { useState, useEffect } from 'react'

interface CookieInputProps {
  url: string
  onSuccess: (stats: any) => void
  onCancel: () => void
}

export default function CookieInput({ url, onSuccess, onCancel }: CookieInputProps) {
  const [cookieString, setCookieString] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAutoMode, setIsAutoMode] = useState(false)
  const [autoStatus, setAutoStatus] = useState('')

  // 监听自动获取到的Cookie
  useEffect(() => {
    const handleAutoCookieFound = async (cookieStr: string) => {
      setAutoStatus('成功获取到Cookie，正在获取数据...')
      setIsLoading(true)

      try {
        const result = await window.electronAPI.fetchWithCookie(url, cookieStr)

        if (result.success && result.data) {
          await window.electronAPI.autoStopCookieMonitoring()
          onSuccess(result.data.stats)
        } else {
          setError(result.error || '获取数据失败')
          setAutoStatus('')
          setIsAutoMode(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取数据失败')
        setAutoStatus('')
        setIsAutoMode(false)
      } finally {
        setIsLoading(false)
      }
    }

    // 注册监听器并保存清理函数
    const removeListener = window.electronAPI.onAutoCookieFound(handleAutoCookieFound)

    return () => {
      // 移除事件监听器
      removeListener()

      if (isAutoMode) {
        window.electronAPI.autoStopCookieMonitoring()
      }
    }
  }, [url, onSuccess, isAutoMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!cookieString.trim()) {
      setError('请输入 Cookie 数据')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.fetchWithCookie(url, cookieString)

      if (result.success && result.data) {
        onSuccess(result.data.stats)
      } else {
        setError(result.error || '获取数据失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAutoStart = async () => {
    setIsLoading(true)
    setError(null)
    setAutoStatus('正在启动自动监听...')

    try {
      const result = await window.electronAPI.autoStartCookieMonitoring()

      if (result.success) {
        setIsAutoMode(true)
        setAutoStatus('准备就绪！请在微信中打开公众号文章')
      } else {
        setError(result.error || '启动失败')
        setAutoStatus('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动失败')
      setAutoStatus('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAutoStop = async () => {
    setIsLoading(true)
    try {
      await window.electronAPI.autoStopCookieMonitoring()
      setIsAutoMode(false)
      setAutoStatus('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '停止失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">使用 Cookie 获取数据</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 一键自动获取区域 */}
        <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
          <h3 className="font-semibold text-green-900 mb-3 text-lg">✨ 方式一：一键自动获取（推荐）</h3>

          {!isAutoMode ? (
            <div className="space-y-3">
              <p className="text-sm text-green-800">
                无需任何设置，点击下方按钮后，在微信中打开公众号文章即可自动获取数据。
              </p>
              <button
                onClick={handleAutoStart}
                disabled={isLoading}
                className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '启动中...' : '🚀 点击开始自动获取'}
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
                    <p className="text-lg font-semibold text-green-900">{autoStatus}</p>
                    <p className="text-sm text-green-700 mt-1">
                      请在微信（电脑版或手机版）中打开任意公众号文章，并下滑查看互动数据
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-green-800">
                <p className="font-medium">操作步骤：</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>打开微信（电脑版或手机版）</li>
                  <li>找到并打开公众号文章</li>
                  <li>下滑到文章底部，查看"阅读数"等互动数据</li>
                  <li>等待自动捕获完成</li>
                </ol>
              </div>

              <button
                onClick={handleAutoStop}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                停止监听
              </button>
            </div>
          )}
        </div>

        {/* 手动输入区域 */}
        <div className="p-6 bg-blue-50 border-b border-blue-100">
          <h3 className="font-semibold text-blue-900 mb-3">方式二：手动输入 Cookie</h3>

          <details className="text-sm">
            <summary className="cursor-pointer text-blue-800 hover:text-blue-900 font-medium mb-2">
              点击查看如何手动获取 Cookie
            </summary>

            <div className="mt-3 space-y-4 ml-4">
              {/* 方法1 */}
              <div>
                <h4 className="font-medium text-blue-900 mb-2">方法一：使用电脑版微信 + 抓包工具</h4>
                <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside ml-2">
                  <li>下载并安装 Fiddler 或 Charles 抓包工具</li>
                  <li>启动抓包工具，开始监听网络请求</li>
                  <li>在电脑版微信中打开公众号文章</li>
                  <li>在抓包工具中找到 mp.weixin.qq.com 域名的请求</li>
                  <li>查看请求头（Headers）中的 Cookie 字段</li>
                  <li>复制完整 Cookie 内容（包含 key 或 appmsg_token）</li>
                </ol>
              </div>

              {/* 方法2 */}
              <div>
                <h4 className="font-medium text-blue-900 mb-2">方法二：使用微信开发者工具</h4>
                <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside ml-2">
                  <li>下载并安装"微信开发者工具"</li>
                  <li>用公众号账号登录</li>
                  <li>在工具中访问文章链接</li>
                  <li>打开调试器，查看网络请求的 Cookie</li>
                </ol>
              </div>

              {/* 方法3 */}
              <div>
                <h4 className="font-medium text-blue-900 mb-2">方法三：从浏览器登录微信公众平台</h4>
                <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside ml-2">
                  <li>访问 mp.weixin.qq.com 登录公众平台</li>
                  <li>查看自己发布的文章</li>
                  <li>按 F12 打开开发者工具</li>
                  <li>切换到"网络"(Network) 标签</li>
                  <li>刷新页面，找到任意请求</li>
                  <li>在请求头中找到并复制 Cookie</li>
                </ol>
              </div>
            </div>

            <p className="mt-4 text-xs text-blue-700 border-t border-blue-200 pt-3">
              ⚠️ Cookie 包含登录凭证，请勿分享给他人。Cookie 通常在几小时后过期，过期后需重新获取。
            </p>
          </details>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Cookie 输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cookie 字符串
              </label>
              <textarea
                value={cookieString}
                onChange={(e) => setCookieString(e.target.value)}
                placeholder="粘贴从浏览器开发者工具中复制的 Cookie..."
                className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-wechat-green focus:border-transparent resize-none font-mono text-sm"
                disabled={isLoading}
              />
              <p className="mt-2 text-xs text-gray-500">
                支持格式：key=value; key2=value2 或 JSON 格式
              </p>
            </div>

            {/* 文章链接显示 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                目标文章
              </label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 break-all">
                {url}
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* 按钮 */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                取消
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-white bg-wechat-green rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? '获取中...' : '获取数据'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
