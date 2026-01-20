import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'
import { app, dialog } from 'electron'
import { logger } from './logger'
import { ArticleItem } from './batchAnalyzer'

// 下载格式类型
export type DownloadFormat = 'html' | 'pdf' | 'word'

// 下载进度回调
export type ProgressCallback = (current: number, total: number, currentTitle: string) => void

// 获取 Chrome 可执行文件路径
function getChromePath(): string | undefined {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ]

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return p
      }
    } catch {
      continue
    }
  }

  return undefined
}

// 清理文件名，移除非法字符
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // 移除Windows非法字符
    .replace(/\s+/g, ' ') // 多个空格替换为单个
    .trim()
    .substring(0, 100) // 限制长度
}

// 确保目录存在
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

// 抓取单篇文章内容
async function fetchArticleContent(
  articleUrl: string,
  browser: puppeteer.Browser,
  fallbackTitle?: string,
  cookieString?: string
): Promise<{ title: string; htmlContent: string; textContent: string }> {
  const page = await browser.newPage()

  try {
    // 设置User-Agent（微信浏览器）
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44(0x18002c2c) NetType/WIFI Language/zh_CN'
    )

    // 如果有 Cookie，设置到页面
    if (cookieString) {
      const cookies = cookieString.split(';').map(pair => {
        const [name, ...valueParts] = pair.trim().split('=')
        return {
          name: name.trim(),
          value: valueParts.join('=').trim(),
          domain: '.qq.com',
          path: '/'
        }
      }).filter(c => c.name && c.value)

      // 同时设置到 weixin.qq.com 和 mp.weixin.qq.com
      const allCookies = [
        ...cookies.map(c => ({ ...c, domain: '.qq.com' })),
        ...cookies.map(c => ({ ...c, domain: 'mp.weixin.qq.com' })),
        ...cookies.map(c => ({ ...c, domain: '.weixin.qq.com' }))
      ]

      await page.setCookie(...allCookies)
      logger.debug('已设置 Cookie', { count: allCookies.length })
    }

    // 设置额外的请求头
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://mp.weixin.qq.com/',
      'Upgrade-Insecure-Requests': '1'
    })

    // 设置视口
    await page.setViewport({
      width: 375,
      height: 812,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3
    })

    // 注入微信环境变量（在页面加载前）
    await page.evaluateOnNewDocument(() => {
      // 模拟微信JS SDK环境
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44(0x18002c2c) NetType/WIFI Language/zh_CN'
      });
      (window as any).__wxjs_environment = 'miniprogram';
      (window as any).WeixinJSBridge = {
        invoke: () => {},
        on: () => {},
        call: () => {}
      };
      // 防止被检测为headless浏览器
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // 添加触摸事件支持
      (window as any).ontouchstart = null;
    })

    // 访问页面
    await page.goto(articleUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    })

    // 等待DOM加载后额外等待，让JavaScript执行
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 等待内容元素出现
    await page.waitForSelector('#js_content', { timeout: 30000 }).catch(() => {
      logger.warn('未找到 #js_content 元素，尝试继续')
    })

    // 等待内容实际被填充（不仅仅是元素存在）
    await page.waitForFunction(
      () => {
        const content = document.querySelector('#js_content')
        return content && content.innerHTML && content.innerHTML.length > 100
      },
      { timeout: 15000 }
    ).catch(() => {
      logger.warn('等待内容填充超时')
    })

    // 等待标题元素
    await page.waitForSelector('#activity-name, .rich_media_title', { timeout: 10000 }).catch(() => {})

    // 等待内容渲染完成
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 滚动页面触发懒加载
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2)
    })
    await new Promise(resolve => setTimeout(resolve, 1500))
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await new Promise(resolve => setTimeout(resolve, 1500))

    // 滚回顶部
    await page.evaluate(() => {
      window.scrollTo(0, 0)
    })
    await new Promise(resolve => setTimeout(resolve, 500))

    // 调试：记录页面状态
    const debugInfo = await page.evaluate(() => {
      const content = document.querySelector('#js_content')
      return {
        hasContent: !!content,
        contentVisibility: content ? (content as HTMLElement).style.visibility : 'N/A',
        contentDisplay: content ? (content as HTMLElement).style.display : 'N/A',
        contentInnerHTMLLength: content?.innerHTML?.length || 0,
        bodyText: document.body.innerText.substring(0, 500)
      }
    })
    logger.info('页面调试信息', debugInfo)

    // 提取内容
    const content = await page.evaluate((defaultTitle: string) => {
      const titleEl = document.querySelector('#activity-name') ||
                      document.querySelector('.rich_media_title')
      const title = titleEl?.textContent?.trim() || defaultTitle

      // 获取作者
      const authorEl = document.querySelector('#js_name') ||
                       document.querySelector('.rich_media_meta_nickname')
      const author = authorEl?.textContent?.trim() || ''

      // 获取发布时间
      const timeEl = document.querySelector('#publish_time') ||
                     document.querySelector('.rich_media_meta_date')
      const publishTime = timeEl?.textContent?.trim() || ''

      const contentEl = document.querySelector('#js_content')

      // 强制显示内容
      if (contentEl) {
        (contentEl as HTMLElement).style.visibility = 'visible';
        (contentEl as HTMLElement).style.display = 'block';
      }

      // 处理图片懒加载：将 data-src 转换为 src，并收集所有图片URL
      const imageUrls: string[] = []
      if (contentEl) {
        const images = contentEl.querySelectorAll('img')
        images.forEach(img => {
          const dataSrc = img.getAttribute('data-src')
          const currentSrc = img.getAttribute('src')
          // 优先使用 data-src（微信懒加载图片）
          const finalSrc = dataSrc || currentSrc
          if (finalSrc && !finalSrc.startsWith('data:')) {
            imageUrls.push(finalSrc)
            img.setAttribute('src', finalSrc)
            // 添加标记便于后续替换
            img.setAttribute('data-img-index', String(imageUrls.length - 1))
          }
          // 移除懒加载相关属性
          img.removeAttribute('data-src')
          img.removeAttribute('data-ratio')
          img.removeAttribute('data-w')
          img.removeAttribute('data-type')
          img.removeAttribute('data-s')
        })
      }

      const htmlContent = contentEl?.innerHTML || ''
      const textContent = contentEl?.textContent?.trim() || ''

      // 获取文章的完整HTML（包含样式）
      const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Microsoft YaHei", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.8;
      color: #333;
    }
    h1 {
      font-size: 22px;
      margin-bottom: 10px;
      line-height: 1.4;
    }
    .meta {
      color: #888;
      font-size: 14px;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #eee;
    }
    #js_content {
      visibility: visible !important;
      font-size: 16px;
    }
    #js_content p {
      margin-bottom: 15px;
    }
    #js_content img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 15px auto;
    }
    #js_content section {
      margin-bottom: 15px;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">${author ? author + ' · ' : ''}${publishTime}</div>
  <div id="js_content">${htmlContent}</div>
