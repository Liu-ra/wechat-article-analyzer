import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { scrapeArticle } from './services/scraper'
import { analyzeContent } from './services/analyzer'
import { generatePDF } from './services/pdfGenerator'
import { logger } from './services/logger'
import { parseCookies, fetchArticleStats, validateCookies } from './services/wechatApi'
import {
  extractBizFromUrl,
  generateProfileUrl,
  fetchAccountInfo,
  fetchAllArticles,
  fetchArticleList,
  ArticleFullData
} from './services/batchAnalyzer'
import { exportToExcel, saveExcelFile } from './services/excelExporter'
import { autoGetCookie } from './services/cookieHelper'

// 开发模式判断
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    show: false
  })

  // 加载应用
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 应用启动
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC 处理器

// 抓取文章
ipcMain.handle('fetch-article', async (_event, url: string) => {
  try {
    const result = await scrapeArticle(url)
    return { success: true, data: result }
  } catch (error) {
    console.error('抓取文章失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '抓取文章失败'
    }
  }
})

// 分析文章
ipcMain.handle('analyze-article', async (_event, content: string) => {
  try {
    const result = await analyzeContent(content)
    return { success: true, data: result }
  } catch (error) {
    console.error('分析文章失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '分析文章失败'
    }
  }
})

// 生成 PDF
ipcMain.handle('generate-pdf', async (_event, reportData) => {
  try {
    await generatePDF(reportData)
    return { success: true }
  } catch (error) {
    console.error('生成PDF失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '生成PDF失败'
    }
  }
})

// 导出 PDF
ipcMain.handle('export-pdf', async (_event, reportData) => {
  try {
    // 弹出保存对话框
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出PDF报告',
      defaultPath: `文章分析报告_${Date.now()}.pdf`,
      filters: [{ name: 'PDF文件', extensions: ['pdf'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: '取消导出' }
    }

    const pdfBuffer = await generatePDF(reportData, true)

    if (pdfBuffer) {
      fs.writeFileSync(result.filePath, pdfBuffer)
      return { success: true, path: result.filePath }
    }

    return { success: false, error: '生成PDF失败' }
  } catch (error) {
    console.error('导出PDF失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出PDF失败'
    }
  }
})

// 获取日志
ipcMain.handle('get-logs', async (_event, limit?: number) => {
  try {
    const logs = logger.getLogs(limit)
    return { success: true, data: logs }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取日志失败'
    }
  }
})

// 清除日志
ipcMain.handle('clear-logs', async () => {
  try {
    logger.clearLogs()
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '清除日志失败'
    }
  }
})

// 打开日志文件
ipcMain.handle('open-log-file', async () => {
  try {
    const logPath = logger.getLogFilePath()
    await shell.openPath(logPath)
    return { success: true, path: logPath }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '打开日志文件失败'
    }
  }
})

// 打开调试文件夹
ipcMain.handle('open-debug-folder', async () => {
  try {
    const userDataPath = app.getPath('userData')
    await shell.openPath(userDataPath)
    return { success: true, path: userDataPath }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '打开调试文件夹失败'
    }
  }
})

// 查看 API 请求数据
ipcMain.handle('get-api-requests', async () => {
  try {
    const userDataPath = app.getPath('userData')
    const apiDataPath = path.join(userDataPath, 'captured-api-requests.json')

    if (fs.existsSync(apiDataPath)) {
      const content = fs.readFileSync(apiDataPath, 'utf-8')
      const data = JSON.parse(content)
      return { success: true, data }
    } else {
      return { success: false, error: '暂无 API 请求数据' }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '读取 API 数据失败'
    }
  }
})

