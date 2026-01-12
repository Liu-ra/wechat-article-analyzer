// 文章数据结构
export interface ArticleData {
  url: string
  title: string
  author: string
  publishTime: string
  content: string
  htmlContent: string
  images: string[]
  wordCount: number
  imageCount: number
}

// 统计数据
export interface ArticleStats {
  readCount: number | null
  likeCount: number | null
  wowCount: number | null  // 在看数
  shareCount: number | null  // 转发数
  favoriteCount: number | null  // 收藏数
  commentCount: number | null
  isManualInput: boolean
}

// NLP 分析结果
export interface AnalysisResult {
  keywords: KeywordItem[]
  summary: string
  sentiment: SentimentResult
}

// 关键词项
export interface KeywordItem {
  word: string
  weight: number
}

// 情感分析结果
export interface SentimentResult {
  score: number  // -1 到 1，负面到正面
  label: 'positive' | 'negative' | 'neutral'
  positiveWords: string[]
  negativeWords: string[]
}

// 完整报告数据
export interface ReportData {
  article: ArticleData
  stats: ArticleStats
  analysis: AnalysisResult
  generatedAt: string
}

// 抓取状态
export type FetchStatus = 'idle' | 'fetching' | 'success' | 'error'

// 应用状态
export interface AppState {
  url: string
  fetchStatus: FetchStatus
  article: ArticleData | null
  stats: ArticleStats | null
  analysis: AnalysisResult | null
  error: string | null
}

// 日志级别
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

// 日志条目
export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: any
}