</body>
</html>`

      return { title, htmlContent: fullHtml, textContent, imageUrls }
    }, fallbackTitle || '未知标题')

    // 下载图片并转换为 base64
    if (content.imageUrls && content.imageUrls.length > 0) {
      logger.info('开始转换图片为 base64', { count: content.imageUrls.length })

      let processedHtml = content.htmlContent

      for (let i = 0; i < Math.min(content.imageUrls.length, 50); i++) {
        const imageUrl = content.imageUrls[i]
        try {
          // 在页面上下文中获取图片
          const base64Image = await page.evaluate(async (url: string) => {
            try {
              const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',
                credentials: 'include',
                headers: {
                  'Referer': 'https://mp.weixin.qq.com/'
                }
              })

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
              }

              const blob = await response.blob()

              return new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.onerror = () => reject(new Error('FileReader error'))
                reader.readAsDataURL(blob)
              })
            } catch (error) {
              throw new Error(`Fetch failed: ${error}`)
            }
          }, imageUrl)

          // 替换 HTML 中的图片 URL
          processedHtml = processedHtml.replace(
            new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            base64Image
          )

          logger.debug(`图片 ${i + 1} 转换成功`)
        } catch (error) {
          logger.warn(`图片 ${i + 1} 转换失败，保留原URL`, {
            url: imageUrl.substring(0, 80),
            error: error instanceof Error ? error.message : String(error)
          })
        }

        // 避免请求过快
        if ((i + 1) % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }

      content.htmlContent = processedHtml
      logger.info('图片转换完成')
    }

    return {
      title: content.title,
      htmlContent: content.htmlContent,
      textContent: content.textContent
    }
  } finally {
    await page.close()
  }
}

// 生成PDF
async function generatePdfFromHtml(
  htmlContent: string,
  outputPath: string,
  browser: puppeteer.Browser
): Promise<void> {
  const page = await browser.newPage()

  try {
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise(resolve => setTimeout(resolve, 1000))

    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      printBackground: true
    })
  } finally {
    await page.close()
  }
}

// 生成简易Word格式（HTML转RTF）
async function generateWordFromHtml(
  title: string,
  textContent: string,
  outputPath: string
): Promise<void> {
  // 使用简化的HTML格式作为Word文档（Word可以打开HTML）
  const wordContent = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: "Microsoft YaHei", "SimSun", Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.8;
      margin: 2cm;
    }
    h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 24pt;
    }
    p {
      margin-bottom: 12pt;
      text-indent: 2em;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${textContent.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('\n')}
</body>
</html>`

  fs.writeFileSync(outputPath, wordContent, 'utf-8')
}

