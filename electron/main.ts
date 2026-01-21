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
import { downloadArticlesContent, DownloadFormat } from './services/contentDownloader'
import { startClipboardMonitoring } from './services/cookieHelper'
import { startProxyServer, stopProxyServer, isProxyRunning, getCACertPath } from './services/proxyServer'
import {
  installCACertificateToSystem,
  uninstallCACertificateFromSystem,
  isCACertificateInstalled
} from './services/certificateManager'
import { enableSystemProxy, disableSystemProxy, getProxyStatus } from './services/systemProxy'

// 开发模式判断
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null

// 全局保存的 Cookie（用于自动获取统计数据）
let savedCookieString: string | null = null

// 保存 Cookie 到文件（持久化）
function saveCookieToFile(cookieString: string) {
  try {
    const userDataPath = app.getPath('userData')
    const cookiePath = path.join(userDataPath, 'saved-cookie.txt')
    fs.writeFileSync(cookiePath, cookieString, 'utf-8')
    savedCookieString = cookieString
    logger.info('Cookie 已保存', { path: cookiePath })
  } catch (error) {
    logger.error('保存 Cookie 失败', { error })
  }
}

// 从文件加载 Cookie
function loadCookieFromFile(): string | null {
  try {
    const userDataPath = app.getPath('userData')
    const cookiePath = path.join(userDataPath, 'saved-cookie.txt')
    if (fs.existsSync(cookiePath)) {
      const cookie = fs.readFileSync(cookiePath, 'utf-8')
      if (cookie && cookie.trim()) {
        savedCookieString = cookie
        logger.info('已加载保存的 Cookie')
        return cookie
      }
    }
  } catch (error) {
    logger.debug('加载 Cookie 失败', { error })
  }
  return null
}

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
  // 加载保存的 Cookie
  loadCookieFromFile()

  // 设置 CSP 允许 data: URL 用于图片
  const { session } = require('electron')
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https: blob:; connect-src 'self' https: wss:; font-src 'self' data:;"]
      }
    })
  })

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
ipcMain.handle('analyze-article', async (event, content: string, title?: string) => {
  try {
    // 发送进度更新的辅助函数
    const sendProgress = (status: string, thinking?: string) => {
      event.sender.send('analysis-progress', { status, thinking })
    }

    const result = await analyzeContent(content, title, sendProgress)
    return { success: true, data: result }
  } catch (error) {
    console.error('分析文章失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '分析文章失败'
    }
  }
})

