// 使用 require 避免打包问题
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake')
import { logger } from './logger'

interface TDocumentDefinitions {
  content: Content[]
  styles: Record<string, unknown>
  defaultStyle: Record<string, unknown>
  pageSize: string
  pageMargins: number[]
  info: Record<string, string>
}

type Content = string | Record<string, unknown>

interface ArticleData {
  url: string
  title: string
  author: string
  publishTime: string
  content: string
  wordCount: number
  imageCount: number
}

interface ArticleStats {
  readCount: number | null
  likeCount: number | null
  wowCount: number | null
  shareCount: number | null
  favoriteCount: number | null
  commentCount: number | null
  isManualInput: boolean
}

interface KeywordItem {
  word: string
  weight: number
}

interface SentimentResult {
  score: number
  label: 'positive' | 'negative' | 'neutral'
  positiveWords: string[]
  negativeWords: string[]
}

interface AnalysisResult {
  keywords: KeywordItem[]
  summary: string
  sentiment: SentimentResult
}

interface ReportData {
  article: ArticleData
  stats: ArticleStats
  analysis: AnalysisResult
  generatedAt: string
}

// 字体配置（使用系统字体或内置字体）
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
}

const printer = new PdfPrinter(fonts)

function formatNumber(num: number | null): string {
  if (num === null) return '-'
  return num.toLocaleString()
}

function getSentimentLabel(label: string): string {
  switch (label) {
    case 'positive': return 'Positive (Zhengmian)'
    case 'negative': return 'Negative (Fumian)'
    default: return 'Neutral (Zhongxing)'
  }
}

