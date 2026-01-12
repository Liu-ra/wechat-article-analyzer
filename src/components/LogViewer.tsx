import { useState, useEffect } from 'react'
import { LogEntry } from '../types'

interface LogViewerProps {
  isOpen: boolean
  onClose: () => void
}

export default function LogViewer({ isOpen, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info' | 'debug'>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const loadLogs = async () => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI.getLogs(500)
      if (result.success && result.data) {
        setLogs(result.data)
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearLogs = async () => {
    if (!confirm('确定要清除所有日志吗？')) return

    try {
      const result = await window.electronAPI.clearLogs()
      if (result.success) {
        setLogs([])
      }
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  const handleOpenLogFile = async () => {
    try {
      await window.electronAPI.openLogFile()
    } catch (error) {
      console.error('Failed to open log file:', error)
    }
  }

  const handleOpenDebugFolder = async () => {
    try {
      await window.electronAPI.openDebugFolder()
    } catch (error) {
      console.error('Failed to open debug folder:', error)
    }
  }

  const handleViewApiRequests = async () => {
    try {
      const result = await window.electronAPI.getApiRequests()
      if (result.success && result.data) {
        // 在新窗口显示 JSON 数据
        const win = window.open('', '_blank')
        if (win) {
          win.document.write('<html><head><title>API 请求数据</title></head><body>')
          win.document.write('<pre style="padding: 20px; font-family: monospace; white-space: pre-wrap; word-wrap: break-word;">')
          win.document.write(JSON.stringify(result.data, null, 2))
          win.document.write('</pre></body></html>')
        }
      } else {
        alert(result.error || '暂无 API 请求数据')
      }
    } catch (error) {
      console.error('Failed to get API requests:', error)
      alert('获取 API 数据失败')
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadLogs()
    }
  }, [isOpen])

  useEffect(() => {
    if (autoRefresh && isOpen) {
      const interval = setInterval(loadLogs, 2000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, isOpen])

  if (!isOpen) return null

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.level === filter)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">系统日志</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2">
            {/* 过滤器 */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-wechat-green"
            >
              <option value="all">全部</option>
              <option value="error">错误</option>
              <option value="warn">警告</option>
              <option value="info">信息</option>
              <option value="debug">调试</option>
            </select>

            {/* 自动刷新 */}
            <label className="flex items-center space-x-1 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span>自动刷新</span>
            </label>

            <span className="text-sm text-gray-500">
              共 {filteredLogs.length} 条日志
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {isLoading ? '加载中...' : '刷新'}
            </button>
            <button
              onClick={handleViewApiRequests}
              className="px-3 py-1.5 text-sm bg-purple-50 text-purple-600 border border-purple-200 rounded hover:bg-purple-100"
              title="查看拦截到的 API 请求数据"
            >
              API 请求
            </button>
            <button
              onClick={handleOpenDebugFolder}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100"
              title="打开包含截图和HTML的调试文件夹"
            >
              调试文件夹
            </button>
            <button
              onClick={handleOpenLogFile}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              打开日志文件
            </button>
            <button
              onClick={handleClearLogs}
              className="px-3 py-1.5 text-sm bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100"
            >
              清除日志
            </button>
          </div>
        </div>

        {/* 日志列表 */}
        <div className="flex-1 overflow-auto p-4 bg-gray-900 font-mono text-sm">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              暂无日志
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className="flex space-x-2 text-gray-300 hover:bg-gray-800 p-1 rounded"
                >
                  <span className="text-gray-500 flex-shrink-0 w-48">
                    {new Date(log.timestamp).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    })}
                  </span>
                  <span
                    className={`flex-shrink-0 w-16 text-center ${
                      log.level === 'error'
                        ? 'text-red-400'
                        : log.level === 'warn'
                        ? 'text-yellow-400'
                        : log.level === 'info'
                        ? 'text-blue-400'
                        : 'text-gray-400'
                    }`}
                  >
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="flex-1 text-white">{log.message}</span>
                  {log.data && (
                    <span className="text-gray-500 text-xs">
                      {typeof log.data === 'string'
                        ? log.data
                        : JSON.stringify(log.data)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