// 使用 Cookie 获取文章数据
ipcMain.handle('fetch-with-cookie', async (_event, url: string, cookieString: string) => {
  try {
    logger.info('开始使用 Cookie 获取文章数据', { url: url.substring(0, 100) })

    // 解析 Cookie
    const cookies = parseCookies(cookieString)

    // 验证 Cookie
    const isValid = await validateCookies(cookies)
    if (!isValid) {
      return {
        success: false,
        error: 'Cookie 无效或缺少必需字段（key 或 appmsg_token）'
      }
    }

    // 获取数据
    const stats = await fetchArticleStats(url, cookies)

    logger.info('Cookie 方式获取数据成功', stats)

    return {
      success: true,
      data: {
        stats: {
          readCount: stats.readCount,
          likeCount: stats.likeCount,
          wowCount: stats.wowCount,
          shareCount: null,
          favoriteCount: null,
          commentCount: stats.commentCount,
          isManualInput: false
        }
      }
    }
  } catch (error) {
    logger.error('Cookie 方式获取数据失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取数据失败'
    }
  }
})

// 自动获取 Cookie
ipcMain.handle('auto-get-cookie', async (_event, profileUrl: string) => {
  try {
    logger.info('开始自动获取 Cookie', { url: profileUrl.substring(0, 100) })

    const cookieString = await autoGetCookie(profileUrl)

    if (!cookieString) {
      return {
        success: false,
        error: '获取 Cookie 失败，可能是超时或窗口被关闭'
      }
    }

    logger.info('自动获取 Cookie 成功')

    return {
      success: true,
      data: {
        cookieString
      }
    }
  } catch (error) {
    logger.error('自动获取 Cookie 失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '自动获取 Cookie 失败'
    }
  }
})

// 批量分析 - 提取公众号信息
ipcMain.handle('extract-account-info', async (_event, url: string) => {
  try {
    logger.info('开始提取公众号信息', { url: url.substring(0, 100) })

    const biz = await extractBizFromUrl(url)
    if (!biz) {
      return {
        success: false,
        error: '无法从URL中提取公众号信息，请确保链接是有效的微信公众号文章链接'
      }
    }

    const profileUrl = generateProfileUrl(biz)

    return {
      success: true,
      data: {
        biz,
        profileUrl
      }
    }
  } catch (error) {
    logger.error('提取公众号信息失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '提取失败'
    }
  }
})

// 批量分析 - 获取公众号基本信息
ipcMain.handle('fetch-account-info', async (_event, biz: string, cookieString: string) => {
  try {
    const cookies = parseCookies(cookieString)
    const isValid = await validateCookies(cookies)

    if (!isValid) {
      return {
        success: false,
        error: 'Cookie 无效或缺少必需字段'
      }
    }

    const accountInfo = await fetchAccountInfo(biz, cookies)

    if (!accountInfo) {
      return {
        success: false,
        error: '获取公众号信息失败'
      }
    }

    return {
      success: true,
      data: accountInfo
    }
  } catch (error) {
    logger.error('获取公众号信息失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取失败'
    }
  }
})

// 批量分析 - 获取文章列表
ipcMain.handle('fetch-article-list', async (_event, biz: string, cookieString: string, offset: number, count: number) => {
  try {
    const cookies = parseCookies(cookieString)
    const result = await fetchArticleList(biz, cookies, offset, count)

    return {
      success: true,
      data: result
    }
  } catch (error) {
    logger.error('获取文章列表失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取失败'
    }
  }
})

// 批量分析 - 批量获取所有文章
ipcMain.handle('fetch-all-articles', async (_event, biz: string, cookieString: string, maxCount: number) => {
  try {
    const cookies = parseCookies(cookieString)
    const articles = await fetchAllArticles(biz, cookies, maxCount)

    return {
      success: true,
      data: articles
    }
  } catch (error) {
    logger.error('批量获取文章失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取失败',
      data: [] // 返回空数组以便前端处理
    }
  }
})

// 批量分析 - 导出Excel
ipcMain.handle('export-excel', async (_event, articles: ArticleFullData[], accountName: string) => {
  try {
    const tempFilePath = await exportToExcel(articles, accountName)

    // 生成默认文件名
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
    const defaultFileName = `${accountName}_文章数据_${timestamp}.xlsx`

    // 弹出保存对话框
    const savedPath = await saveExcelFile(tempFilePath, defaultFileName)

    if (!savedPath) {
      return {
        success: false,
        error: '取消保存'
      }
    }

    return {
      success: true,
      path: savedPath
    }
  } catch (error) {
    logger.error('导出Excel失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出失败'
    }
  }
})
