import { contextBridge, ipcRenderer } from 'electron'

// 定义暴露给渲染进程的 API
const electronAPI = {
  // 抓取文章
  fetchArticle: (url: string) => ipcRenderer.invoke('fetch-article', url),

  // 分析文章
  analyzeArticle: (content: string) => ipcRenderer.invoke('analyze-article', content),

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
    ipcRenderer.invoke('export-excel', articles, accountName)
}

// 暴露到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 类型定义
export type ElectronAPI = typeof electronAPI
