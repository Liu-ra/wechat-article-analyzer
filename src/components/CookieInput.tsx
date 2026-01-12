import { useState } from 'react'

interface CookieInputProps {
  url: string
  onSuccess: (stats: any) => void
  onCancel: () => void
}

export default function CookieInput({ url, onSuccess, onCancel }: CookieInputProps) {
  const [cookieString, setCookieString] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

        {/* 说明 */}
        <div className="p-6 bg-blue-50 border-b border-blue-100">
          <h3 className="font-semibold text-blue-900 mb-3">如何获取 Cookie？</h3>

          <div className="space-y-4">
            {/* 方法1 */}
            <div>
              <h4 className="font-medium text-blue-900 mb-2">方法一：使用电脑版微信 + 抓包工具（推荐）</h4>
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
