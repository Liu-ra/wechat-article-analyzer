/// <reference types="vite/client" />

interface ElectronAPI {
  fetchArticle: (url: string) => Promise<{
    success: boolean
    data?: {
      article: import('./types').ArticleData
      stats: import('./types').ArticleStats
    }
    error?: string
  }>

  analyzeArticle: (content: string) => Promise<{
    success: boolean
    data?: import('./types').AnalysisResult
    error?: string
  }>

  generatePDF: (reportData: import('./types').ReportData) => Promise<{
    success: boolean
    error?: string
  }>

  exportPDF: (reportData: import('./types').ReportData) => Promise<{
    success: boolean
    path?: string
    error?: string
  }>

  getLogs: (limit?: number) => Promise<{
    success: boolean
    data?: import('./types').LogEntry[]
    error?: string
  }>

  clearLogs: () => Promise<{
    success: boolean
    error?: string
  }>

  openLogFile: () => Promise<{
    success: boolean
    path?: string
    error?: string
  }>

  openDebugFolder: () => Promise<{
    success: boolean
    path?: string
    error?: string
  }>

  getApiRequests: () => Promise<{
    success: boolean
    data?: any[]
    error?: string
  }>

  fetchWithCookie: (url: string, cookieString: string) => Promise<{
    success: boolean
    data?: {
      stats: import('./types').ArticleStats
    }
    error?: string
  }>

  autoGetCookie: (profileUrl: string) => Promise<{
    success: boolean
    data?: {
      cookieString: string
    }
    error?: string
  }>

  extractAccountInfo: (url: string) => Promise<{
    success: boolean
    data?: {
      biz: string
      profileUrl: string
    }
    error?: string
  }>

  fetchAccountInfo: (biz: string, cookieString: string) => Promise<{
    success: boolean
    data?: {
      biz: string
      nickname: string
      avatar: string
      signature: string
    }
    error?: string
  }>

  fetchArticleList: (biz: string, cookieString: string, offset: number, count: number) => Promise<{
    success: boolean
    data?: {
      list: Array<{
        title: string
        url: string
        cover: string
        digest: string
        publishTime: number
        author: string
        aid: string
        appmsgid: string
        itemidx: string
      }>
      canLoadMore: boolean
    }
    error?: string
  }>

  fetchAllArticles: (biz: string, cookieString: string, maxCount: number) => Promise<{
    success: boolean
    data?: Array<{
      title: string
      url: string
      cover: string
      digest: string
      publishTime: number
      author: string
      aid: string
      appmsgid: string
      itemidx: string
    }>
    error?: string
  }>

  exportExcel: (articles: any[], accountName: string) => Promise<{
    success: boolean
    path?: string
    error?: string
  }>
}

interface Window {
  electronAPI: ElectronAPI
}
