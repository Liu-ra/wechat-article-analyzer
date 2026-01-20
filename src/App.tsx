import { useState, useCallback } from 'react'
import { AppState } from './types'
import UrlInput from './components/UrlInput'
import ArticlePreview from './components/ArticlePreview'
import AnalysisResultView from './components/AnalysisResult'
import LogViewer from './components/LogViewer'
import BatchAnalyzer from './components/BatchAnalyzer'

// 初始状态
const initialState: AppState = {
  url: '',
  fetchStatus: 'idle',
  article: null,
  stats: null,
  analysis: null,
  error: null
}

function App() {
  const [state, setState] = useState<AppState>(initialState)
  const [currentStep, setCurrentStep] = useState<number>(1)
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [batchUrl, setBatchUrl] = useState('')
  // 编辑后的文章内容
  const [editedTitle, setEditedTitle] = useState('')
  const [editedContent, setEditedContent] = useState('')

  // 处理URL提交
  const handleUrlSubmit = useCallback(async (url: string, mode: 'single' | 'batch' = 'single') => {
    if (mode === 'batch') {
      setBatchUrl(url)
      setIsBatchMode(true)
      return
    }

    setState(prev => ({ ...prev, url, fetchStatus: 'fetching', error: null }))

    try {
      // 调用主进程抓取文章
      const result = await window.electronAPI.fetchArticle(url)

      if (result.success && result.data) {
        setState(prev => ({
          ...prev,
          fetchStatus: 'success',
          article: result.data!.article,
          stats: null,
          error: null
        }))
        setCurrentStep(2)
      } else {
        setState(prev => ({
          ...prev,
          fetchStatus: 'error',
          error: result.error || '抓取文章失败'
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        fetchStatus: 'error',
        error: error instanceof Error ? error.message : '未知错误'
      }))
    }
  }, [])

  // 开始分析
  const handleAnalyze = useCallback(async () => {
    if (!state.article) return

    setState(prev => ({ ...prev, fetchStatus: 'fetching' }))

    try {
      const result = await window.electronAPI.analyzeArticle(state.article.content, state.article.title)

      if (result.success && result.data) {
        setState(prev => ({
          ...prev,
          fetchStatus: 'success',
          analysis: result.data!
        }))
        // 初始化编辑内容
        setEditedTitle(result.data!.newTitle)
        setEditedContent(result.data!.newContent)
        setCurrentStep(3)
      } else {
        setState(prev => ({
          ...prev,
          fetchStatus: 'error',
          error: result.error || '分析失败'
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        fetchStatus: 'error',
        error: error instanceof Error ? error.message : '分析失败'
      }))
    }
  }, [state.article])

  // 处理内容编辑
  const handleContentChange = useCallback((newTitle: string, newContent: string) => {
    setEditedTitle(newTitle)
    setEditedContent(newContent)
  }, [])

  // 进入下载步骤
  const handleGoToDownload = useCallback(() => {
    setCurrentStep(4)
  }, [])

  // 下载文章为TXT
  const handleDownloadTxt = useCallback(async () => {
    try {
      const result = await window.electronAPI.downloadArticle({
        title: editedTitle,
        content: editedContent,
        format: 'txt'
      })

      if (!result.success) {
        setState(prev => ({
          ...prev,
          error: result.error || '下载失败'
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '下载失败'
      }))
    }
  }, [editedTitle, editedContent])

  // 下载文章为Markdown
  const handleDownloadMarkdown = useCallback(async () => {
    try {
      const result = await window.electronAPI.downloadArticle({
        title: editedTitle,
        content: editedContent,
        format: 'md'
      })

      if (!result.success) {
        setState(prev => ({
          ...prev,
          error: result.error || '下载失败'
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '下载失败'
      }))
    }
  }, [editedTitle, editedContent])

  // 复制到剪贴板
  const handleCopyToClipboard = useCallback(async () => {
    try {
      const fullContent = `# ${editedTitle}\n\n${editedContent}`
      await navigator.clipboard.writeText(fullContent)
      // 可以添加成功提示
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: '复制失败，请手动复制'
      }))
    }
  }, [editedTitle, editedContent])

  // 重置
  const handleReset = useCallback(() => {
    setState(initialState)
    setCurrentStep(1)
    setEditedTitle('')
    setEditedContent('')
  }, [])

  // 退出批量模式
  const handleExitBatchMode = useCallback(() => {
    setIsBatchMode(false)
    setBatchUrl('')
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800">
              微信公众号文章分析工具
            </h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsLogViewerOpen(true)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                title="查看系统日志"
              >
                查看日志
              </button>
              <span className="text-sm text-gray-500">V2.0.0</span>
            </div>
          </div>
        </div>
      </header>

      {/* 步骤指示器 */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-center space-x-4">
          {[
            { step: 1, label: '输入链接' },
            { step: 2, label: '文章预览' },
            { step: 3, label: '分析优化' },
            { step: 4, label: '下载文章' }
          ].map((item, index) => (
            <div key={item.step} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${currentStep >= item.step
                  ? 'bg-wechat-green text-white'
                  : 'bg-gray-200 text-gray-500'}
              `}>
                {item.step}
              </div>
              <span className={`ml-2 text-sm ${currentStep >= item.step ? 'text-gray-800' : 'text-gray-400'}`}>
                {item.label}
              </span>
              {index < 3 && (
                <div className={`w-16 h-0.5 mx-4 ${currentStep > item.step ? 'bg-wechat-green' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* 批量分析模式 */}
        {isBatchMode && batchUrl && (
          <BatchAnalyzer url={batchUrl} onBack={handleExitBatchMode} />
        )}

        {/* 单篇分析模式 */}
        {!isBatchMode && (
          <>
            {/* 错误提示 */}
            {state.error && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
                <div className="flex items-start">
                  <span className="flex-1">{state.error}</span>
                  <button
                    onClick={() => setState(prev => ({ ...prev, error: null }))}
                    className="ml-4 text-sm underline flex-shrink-0"
                  >
                    关闭
                  </button>
                </div>
              </div>
            )}

            {/* 步骤1: URL输入 */}
            {currentStep === 1 && (
              <UrlInput
                onSubmit={handleUrlSubmit}
                isLoading={state.fetchStatus === 'fetching'}
              />
            )}

            {/* 步骤2: 文章预览 */}
            {currentStep === 2 && state.article && (
              <div className="space-y-6">
                <ArticlePreview article={state.article} />
                <div className="flex justify-between">
                  <button onClick={handleReset} className="btn-secondary">
                    重新开始
                  </button>
                  <button
                    onClick={handleAnalyze}
                    className="btn-primary"
                    disabled={state.fetchStatus === 'fetching'}
                  >
                    {state.fetchStatus === 'fetching' ? '分析中...' : '开始分析'}
                  </button>
                </div>
              </div>
            )}

            {/* 步骤3: 分析结果 */}
            {currentStep === 3 && state.analysis && (
              <div className="space-y-6">
                <AnalysisResultView
                  analysis={state.analysis}
                  onContentChange={handleContentChange}
                />
                <div className="flex justify-between">
                  <button onClick={() => setCurrentStep(2)} className="btn-secondary">
                    返回上一步
                  </button>
                  <button onClick={handleGoToDownload} className="btn-primary">
                    下载文章
                  </button>
                </div>
              </div>
            )}

            {/* 步骤4: 下载文章 */}
            {currentStep === 4 && (
              <div className="space-y-6">
                {/* 文章预览卡片 */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">文章预览</h2>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">{editedTitle}</h3>
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                      {editedContent}
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between text-sm text-gray-500">
                    <span>字数：{editedContent.length}</span>
                    <span>段落：{editedContent.split('\n\n').filter(p => p.trim()).length}</span>
                  </div>
                </div>

                {/* 下载选项 */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">下载选项</h2>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      onClick={handleDownloadTxt}
                      className="flex flex-col items-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <span className="text-2xl mb-2">📄</span>
                      <span className="font-medium text-blue-700">TXT 格式</span>
                      <span className="text-xs text-blue-600 mt-1">纯文本文件</span>
                    </button>
                    <button
                      onClick={handleDownloadMarkdown}
                      className="flex flex-col items-center p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <span className="text-2xl mb-2">📝</span>
                      <span className="font-medium text-purple-700">Markdown</span>
                      <span className="text-xs text-purple-600 mt-1">支持格式化</span>
                    </button>
                    <button
                      onClick={handleCopyToClipboard}
                      className="flex flex-col items-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <span className="text-2xl mb-2">📋</span>
                      <span className="font-medium text-green-700">复制内容</span>
                      <span className="text-xs text-green-600 mt-1">复制到剪贴板</span>
                    </button>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex justify-between">
                  <button onClick={() => setCurrentStep(3)} className="btn-secondary">
                    返回编辑
                  </button>
                  <button onClick={handleReset} className="btn-primary">
                    分析新文章
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* 日志查看器 */}
      <LogViewer
        isOpen={isLogViewerOpen}
        onClose={() => setIsLogViewerOpen(false)}
      />
    </div>
  )
}

export default App