// 批量下载文章内容
export async function downloadArticlesContent(
  articles: ArticleItem[],
  accountName: string,
  formats: DownloadFormat[],
  cookieString?: string,
  onProgress?: ProgressCallback
): Promise<{ success: boolean; outputDir: string; downloadedCount: number; errors: string[] }> {
  const errors: string[] = []
  let downloadedCount = 0

  // 让用户选择保存目录
  const result = await dialog.showOpenDialog({
    title: '选择保存位置',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: '选择此文件夹'
  })

  if (result.canceled || !result.filePaths[0]) {
    return { success: false, outputDir: '', downloadedCount: 0, errors: ['用户取消了操作'] }
  }

  const baseDir = result.filePaths[0]
  const sanitizedAccountName = sanitizeFileName(accountName)
  const outputDir = path.join(baseDir, sanitizedAccountName)

  // 创建输出目录
  ensureDirectoryExists(outputDir)

  // 为每种格式创建子目录
  const formatDirs: Record<DownloadFormat, string> = {
    html: path.join(outputDir, 'HTML'),
    pdf: path.join(outputDir, 'PDF'),
    word: path.join(outputDir, 'Word')
  }

  for (const format of formats) {
    ensureDirectoryExists(formatDirs[format])
  }

  logger.info('开始批量下载文章内容', {
    accountName,
    articleCount: articles.length,
    formats,
    outputDir
  })

  const chromePath = getChromePath()
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ]
  })

  try {
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i]

      if (onProgress) {
        onProgress(i + 1, articles.length, article.title)
      }

      try {
        logger.info(`下载文章 [${i + 1}/${articles.length}]`, { title: article.title })

        // 抓取文章内容，使用列表中的标题作为备选，传递Cookie
        const content = await fetchArticleContent(article.url, browser, article.title, cookieString)
        const sanitizedTitle = sanitizeFileName(content.title || article.title)

        // 保存为选定的格式
        for (const format of formats) {
          const fileName = `${sanitizedTitle}.${format === 'word' ? 'doc' : format}`
          const filePath = path.join(formatDirs[format], fileName)

          try {
            switch (format) {
              case 'html':
                fs.writeFileSync(filePath, content.htmlContent, 'utf-8')
                break
              case 'pdf':
                await generatePdfFromHtml(content.htmlContent, filePath, browser)
                break
              case 'word':
                await generateWordFromHtml(content.title, content.textContent, filePath)
                break
            }
            logger.debug(`已保存 ${format} 文件`, { filePath })
          } catch (formatError) {
            const errorMsg = `保存 ${format} 失败: ${formatError instanceof Error ? formatError.message : formatError}`
            logger.error(errorMsg, { title: article.title })
            errors.push(`${article.title} - ${errorMsg}`)
          }
        }

        downloadedCount++

        // 避免请求过快
        if (i < articles.length - 1) {
          const delay = Math.floor(Math.random() * 2000) + 1000 // 1-3秒延迟
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      } catch (error) {
        const errorMsg = `下载失败: ${error instanceof Error ? error.message : error}`
        logger.error(errorMsg, { title: article.title, url: article.url })
        errors.push(`${article.title} - ${errorMsg}`)
      }
    }

    logger.info('批量下载完成', {
      total: articles.length,
      downloaded: downloadedCount,
      errors: errors.length
    })

    return {
      success: true,
      outputDir,
      downloadedCount,
      errors
    }
  } finally {
    await browser.close()
  }
}
