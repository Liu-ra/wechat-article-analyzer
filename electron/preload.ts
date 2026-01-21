import { contextBridge, ipcRenderer } from 'electron'

// 定义暴露给渲染进程的 API
const electronAPI = {
  // 抓取文章
  fetchArticle: (url: string) => ipcRenderer.invoke('fetch-article', url),

  // 分析文章
  analyzeArticle: (content: string, title?: string) => ipcRenderer.invoke('analyze-article', content, title),

  // 监听分析进度
  onAnalysisProgress: (callback: (data: { status: string; thinking?: string }) => void) => {
    const handler = (_event: unknown, data: { status: string; thinking?: string }) => callback(data)
    ipcRenderer.on('analysis-progress', handler)
    return () => {
      ipcRenderer.removeListener('analysis-progress', handler)
    }
  },

  // 下载文章
  downloadArticle: (data: { title: string; content: string; format: 'txt' | 'md' }) =>
    ipcRenderer.invoke('download-article', data),

  // 生成PDF（预览）
  generatePDF: (reportData: unknown) => ipcRenderer.invoke('generate-pdf', reportData),

  // 导出PDF
  exportPDF: (reportData: unknown) => ipcRenderer.invoke('export-pdf', reportData),

  // 获取日志
  getLogs: (limit?: number) => ipcRenderer.invoke('get-logs', limit),

  // 清除日志
  clearLogs: () => ipcRenderer.invoke('clear-logs'),

  // 打开日志文件
  openLogFile: () => ipcRenderer.invoke('open-log-file'),

  // 打开调试文件夹
  openDebugFolder: () => ipcRenderer.invoke('open-debug-folder'),

  // 获取 API 请求数据
  getApiRequests: () => ipcRenderer.invoke('get-api-requests'),

  // 使用 Cookie 获取文章数据
  fetchWithCookie: (url: string, cookieString: string) =>
    ipcRenderer.invoke('fetch-with-cookie', url, cookieString),

  // 剪贴板监听Cookie
  startClipboardMonitoring: () =>
    ipcRenderer.invoke('start-clipboard-monitoring'),

  stopClipboardMonitoring: () =>
    ipcRenderer.invoke('stop-clipboard-monitoring'),

  onClipboardCookieFound: (callback: (cookieString: string) => void) => {
    const handler = (_event: unknown, cookieString: string) => callback(cookieString)
    ipcRenderer.on('clipboard-cookie-found', handler)
    // 返回清理函数
    return () => {
      ipcRenderer.removeListener('clipboard-cookie-found', handler)
    }
  },

  onClipboardMonitoringTimeout: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('clipboard-monitoring-timeout', handler)
    // 返回清理函数
    return () => {
      ipcRenderer.removeListener('clipboard-monitoring-timeout', handler)
    }
  },

  // 代理服务器监听Cookie
  startProxyMonitoring: () =>
    ipcRenderer.invoke('start-proxy-monitoring'),

  stopProxyMonitoring: () =>
    ipcRenderer.invoke('stop-proxy-monitoring'),

  isProxyRunning: () =>
    ipcRenderer.invoke('is-proxy-running'),

  onProxyCookieFound: (callback: (cookieString: string) => void) => {
    const handler = (_event: unknown, cookieString: string) => callback(cookieString)
    ipcRenderer.on('proxy-cookie-found', handler)
    // 返回清理函数
    return () => {
      ipcRenderer.removeListener('proxy-cookie-found', handler)
    }
  },

  // 证书管理
  installCACertificate: () =>
    ipcRenderer.invoke('install-ca-certificate'),

  isCACertificateInstalled: () =>
    ipcRenderer.invoke('is-ca-certificate-installed'),

  uninstallCACertificate: () =>
    ipcRenderer.invoke('uninstall-ca-certificate'),

  // 一键自动监听Cookie
  autoStartCookieMonitoring: () =>
    ipcRenderer.invoke('auto-start-cookie-monitoring'),

  autoStopCookieMonitoring: () =>
    ipcRenderer.invoke('auto-stop-cookie-monitoring'),

  onAutoCookieFound: (callback: (cookieString: string) => void) => {
    const handler = (_event: unknown, cookieString: string) => callback(cookieString)
    ipcRenderer.on('auto-cookie-found', handler)
    // 返回清理函数
    return () => {
      ipcRenderer.removeListener('auto-cookie-found', handler)
    }
  },

  // 监听自动捕获的文章列表
  onAutoArticlesFound: (callback: (data: { articles: unknown[], nickname: string }) => void) => {
    const handler = (_event: unknown, data: { articles: unknown[], nickname: string }) => callback(data)
    ipcRenderer.on('auto-articles-found', handler)
    return () => {
      ipcRenderer.removeListener('auto-articles-found', handler)
    }
  },

  // 获取已捕获的文章列表
  getCapturedArticles: () =>
    ipcRenderer.invoke('get-captured-articles'),

  // 批量分析 - 提取公众号信息
  extractAccountInfo: (url: string) =>
    ipcRenderer.invoke('extract-account-info', url),

  // 批量分析 - 获取公众号基本信息
  fetchAccountInfo: (biz: string, cookieString: string) =>
    ipcRenderer.invoke('fetch-account-info', biz, cookieString),

  // 批量分析 - 获取文章列表
  fetchArticleList: (biz: string, cookieString: string, offset: number, count: number) =>
    ipcRenderer.invoke('fetch-article-list', biz, cookieString, offset, count),

  // 批量分析 - 批量获取所有文章
  fetchAllArticles: (biz: string, cookieString: string, maxCount: number) =>
    ipcRenderer.invoke('fetch-all-articles', biz, cookieString, maxCount),

  // 批量分析 - 导出Excel
  exportExcel: (articles: unknown[], accountName: string) =>
    ipcRenderer.invoke('export-excel', articles, accountName),

  // 批量下载文章内容
  downloadArticlesContent: (
    articles: unknown[],
    accountName: string,
    formats: ('html' | 'pdf' | 'word')[],
    cookieString?: string
  ) => ipcRenderer.invoke('download-articles-content', articles, accountName, formats, cookieString)
}

// 暴露到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 类型定义
export type ElectronAPI = typeof electronAPI
