import { useState, useCallback } from 'react'
import { AppState, ArticleStats } from './types'
import UrlInput from './components/UrlInput'
import ArticlePreview from './components/ArticlePreview'
import StatsInput from './components/StatsInput'
import AnalysisResultView from './components/AnalysisResult'
import ReportPreview from './components/ReportPreview'
import LogViewer from './components/LogViewer'
import CookieInput from './components/CookieInput'
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
  const [isCookieInputOpen, setIsCookieInputOpen] = useState(false)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [batchUrl, setBatchUrl] = useState('')

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
        // 检查是否真正获取到了数据
        const stats = result.data.stats
        const hasAnyData = stats && (
          stats.readCount !== null ||
          stats.likeCount !== null ||
          stats.wowCount !== null ||
          stats.shareCount !== null ||
          stats.favoriteCount !== null ||
          stats.commentCount !== null
        )

        setState(prev => ({
          ...prev,
          fetchStatus: 'success',
          article: result.data!.article,
          stats: result.data!.stats,
          // 如果没有获取到任何数据，设置一个警告信息
          error: !hasAnyData ? '文章抓取成功，但未获取到互动数据。您可以手动输入或使用 Cookie 方式获取。' : null
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

  // 更新统计数据
  const handleStatsUpdate = useCallback((stats: ArticleStats) => {
    setState(prev => ({ ...prev, stats }))
  }, [])

  // 使用 Cookie 获取数据成功
  const handleCookieSuccess = useCallback((stats: ArticleStats) => {
    setState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        ...stats,
        isManualInput: false
      }
    }))
    setIsCookieInputOpen(false)
  }, [])

  // 开始分析
  const handleAnalyze = useCallback(async () => {
    if (!state.article) return

    setState(prev => ({ ...prev, fetchStatus: 'fetching' }))

    try {
      const result = await window.electronAPI.analyzeArticle(state.article.content)

      if (result.success && result.data) {
        setState(prev => ({
          ...prev,
          fetchStatus: 'success',
          analysis: result.data!
        }))
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

  // 生成报告
  const handleGenerateReport = useCallback(async () => {
    if (!state.article || !state.stats || !state.analysis) return

    try {
      const reportData = {
        article: state.article,
        stats: state.stats,
        analysis: state.analysis,
        generatedAt: new Date().toISOString()
      }

      const result = await window.electronAPI.generatePDF(reportData)

      if (result.success) {
        setCurrentStep(4)
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || '生成报告失败'
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '生成报告失败'
      }))
    }
  }, [state.article, state.stats, state.analysis])

  // 导出PDF
  const handleExportPDF = useCallback(async () => {
    if (!state.article || !state.stats || !state.analysis) return

    const reportData = {
      article: state.article,
      stats: state.stats,
      analysis: state.analysis,
      generatedAt: new Date().toISOString()
    }

    const result = await window.electronAPI.exportPDF(reportData)

    if (!result.success) {
      setState(prev => ({
        ...prev,
        error: result.error || '导出失败'
      }))
    }
  }, [state.article, state.stats, state.analysis])

  // 重置
  const handleReset = useCallback(() => {
    setState(initialState)
    setCurrentStep(1)
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
              <span className="text-sm text-gray-500">V1.0</span>
            </div>
          </div>
        </div>
      </header>

      {/* 步骤指示器 */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-center space-x-4">
          {[
            { step: 1, label: '输入链接' },
            { step: 2, label: '数据确认' },
            { step: 3, label: '分析结果' },
            { step: 4, label: '导出报告' }
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
            {/* 错误/警告提示 */}
            {state.error && (
          <div className={`mb-6 p-4 rounded-lg ${
            state.error.includes('未获取到互动数据')
              ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
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

        {/* 步骤2: 文章预览和数据确认 */}
        {currentStep === 2 && state.article && (
          <div className="space-y-6">
            <ArticlePreview article={state.article} />

            {/* Cookie 获取提示 */}
            {(!state.stats ||
              (state.stats.readCount === null &&
               state.stats.likeCount === null &&
               state.stats.wowCount === null &&
               state.stats.shareCount === null &&
               state.stats.favoriteCount === null &&
               state.stats.commentCount === null)) && (
              <div className="p-5 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg shadow-sm">
                <div className="flex items-start">
                  <div className="flex-shrink-0 text-2xl mr-3">⚠️</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-900 mb-2 text-lg">未获取到互动数据</h3>
                    <p className="text-sm text-yellow-800 mb-3">
                      由于微信的反爬虫机制，自动抓取可能无法获取文章的阅读量、点赞数等互动数据。
                      您可以选择以下方式：
                    </p>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setIsCookieInputOpen(true)}
                        className="px-5 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium shadow-sm hover:shadow"
                      >
                        🔑 使用 Cookie 获取数据
                      </button>
                      <span className="text-xs text-yellow-700">或在下方手动输入数据</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <StatsInput
              stats={state.stats}
              onUpdate={handleStatsUpdate}
            />
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
            <AnalysisResultView analysis={state.analysis} />
            <div className="flex justify-between">
              <button onClick={() => setCurrentStep(2)} className="btn-secondary">
                返回上一步
              </button>
              <button onClick={handleGenerateReport} className="btn-primary">
                生成报告
              </button>
            </div>
          </div>
        )}

        {/* 步骤4: 报告预览 */}
        {currentStep === 4 && state.article && state.stats && state.analysis && (
          <div className="space-y-6">
            <ReportPreview
              article={state.article}
              stats={state.stats}
              analysis={state.analysis}
            />
            <div className="flex justify-between">
              <button onClick={() => setCurrentStep(3)} className="btn-secondary">
                返回上一步
              </button>
              <div className="space-x-4">
                <button onClick={handleReset} className="btn-secondary">
                  分析新文章
                </button>
                <button onClick={handleExportPDF} className="btn-primary">
                  导出 PDF
                </button>
              </div>
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

      {/* Cookie 输入对话框 */}
      {isCookieInputOpen && state.url && (
        <CookieInput
          url={state.url}
          onSuccess={handleCookieSuccess}
          onCancel={() => setIsCookieInputOpen(false)}
        />
      )}
    </div>
  )
}

export default App