// 下载文章
ipcMain.handle('download-article', async (_event, data: { title: string; content: string; format: 'txt' | 'md' }) => {
  try {
    const { title, content, format } = data

    // 清理文件名中的非法字符
    const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100)

    // 根据格式生成内容
    let fileContent: string
    let extension: string
    let filterName: string

    if (format === 'md') {
      fileContent = `# ${title}\n\n${content}`
      extension = 'md'
      filterName = 'Markdown文件'
    } else {
      fileContent = `${title}\n${'='.repeat(title.length)}\n\n${content}`
      extension = 'txt'
      filterName = '文本文件'
    }

    // 弹出保存对话框
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '下载文章',
      defaultPath: `${safeTitle}.${extension}`,
      filters: [{ name: filterName, extensions: [extension] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: '取消下载' }
    }

    // 写入文件
    fs.writeFileSync(result.filePath, fileContent, 'utf-8')
    logger.info('文章下载成功', { path: result.filePath, format })

    return { success: true, path: result.filePath }
  } catch (error) {
    console.error('下载文章失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '下载文章失败'
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

    // 保存有效的 Cookie 供后续使用
    if (stats.readCount !== null || stats.likeCount !== null) {
      saveCookieToFile(cookieString)
    }

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

// 剪贴板监听Cookie
let clipboardMonitoringStop: (() => void) | null = null

ipcMain.handle('start-clipboard-monitoring', async (event) => {
  try {
    logger.info('开始监听剪贴板获取 Cookie')

    // 如果已经在监听，先停止
    if (clipboardMonitoringStop) {
      clipboardMonitoringStop()
    }

    // 开始监听
    clipboardMonitoringStop = startClipboardMonitoring(
      (cookieString) => {
        // 检测到Cookie，发送给渲染进程
        logger.info('剪贴板检测到 Cookie')
        event.sender.send('clipboard-cookie-found', cookieString)
        clipboardMonitoringStop = null
      },
      () => {
        // 超时或取消
        logger.warn('剪贴板监听超时')
        event.sender.send('clipboard-monitoring-timeout')
        clipboardMonitoringStop = null
      }
    )

    return {
      success: true
    }
  } catch (error) {
    logger.error('启动剪贴板监听失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '启动剪贴板监听失败'
    }
  }
})

ipcMain.handle('stop-clipboard-monitoring', async () => {
  try {
    if (clipboardMonitoringStop) {
      clipboardMonitoringStop()
      clipboardMonitoringStop = null
      logger.info('停止剪贴板监听')
    }

    return {
      success: true
    }
  } catch (error) {
    logger.error('停止剪贴板监听失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '停止剪贴板监听失败'
    }
  }
})

// 代理服务器监听Cookie
ipcMain.handle('start-proxy-monitoring', async (event) => {
  try {
    logger.info('启动代理服务器监听Cookie')

    const PROXY_PORT = 8899

    await startProxyServer({
      port: PROXY_PORT,
      onCookieFound: (cookieString) => {
        logger.info('代理服务器捕获到Cookie')
        event.sender.send('proxy-cookie-found', cookieString)
      }
    })

    return {
      success: true,
      data: {
        port: PROXY_PORT,
        proxyUrl: `127.0.0.1:${PROXY_PORT}`
      }
    }
  } catch (error) {
    logger.error('启动代理服务器失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '启动代理服务器失败'
    }
  }
})

ipcMain.handle('stop-proxy-monitoring', async () => {
  try {
    await stopProxyServer()
    logger.info('代理服务器已停止')

    return {
      success: true
    }
  } catch (error) {
    logger.error('停止代理服务器失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '停止代理服务器失败'
    }
  }
})

ipcMain.handle('is-proxy-running', async () => {
  return {
    success: true,
    data: {
      isRunning: isProxyRunning()
    }
  }
})

// 证书管理
ipcMain.handle('install-ca-certificate', async () => {
  try {
    logger.info('开始安装CA证书')

    const certPath = getCACertPath()
    const success = await installCACertificateToSystem(certPath)

    if (success) {
      return {
        success: true,
        message: 'CA证书安装成功'
      }
    } else {
      return {
        success: false,
        error: 'CA证书安装失败，请以管理员身份运行应用'
      }
    }
  } catch (error) {
    logger.error('安装CA证书失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '安装CA证书失败'
    }
  }
})

ipcMain.handle('is-ca-certificate-installed', async () => {
  try {
    const isInstalled = await isCACertificateInstalled()

    return {
      success: true,
      data: {
        isInstalled
      }
    }
  } catch (error) {
    logger.error('检查CA证书状态失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '检查证书状态失败'
    }
  }
})

ipcMain.handle('uninstall-ca-certificate', async () => {
  try {
    logger.info('开始卸载CA证书')

    const success = await uninstallCACertificateFromSystem()

    if (success) {
      return {
        success: true,
        message: 'CA证书卸载成功'
      }
    } else {
      return {
        success: false,
        error: 'CA证书卸载失败'
      }
    }
  } catch (error) {
    logger.error('卸载CA证书失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '卸载CA证书失败'
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

    // 批量分析成功，保存 Cookie 供单篇分析使用
    saveCookieToFile(cookieString)

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

// 一键自动监听Cookie（自动完成所有设置）
let originalProxySettings: { enabled: boolean; server: string | null } | null = null

ipcMain.handle('auto-start-cookie-monitoring', async (event) => {
  try {
    logger.info('开始一键自动监听Cookie')

    const PROXY_PORT = 8899
    const PROXY_ADDRESS = `127.0.0.1:${PROXY_PORT}`

    // 步骤0: 检查代理是否已在运行，如果是则先停止
    if (isProxyRunning()) {
      logger.info('检测到代理服务器已在运行，先停止')
      await stopProxyServer()
      // 等待一下确保完全停止
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // 步骤1: 检查并安装CA证书
    const isInstalled = await isCACertificateInstalled()
    if (!isInstalled) {
      logger.info('CA证书未安装，开始自动安装')
      const certPath = getCACertPath()
      const installSuccess = await installCACertificateToSystem(certPath)

      if (!installSuccess) {
        return {
          success: false,
          error: '自动安装CA证书失败，请以管理员身份运行应用'
        }
      }
      logger.info('CA证书自动安装成功')
    }

    // 步骤2: 保存当前代理设置（在启动代理服务器之前）
    originalProxySettings = await getProxyStatus()
    logger.info('已保存原始代理设置', originalProxySettings)

    // 步骤3: 启动代理服务器
    await startProxyServer({
      port: PROXY_PORT,
      onCookieFound: (cookieString) => {
        logger.info('代理服务器捕获到Cookie')
        event.sender.send('auto-cookie-found', cookieString)
      }
    })

    // 步骤4: 设置系统代理
    const proxySetSuccess = await enableSystemProxy(PROXY_ADDRESS)
    if (!proxySetSuccess) {
      await stopProxyServer()
      return {
        success: false,
        error: '自动设置系统代理失败'
      }
    }

    logger.info('一键自动监听Cookie启动成功')

    return {
      success: true,
      data: {
        port: PROXY_PORT,
        proxyUrl: PROXY_ADDRESS
      }
    }
  } catch (error) {
    logger.error('一键自动监听Cookie失败', {
      error: error instanceof Error ? error.message : String(error)
    })

    // 清理：停止代理并恢复原始设置
    try {
      if (isProxyRunning()) {
        await stopProxyServer()
        logger.info('清理：代理服务器已停止')
      }

      if (originalProxySettings) {
        logger.info('清理：恢复原始代理设置', originalProxySettings)
        if (originalProxySettings.enabled && originalProxySettings.server) {
          await enableSystemProxy(originalProxySettings.server)
          logger.info('✓ 已恢复原始代理设置')
        } else {
          await disableSystemProxy()
          logger.info('✓ 已禁用系统代理')
        }
        originalProxySettings = null
      }
    } catch (cleanupError) {
      logger.error('清理失败', { error: cleanupError })
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : '启动失败'
    }
  }
})

ipcMain.handle('auto-stop-cookie-monitoring', async () => {
  try {
    logger.info('停止一键自动监听Cookie')

    // 步骤1: 先恢复原始代理设置（重要！先恢复再停止服务器）
    if (originalProxySettings) {
      logger.info('准备恢复原始代理设置', originalProxySettings)
      try {
        if (originalProxySettings.enabled && originalProxySettings.server) {
          await enableSystemProxy(originalProxySettings.server)
          logger.info('✓ 已恢复原始代理设置', originalProxySettings)
        } else {
          await disableSystemProxy()
          logger.info('✓ 已禁用系统代理（原本未启用）')
        }
      } catch (proxyErr) {
        logger.error('恢复代理设置失败', { error: proxyErr })
      }
      originalProxySettings = null
    } else {
      logger.warn('没有保存的原始代理设置，跳过恢复')
    }

    // 步骤2: 停止代理服务器
    if (isProxyRunning()) {
      logger.info('开始停止代理服务器')
      await stopProxyServer()
      logger.info('✓ 代理服务器已停止')
    } else {
      logger.info('代理服务器未运行，跳过停止')
    }

    logger.info('✓ 一键自动监听Cookie已完全停止')

    return {
      success: true
    }
  } catch (error) {
    logger.error('停止一键自动监听Cookie失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '停止失败'
    }
  }
})

// 批量下载文章内容
ipcMain.handle('download-articles-content', async (
  _event,
  articles: { title: string; url: string; cover: string; digest: string; publishTime: number; author: string }[],
  accountName: string,
  formats: DownloadFormat[],
  cookieString?: string
) => {
  try {
    logger.info('开始批量下载文章内容', {
      articleCount: articles.length,
      accountName,
      formats,
      hasCookie: !!cookieString
    })

    const result = await downloadArticlesContent(
      articles as any,
      accountName,
      formats,
      cookieString
    )

    if (result.success) {
      return {
        success: true,
        data: {
          outputDir: result.outputDir,
          downloadedCount: result.downloadedCount,
          errors: result.errors
        }
      }
    } else {
      return {
        success: false,
        error: result.errors[0] || '下载失败'
      }
    }
  } catch (error) {
    logger.error('批量下载文章内容失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : '下载失败'
    }
  }
})