export async function generatePDF(reportData: ReportData, returnBuffer = false): Promise<Buffer | null> {
  logger.info('开始生成 PDF', { title: reportData.article.title, returnBuffer })

  try {
    const { article, stats, analysis, generatedAt } = reportData

  const styles: Record<string, unknown> = {
    header: {
      fontSize: 20,
      bold: true,
      alignment: 'center',
      margin: [0, 0, 0, 10]
    },
    subheader: {
      fontSize: 14,
      bold: true,
      margin: [0, 20, 0, 10]
    },
    tableHeader: {
      bold: true,
      fillColor: '#f3f4f6'
    },
    sectionTitle: {
      fontSize: 12,
      bold: true,
      margin: [0, 15, 0, 8]
    },
    normal: {
      fontSize: 10,
      margin: [0, 2, 0, 2]
    },
    small: {
      fontSize: 9,
      color: '#666666'
    },
    keyword: {
      fontSize: 10,
      color: '#1d4ed8'
    },
    positive: {
      fontSize: 9,
      color: '#16a34a'
    },
    negative: {
      fontSize: 9,
      color: '#dc2626'
    }
  }

  const content: Content[] = [
    // 标题
    {
      text: 'WeChat Article Analysis Report',
      style: 'header'
    },
    {
      text: `Generated: ${new Date(generatedAt).toLocaleString('zh-CN')}`,
      style: 'small',
      alignment: 'center',
      margin: [0, 0, 0, 20]
    },

    // 一、文章基本信息
    {
      text: '1. Basic Information',
      style: 'subheader'
    },
    {
      table: {
        widths: [80, '*'],
        body: [
          [{ text: 'Title', style: 'tableHeader' }, article.title || 'N/A'],
          [{ text: 'Author', style: 'tableHeader' }, article.author || 'Unknown'],
          [{ text: 'Publish Time', style: 'tableHeader' }, article.publishTime || 'Unknown'],
          [{ text: 'Word Count', style: 'tableHeader' }, `${article.wordCount} characters`],
          [{ text: 'Image Count', style: 'tableHeader' }, `${article.imageCount} images`]
        ]
      },
      layout: 'lightHorizontalLines'
    },

    // 二、数据统计
    {
      text: '2. Statistics',
      style: 'subheader'
    },
    {
      table: {
        widths: ['*', '*', '*'],
        body: [
          [
            { text: 'Read Count', style: 'tableHeader', alignment: 'center' },
            { text: 'Like Count', style: 'tableHeader', alignment: 'center' },
            { text: 'Wow Count', style: 'tableHeader', alignment: 'center' }
          ],
          [
            { text: formatNumber(stats.readCount), alignment: 'center' },
            { text: formatNumber(stats.likeCount), alignment: 'center' },
            { text: formatNumber(stats.wowCount), alignment: 'center' }
          ]
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 5]
    },
    {
      table: {
        widths: ['*', '*', '*'],
        body: [
          [
            { text: 'Share Count', style: 'tableHeader', alignment: 'center' },
            { text: 'Favorite Count', style: 'tableHeader', alignment: 'center' },
            { text: 'Comment Count', style: 'tableHeader', alignment: 'center' }
          ],
          [
            { text: formatNumber(stats.shareCount), alignment: 'center' },
            { text: formatNumber(stats.favoriteCount), alignment: 'center' },
            { text: formatNumber(stats.commentCount), alignment: 'center' }
          ]
        ]
      },
      layout: 'lightHorizontalLines'
    },
    stats.isManualInput ? {
      text: '* Data manually entered',
      style: 'small',
      margin: [0, 5, 0, 0]
    } : '',

    // 三、关键词分析
    {
      text: '3. Keywords Analysis',
      style: 'subheader'
    },
    {
      text: analysis.keywords.map(k =>
        `${k.word} (${(k.weight * 100).toFixed(0)})`
      ).join('  |  '),
      style: 'keyword',
      margin: [0, 0, 0, 10]
    },

    // 四、内容摘要
    {
      text: '4. Content Summary',
      style: 'subheader'
    },
    {
      text: analysis.summary,
      style: 'normal',
      margin: [0, 0, 0, 10]
    },

    // 五、情感分析
    {
      text: '5. Sentiment Analysis',
      style: 'subheader'
    },
    {
      table: {
        widths: [100, '*'],
        body: [
          [
            { text: 'Sentiment', style: 'tableHeader' },
            getSentimentLabel(analysis.sentiment.label)
          ],
          [
            { text: 'Score', style: 'tableHeader' },
            `${(analysis.sentiment.score * 100).toFixed(0)} / 100`
          ]
        ]
      },
      layout: 'lightHorizontalLines'
    },
    analysis.sentiment.positiveWords.length > 0 ? {
      text: `Positive words: ${analysis.sentiment.positiveWords.slice(0, 10).join(', ')}`,
      style: 'positive',
      margin: [0, 10, 0, 0]
    } : '',
    analysis.sentiment.negativeWords.length > 0 ? {
      text: `Negative words: ${analysis.sentiment.negativeWords.slice(0, 10).join(', ')}`,
      style: 'negative',
      margin: [0, 5, 0, 0]
    } : '',

    // 页脚
    {
      text: '\n\nGenerated by WeChat Article Analyzer V1.0',
      style: 'small',
      alignment: 'center',
      margin: [0, 30, 0, 0]
    }
  ]

  const docDefinition: TDocumentDefinitions = {
    content,
    styles,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10
    },
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    info: {
      title: `Article Analysis - ${article.title}`,
      author: 'WeChat Article Analyzer',
      subject: 'Article Analysis Report'
    }
  }

    return new Promise((resolve, reject) => {
      try {
        logger.debug('创建 PDF 文档')
        const pdfDoc = printer.createPdfKitDocument(docDefinition)

        if (returnBuffer) {
          const chunks: Buffer[] = []
          pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk))
          pdfDoc.on('end', () => {
            logger.info('PDF 生成成功（Buffer）', { size: Buffer.concat(chunks).length })
            resolve(Buffer.concat(chunks))
          })
          pdfDoc.on('error', (error) => {
            logger.error('PDF 生成失败', { error: error.message })
            reject(error)
          })
          pdfDoc.end()
        } else {
          pdfDoc.end()
          logger.info('PDF 生成成功（预览）')
          resolve(null)
        }
      } catch (error) {
        logger.error('PDF 生成失败', { error: error instanceof Error ? error.message : error })
        reject(error)
      }
    })
  } catch (error) {
    logger.error('PDF 生成失败', { error: error instanceof Error ? error.message : error })
    throw error
  }
}
