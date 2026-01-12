import { useState, useCallback, FormEvent } from 'react'

interface UrlInputProps {
  onSubmit: (url: string, mode?: 'single' | 'batch') => void
  isLoading: boolean
}

export default function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'single' | 'batch'>('single')

  const validateUrl = (url: string): boolean => {
    // 验证是否是微信公众号文章链接
    const wxPattern = /^https?:\/\/mp\.weixin\.qq\.com\//
    return wxPattern.test(url)
  }

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()

    const trimmedUrl = url.trim()

    if (!trimmedUrl) {
      setError('请输入文章链接')
      return
    }

    if (!validateUrl(trimmedUrl)) {
      setError('请输入有效的微信公众号文章链接')
      return
    }

    setError('')
    onSubmit(trimmedUrl, mode)
  }, [url, mode, onSubmit])

  return (
    <div className="card max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          开始分析
        </h2>
        <p className="text-gray-500">
          请输入微信公众号文章链接
        </p>
      </div>

      {/* 模式选择 */}
      <div className="mb-6">
        <div className="flex gap-4 justify-center">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              mode === 'single'
                ? 'bg-wechat-green text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <div className="text-left">
              <div className="font-semibold">单篇分析</div>
              <div className="text-xs mt-1 opacity-90">深度分析一篇文章</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('batch')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              mode === 'batch'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <div className="text-left">
              <div className="font-semibold">批量分析</div>
              <div className="text-xs mt-1 opacity-90">分析整个公众号</div>
            </div>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            文章链接
          </label>
          <input
            type="text"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://mp.weixin.qq.com/s/..."
            className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
            disabled={isLoading}
          />
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        <button
          type="submit"
          className={`w-full py-3 text-lg font-medium rounded-lg transition-colors ${
            mode === 'single'
              ? 'bg-wechat-green hover:bg-green-600 text-white'
              : 'bg-purple-600 hover:bg-purple-700 text-white'
          } disabled:opacity-50`}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {mode === 'single' ? '正在抓取文章...' : '正在提取公众号信息...'}
            </span>
          ) : (
            mode === 'single' ? '开始分析' : '开始批量分析'
          )}
        </button>
      </form>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          {mode === 'single' ? '单篇分析说明' : '批量分析说明'}
        </h3>
        {mode === 'single' ? (
          <ul className="text-sm text-gray-500 space-y-1">
            <li>1. 在微信中打开公众号文章</li>
            <li>2. 点击右上角「...」选择「复制链接」</li>
            <li>3. 将链接粘贴到上方输入框</li>
            <li>4. 点击「开始分析」按钮</li>
          </ul>
        ) : (
          <ul className="text-sm text-gray-500 space-y-1">
            <li>1. 输入任意一篇该公众号的文章链接</li>
            <li>2. 系统会提取公众号信息并生成历史消息页面</li>
            <li>3. 在微信中打开历史消息页面获取Cookie</li>
            <li>4. 批量抓取公众号所有文章并导出Excel</li>
          </ul>
        )}
      </div>
    </div>
  )
}
