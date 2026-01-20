import puppeteer from 'puppeteer'
import path from 'path'
import { app } from 'electron'
import { logger } from './logger'

// 获取 Chrome 可执行文件路径
function getChromePath(): string | undefined {
  // 常见的 Chrome 安装路径
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ]

  for (const p of possiblePaths) {
    try {
      if (require('fs').existsSync(p)) {
        return p
      }
    } catch {
      continue
    }
  }

  return undefined
}

interface ArticleData {
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

interface ArticleStats {
  readCount: number | null
  likeCount: number | null
  wowCount: number | null
  shareCount: number | null
  favoriteCount: number | null
  commentCount: number | null
  isManualInput: boolean
}

interface ScrapeResult {
  article: ArticleData
  stats: ArticleStats
}

export async function scrapeArticle(url: string): Promise<ScrapeResult> {
  logger.info('开始抓取文章', { url })

  const chromePath = getChromePath()
  logger.debug('Chrome 路径', { chromePath })

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security', // 禁用同源策略，加快加载
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled', // 避免被检测
      '--disable-background-networking', // 禁用后台网络
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-translate'
    ]
  })

  try {
    const page = await browser.newPage()
    logger.debug('浏览器页面已创建')

    // 启用请求拦截，阻止非必要资源加载以加速
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      const resourceType = request.resourceType()
      const url = request.url()

      // 阻止字体、样式表（保留图片，因为可能需要下载）
      // 但允许文档、脚本、xhr、fetch 等
      if (
        resourceType === 'font' ||
        (resourceType === 'stylesheet' && !url.includes('mp.weixin.qq.com')) ||
        resourceType === 'media'
      ) {
        request.abort()
      } else {
        request.continue()
      }
    })

    // 存储拦截到的 API 请求
    const capturedRequests: Array<{ url: string; response: any }> = []

    // 监听所有网络响应
    page.on('response', async (response) => {
      try {
        const url = response.url()

        // 过滤出可能包含数据的 API 请求
        const isApiRequest =
          url.includes('/mp/getappmsgext') || // 主要的数据接口
          url.includes('/mp/appmsg_comment') || // 评论接口
          url.includes('/mp/appmsgext') ||
          url.includes('appmsg') ||
          url.includes('article') ||
          url.includes('read_num') ||
          url.includes('like_num')

        if (isApiRequest) {
          logger.info('拦截到 API 请求', { url: url.substring(0, 150) })

          try {
            const contentType = response.headers()['content-type'] || ''

            if (contentType.includes('application/json') || contentType.includes('text/json')) {
              const responseData = await response.json()
              logger.info('API 响应数据', {
                url: url.substring(0, 100),
                data: JSON.stringify(responseData).substring(0, 500)
              })

              capturedRequests.push({
                url,
                response: responseData
              })
            } else {
              const responseText = await response.text()
              if (responseText.length < 10000) { // 避免过大的响应
                logger.debug('API 响应文本', {
                  url: url.substring(0, 100),
                  text: responseText.substring(0, 300)
                })

                // 尝试解析为 JSON
                try {
                  const jsonData = JSON.parse(responseText)
                  capturedRequests.push({
                    url,
                    response: jsonData
                  })
                } catch {
                  // 不是 JSON，忽略
                }
              }
            }
          } catch (error) {
            logger.warn('解析 API 响应失败', {
              url: url.substring(0, 100),
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }
      } catch (error) {
        // 忽略解析错误
      }
    })

    logger.debug('已设置网络请求拦截')

    // 模拟微信内置浏览器的 User-Agent（iOS 版本，数据更容易获取）
    const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44(0x18002c2c) NetType/WIFI Language/zh_CN'

    await page.setUserAgent(userAgent)
    logger.info('设置 User-Agent', { userAgent })

    // 设置额外的请求头
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://mp.weixin.qq.com/',
      'Upgrade-Insecure-Requests': '1'
    })

    // 设置视口为手机尺寸（微信浏览器通常是手机）
    await page.setViewport({
      width: 375,
      height: 812,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3
    })
    logger.debug('设置视口为手机尺寸')

    // 注入微信环境变量
    await page.evaluateOnNewDocument(() => {
      // 模拟微信 JS SDK 环境
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44(0x18002c2c) NetType/WIFI Language/zh_CN'
      });

      // 添加微信环境标识
      (window as any).__wxjs_environment = 'miniprogram';
      (window as any).WeixinJSBridge = {
        invoke: () => {},
        on: () => {},
        call: () => {}
      };

      // 防止被检测为 headless 浏览器
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });

      // 添加触摸事件支持
      (window as any).ontouchstart = null;
    })
    logger.debug('注入微信环境变量')

    // 访问页面（使用更宽松的等待策略，避免超时）
    logger.info('正在访问页面')
    try {
      // 尝试使用 domcontentloaded，更快且不会被资源加载阻塞
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 90000
      })
      logger.info('页面 DOM 加载完成')

      // 额外等待一些时间让动态内容加载
      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (error) {
      logger.warn('页面加载超时，尝试继续...', { error: error instanceof Error ? error.message : error })

      // 如果超时，尝试重新加载，使用最宽松的策略
      try {
        await page.goto(url, {
          waitUntil: 'load',
          timeout: 120000
        })
        logger.info('重试加载成功')
      } catch (retryError) {
        logger.error('重试加载失败', { error: retryError instanceof Error ? retryError.message : retryError })
        throw new Error('页面加载超时，请检查网络连接或稍后重试')
      }
    }
    logger.info('页面加载完成')

    // 等待文章内容加载
    logger.debug('等待文章内容加载')
    await page.waitForSelector('#js_content', { timeout: 45000 }).catch((err) => {
      logger.warn('未找到 #js_content 元素，尝试继续', { error: err.message })
    })

    // 检查是否有验证码或错误页面
    const pageText = await page.evaluate(() => document.body.innerText)
    if (pageText.includes('验证码') || pageText.includes('访问过于频繁') || pageText.includes('系统繁忙')) {
      logger.error('页面显示验证码或限制', { pageText: pageText.substring(0, 200) })
      throw new Error('访问受限：页面要求验证或显示系统繁忙，请稍后重试')
    }

    // 等待初始渲染
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 滚动到底部，触发底部数据加载
    logger.debug('滚动到页面底部')
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })

    // 等待底部统计数据加载（微信文章底部互动区域）
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 尝试点击可能的"展开"按钮
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a, span[role="button"]')
      buttons.forEach(btn => {
        const text = btn.textContent?.trim() || ''
        if (text.includes('展开') || text.includes('更多') || text.includes('查看')) {
          (btn as HTMLElement).click()
        }
      })
    }).catch(() => {})

    await new Promise(resolve => setTimeout(resolve, 2000))

    // 保存截图用于调试
    const userDataPath = app.getPath('userData')
    const screenshotPath = path.join(userDataPath, 'debug-screenshot.png')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    logger.info('已保存页面截图', { path: screenshotPath })

    // 保存页面 HTML 源代码用于调试
    const htmlPath = path.join(userDataPath, 'debug-page.html')
    const htmlContent = await page.content()
    require('fs').writeFileSync(htmlPath, htmlContent, 'utf-8')
    logger.info('已保存页面HTML', { path: htmlPath, size: htmlContent.length })

    // 保存所有 script 标签内容到单独文件
    const scripts = await page.evaluate(() => {
      const scriptTags = document.querySelectorAll('script')
      return Array.from(scriptTags).map((script, index) => ({
        index,
        type: script.type || 'text/javascript',
        src: script.src || 'inline',
        content: script.textContent || '',
        length: (script.textContent || '').length
      }))
    })

    const scriptsPath = path.join(userDataPath, 'debug-scripts.json')
    require('fs').writeFileSync(scriptsPath, JSON.stringify(scripts, null, 2), 'utf-8')
    logger.info('已保存脚本内容', { path: scriptsPath, count: scripts.length })

    // 再滚动回顶部
    await page.evaluate(() => {
      window.scrollTo(0, 0)
    })

    await new Promise(resolve => setTimeout(resolve, 500))
    logger.debug('内容渲染等待完成')

    // 提取文章数据
    const articleData = await page.evaluate(() => {
      // 标题
      const titleEl = document.querySelector('#activity-name') ||
                      document.querySelector('.rich_media_title')
      const title = titleEl?.textContent?.trim() || ''

      // 作者
      const authorEl = document.querySelector('#js_name') ||
                       document.querySelector('.rich_media_meta_nickname')
      const author = authorEl?.textContent?.trim() || ''

      // 发布时间
      const timeEl = document.querySelector('#publish_time') ||
                     document.querySelector('.rich_media_meta_date')
      const publishTime = timeEl?.textContent?.trim() || ''

      // 正文内容
      const contentEl = document.querySelector('#js_content')
      const content = contentEl?.textContent?.trim() || ''
      const htmlContent = contentEl?.innerHTML || ''

      // 图片 - 获取所有图片 URL（优先 data-src，微信使用懒加载）
      const imageEls = contentEl?.querySelectorAll('img') || []
      const imageUrls: string[] = []
      const debugImgInfo: { dataSrc: string | null; src: string | null; finalUrl: string | null }[] = []

      imageEls.forEach(img => {
        const dataSrc = img.getAttribute('data-src')
        const src = img.getAttribute('src')

        // 优先使用 data-src（懒加载原始URL），否则用 src
        let url = dataSrc || src
        let finalUrl: string | null = null

        if (url && !url.startsWith('data:')) {
          // 解码 HTML 实体
          url = url.replace(/&amp;/g, '&')
          finalUrl = url
          imageUrls.push(url)
        }

        // 记录完整的 URL 用于调试
        debugImgInfo.push({
          dataSrc: dataSrc || null,
          src: src?.startsWith('data:') ? '[SVG placeholder]' : (src || null),
          finalUrl
        })
      })

      // 字数统计
      const wordCount = content.replace(/\s/g, '').length

      // 调试信息
      const debugInfo = {
        contentElExists: !!contentEl,
        contentLength: htmlContent.length,
        imageElsCount: imageEls.length,
        imageUrlsCount: imageUrls.length,
        imgDetails: debugImgInfo
      }

      return {
        title,
        author,
        publishTime,
        content,
        htmlContent,
        imageUrls,
        wordCount,
        debugInfo
      }
    })

    // 输出调试信息
    logger.info('图片提取调试信息', articleData.debugInfo)

    // 将图片转换为 base64，避免防盗链问题
    logger.info('开始转换图片', { count: articleData.imageUrls.length })
    const images: string[] = []

    for (let i = 0; i < Math.min(articleData.imageUrls.length, 20); i++) {
      const imageUrl = articleData.imageUrls[i]

      // 跳过 base64 图片和太小的图片
      if (imageUrl.startsWith('data:')) {
        logger.debug('跳过 base64 图片', { index: i })
        images.push(imageUrl)
        continue
      }

      try {
        logger.debug(`转换图片 ${i + 1}/${Math.min(articleData.imageUrls.length, 20)}`, { url: imageUrl.substring(0, 80) })

        const imgBuffer = await page.evaluate(async (url) => {
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

        images.push(imgBuffer)
        logger.info(`图片转换成功 [${i + 1}]`, {
          originalUrl: imageUrl.substring(0, 50),
          base64Size: Math.round(imgBuffer.length / 1024) + 'KB'
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.warn(`图片转换失败 [${i + 1}]，保留原URL`, {
          url: imageUrl.substring(0, 80),
          error: errorMsg
        })
        // 如果转换失败，保留原 URL（但标记为可能无法加载）
        images.push(imageUrl)
      }

      // 每转换5张图片暂停一下，避免请求过快
      if ((i + 1) % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    logger.info('图片转换完成', {
      total: articleData.imageUrls.length,
      converted: images.length,
      base64Count: images.filter(img => img.startsWith('data:')).length
    })

    // 将 htmlContent 中的图片 URL 替换为 base64
    let processedHtmlContent = articleData.htmlContent
    let replacedCount = 0
    for (let i = 0; i < Math.min(articleData.imageUrls.length, images.length); i++) {
      const originalUrl = articleData.imageUrls[i]
      const base64Image = images[i]
      if (base64Image.startsWith('data:')) {
        // 转义 URL 中的特殊字符用于正则匹配
        const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // HTML 中的 URL 可能使用 &amp; 编码
        const escapedUrlEncoded = originalUrl.replace(/&/g, '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        const beforeLength = processedHtmlContent.length

        // 替换 src 属性（解码版本）
        processedHtmlContent = processedHtmlContent.replace(
          new RegExp(`(src=["'])${escapedUrl}(["'])`, 'g'),
          `$1${base64Image}$2`
        )
        // 替换 src 属性（HTML编码版本）
        processedHtmlContent = processedHtmlContent.replace(
          new RegExp(`(src=["'])${escapedUrlEncoded}(["'])`, 'g'),
          `$1${base64Image}$2`
        )
        // 替换 data-src 属性（解码版本）
        processedHtmlContent = processedHtmlContent.replace(
          new RegExp(`(data-src=["'])${escapedUrl}(["'])`, 'g'),
          `$1${base64Image}$2`
        )
        // 替换 data-src 属性（HTML编码版本）
        processedHtmlContent = processedHtmlContent.replace(
          new RegExp(`(data-src=["'])${escapedUrlEncoded}(["'])`, 'g'),
          `$1${base64Image}$2`
        )

        if (processedHtmlContent.length !== beforeLength) {
          replacedCount++
        }
      }
    }
    articleData.htmlContent = processedHtmlContent
    logger.info('HTML中的图片URL已替换为base64', { replacedCount, totalImages: images.length })

    // 尝试获取阅读量等数据
    logger.info('开始提取统计数据')
    const stats = await extractStats(page)
    logger.info('统计数据提取完成', stats)

    // 从拦截到的 API 请求中提取数据
    if (capturedRequests.length > 0) {
      logger.info(`分析拦截到的 ${capturedRequests.length} 个 API 请求`)

      // 保存所有 API 请求到文件
      const userDataPath = app.getPath('userData')
      const apiDataPath = path.join(userDataPath, 'captured-api-requests.json')
      require('fs').writeFileSync(apiDataPath, JSON.stringify(capturedRequests, null, 2), 'utf-8')
      logger.info('已保存 API 请求数据', { path: apiDataPath, count: capturedRequests.length })

      // 尝试从 API 响应中提取数据
      for (const request of capturedRequests) {
        try {
          const data = request.response

          // 检查各种可能的数据字段
          if (data && typeof data === 'object') {
            // 常见的字段名
            const fields = [
              'read_num',
              'readNum',
              'read_count',
              'readCount',
              'like_num',
              'likeNum',
              'like_count',
              'likeCount',
              'old_like_num',
              'wow_num',
              'wowNum',
              'share_num',
              'shareNum',
              'favorite_num',
              'favoriteNum',
              'comment_count',
              'commentCount',
              'comment_num'
            ]

            let foundData = false

            for (const field of fields) {
              if (data[field] !== undefined && data[field] !== null) {
                logger.info(`从 API 找到数据字段: ${field} = ${data[field]}`)
                foundData = true

                // 映射到 stats
                if ((field.includes('read') || field.includes('Read')) && stats.readCount === null) {
                  stats.readCount = Number(data[field])
                }
                if ((field.includes('like') || field.includes('Like')) && stats.likeCount === null) {
                  stats.likeCount = Number(data[field])
                }
                if ((field.includes('wow') || field.includes('Wow')) && stats.wowCount === null) {
                  stats.wowCount = Number(data[field])
                }
                if ((field.includes('share') || field.includes('Share')) && stats.shareCount === null) {
                  stats.shareCount = Number(data[field])
                }
                if ((field.includes('favorite') || field.includes('Favorite')) && stats.favoriteCount === null) {
                  stats.favoriteCount = Number(data[field])
                }
                if ((field.includes('comment') || field.includes('Comment')) && stats.commentCount === null) {
                  stats.commentCount = Number(data[field])
                }
              }
            }

            // 检查嵌套的数据结构
            if (data.appmsgstat) {
              logger.info('找到 appmsgstat 对象', { data: JSON.stringify(data.appmsgstat) })
              if (data.appmsgstat.read_num !== undefined && stats.readCount === null) {
                stats.readCount = Number(data.appmsgstat.read_num)
                foundData = true
              }
              if (data.appmsgstat.like_num !== undefined && stats.likeCount === null) {
                stats.likeCount = Number(data.appmsgstat.like_num)
                foundData = true
              }
            }

            if (data.appmsgext) {
              logger.info('找到 appmsgext 对象', { data: JSON.stringify(data.appmsgext) })
            }

            if (foundData) {
              logger.info('✓ 从 API 成功提取到数据', {
                readCount: stats.readCount,
                likeCount: stats.likeCount,
                wowCount: stats.wowCount,
                shareCount: stats.shareCount,
                favoriteCount: stats.favoriteCount,
                commentCount: stats.commentCount
              })
            }
          }
        } catch (error) {
          logger.error('解析 API 数据失败', { error: error instanceof Error ? error.message : String(error) })
        }
      }

      // 更新 isManualInput 标志
      if (stats.readCount !== null || stats.likeCount !== null) {
        stats.isManualInput = false
        logger.info('✓ API 数据获取成功，已标记为自动获取')
      }
    } else {
      logger.warn('未拦截到任何 API 请求')
    }

    // 验证 images 数组内容
    logger.info('验证 images 数组', {
      length: images.length,
      types: images.map((img, i) => ({
        index: i,
        isBase64: img.startsWith('data:'),
        prefix: img.substring(0, 30),
        size: img.length
      }))
    })

    const result = {
      article: {
        url,
        title: articleData.title,
        author: articleData.author,
        publishTime: articleData.publishTime,
        content: articleData.content,
        htmlContent: articleData.htmlContent,
        images,
        wordCount: articleData.wordCount,
        imageCount: images.length
      },
      stats
    }

    logger.info('文章抓取成功', {
      title: articleData.title,
      wordCount: articleData.wordCount,
      imageCount: images.length,
      hasStats: !stats.isManualInput
    })

    return result
  } catch (error) {
    logger.error('文章抓取失败', { error: error instanceof Error ? error.message : error })
    throw error
  } finally {
    await browser.close()
    logger.debug('浏览器已关闭')
  }
}

async function extractStats(page: puppeteer.Page): Promise<ArticleStats> {
  try {
    // 等待页面完全加载和数据渲染
    await new Promise(resolve => setTimeout(resolve, 2000))

    const stats = await page.evaluate(() => {
      const debugInfo: string[] = []

      let readCount: number | null = null
      let likeCount: number | null = null
      let wowCount: number | null = null
      let shareCount: number | null = null
      let favoriteCount: number | null = null
      let commentCount: number | null = null

      // 记录页面关键区域的 HTML 结构
      const bottomArea = document.querySelector('#js_bottom_ad_area')
      if (bottomArea) {
        debugInfo.push(`✓ Found #js_bottom_ad_area`)
        // 输出底部区域的前200个字符
        const bottomHtml = bottomArea.innerHTML.substring(0, 300)
        debugInfo.push(`Bottom area HTML: ${bottomHtml}`)
      }

      const articleContent = document.querySelector('#js_article')
      if (articleContent) {
        debugInfo.push(`✓ Found #js_article`)
      }

      // 查找所有可能包含互动数据的区域
      const interactionSelectors = [
        '#js_read_area',
        '#js_read_area3',
        '.rich_media_tool',
        '.rich_media_tool_item',
        '.media_tool_meta',
        '#js_tags',
        '.js_share_area'
      ]

      interactionSelectors.forEach(sel => {
        const el = document.querySelector(sel)
        if (el) {
          debugInfo.push(`✓ Found ${sel}: "${el.textContent?.trim().substring(0, 50)}"`)
        }
      })

      // 记录页面所有的 ID
      const allIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id).filter(id => id)
      debugInfo.push(`Page IDs (${allIds.length} total): ${allIds.slice(0, 50).join(', ')}`)

      // 记录页面所有包含关键词的 class
      const allElements = document.querySelectorAll('[class*="read"], [class*="like"], [class*="share"], [class*="comment"]')
      if (allElements.length > 0) {
        const classInfo = Array.from(allElements).slice(0, 10).map(el =>
          `${el.tagName}.${String(el.className).split(' ')[0]}`
        ).join(', ')
        debugInfo.push(`Relevant classes: ${classInfo}`)
      }

      // 检查是否在微信环境
      const win = window as any
      if (win.WeixinJSBridge) {
        debugInfo.push('✓ WeixinJSBridge detected')
      } else {
        debugInfo.push('✗ WeixinJSBridge NOT found (may affect data visibility)')
      }

      // 方法1: 从页面底部的互动数据获取
      const selectors = {
        // 阅读量的各种可能位置（微信环境下）
        read: [
          // 微信文章底部的阅读数
          '#js_read_area3 .read_num',
          '#js_read_area .read_num',
          'meta[property="og:article:read_count"]',
          '.rich_media_meta_list .rich_media_meta_text',
          'span[id*="readNum"]',
          'span[id*="read_num"]',
          '.read_num',
          '#read_num',
          // 移动端特有的选择器
          '.tips_global_primary',
          '.media_tool_meta'
        ],
        // 点赞数的可能位置（微信环境）
        like: [
          '#like3 .praise_num',
          '#like .praise_num',
          '#likeNum3',
          '#like_num',
          '.like_num',
          'span[id*="likeNum"]',
          'span[id*="praise"]',
          '#js_like_btn span',
          '.media_tool_meta.meta_primary'
        ],
        // 在看数（微信特有）
        wow: [
          '#wow3 .view_num',
          '#wow .view_num',
          '#wowNum3',
          '#wow_num',
          '.wow_num',
          'span[id*="wowNum"]',
          'span[id*="view_num"]'
        ],
        // 转发数
        share: [
          '#share3 .share_num',
          '#share_num',
          '.share_num',
          'span[id*="shareNum"]',
          '#js_share_num'
        ],
        // 收藏数
        favorite: [
          '#favorite3 .favorite_num',
          '#favorite_num',
          '.favorite_num',
          'span[id*="favoriteNum"]',
          '#js_favorite_num'
        ],
        // 评论数（微信环境）
        comment: [
          '#js_cmt_count',
          '#comment_count',
          '.discuss_num',
          'span[id*="commentNum"]',
          'span[id*="comment_num"]',
          '#comment_num',
          '.comment_num'
        ]
      }

      // 尝试所有选择器
      for (const selector of selectors.read) {
        try {
          // 特殊处理 meta 标签
          if (selector.startsWith('meta[')) {
            const meta = document.querySelector(selector) as HTMLMetaElement
            if (meta && meta.content) {
              const num = parseInt(meta.content, 10)
              if (!isNaN(num) && num > 0) {
                readCount = num
                debugInfo.push(`✓ Found readCount from meta: ${num}`)
                break
              }
            }
            continue
          }

          const el = document.querySelector(selector)
          if (el) {
            const text = el.textContent?.trim() || ''
            // 过滤掉明显不是数字的文本
            if (text && text.length < 50) { // 数字文本通常很短
              // 检查文本是否包含数字
              if (/\d/.test(text)) {
                debugInfo.push(`Trying read selector: ${selector} = "${text}"`)

                // 提取数字
                const num = parseInt(text.replace(/\D/g, ''), 10)

                // 必须是纯数字或包含"阅读"、"次"等关键词的文本
                const isPureNumber = /^\d+$/.test(text.trim())
                const hasReadKeyword = /阅读|次|read|view/i.test(text)

                if (!isNaN(num) && num > 0 && (isPureNumber || hasReadKeyword)) {
                  readCount = num
                  debugInfo.push(`✓ Found readCount: ${num} from ${selector}`)
                  break
                } else if (num > 0) {
                  debugInfo.push(`  Skipped (non-numeric text): "${text}"`)
                }
              }
            }
          }
        } catch (e) {
          debugInfo.push(`Error with selector ${selector}: ${e}`)
        }
      }

      for (const selector of selectors.like) {
        try {
          const el = document.querySelector(selector)
          if (el) {
            const text = el.textContent?.trim() || ''
            if (text && text.length < 50 && /\d/.test(text)) {
              debugInfo.push(`Trying like selector: ${selector} = "${text}"`)

              const num = parseInt(text.replace(/\D/g, ''), 10)
              const isPureNumber = /^\d+$/.test(text.trim())
              const hasLikeKeyword = /赞|like|praise|好看/i.test(text)
              const isNotButton = !/关注|取消|已关注|follow/i.test(text)

              if (!isNaN(num) && num >= 0 && isNotButton && (isPureNumber || hasLikeKeyword)) {
                likeCount = num
                debugInfo.push(`✓ Found likeCount: ${num} from ${selector}`)
                break
              } else if (num >= 0) {
                debugInfo.push(`  Skipped: "${text}" (not like count)`)
              }
            }
          }
        } catch (e) {
          debugInfo.push(`Error with selector ${selector}: ${e}`)
        }
      }

      for (const selector of selectors.wow) {
        try {
          const el = document.querySelector(selector)
          if (el) {
            const text = el.textContent?.trim() || ''
            if (text) {
              debugInfo.push(`Trying wow selector: ${selector} = "${text}"`)
              const num = parseInt(text.replace(/\D/g, ''), 10)
              if (!isNaN(num) && num >= 0) {
                wowCount = num
                debugInfo.push(`✓ Found wowCount: ${num}`)
                break
              }
            }
          }
        } catch (e) {
          debugInfo.push(`Error with selector ${selector}: ${e}`)
        }
      }

      for (const selector of selectors.share) {
        try {
          const el = document.querySelector(selector)
          if (el) {
            const text = el.textContent?.trim() || ''
            if (text) {
              debugInfo.push(`Trying share selector: ${selector} = "${text}"`)
              const num = parseInt(text.replace(/\D/g, ''), 10)
              if (!isNaN(num) && num >= 0) {
                shareCount = num
                debugInfo.push(`✓ Found shareCount: ${num}`)
                break
              }
            }
          }
        } catch (e) {
          debugInfo.push(`Error with selector ${selector}: ${e}`)
        }
      }

      for (const selector of selectors.favorite) {
        try {
          const el = document.querySelector(selector)
          if (el) {
            const text = el.textContent?.trim() || ''
            if (text) {
              debugInfo.push(`Trying favorite selector: ${selector} = "${text}"`)
              const num = parseInt(text.replace(/\D/g, ''), 10)
              if (!isNaN(num) && num >= 0) {
                favoriteCount = num
                debugInfo.push(`✓ Found favoriteCount: ${num}`)
                break
              }
            }
          }
        } catch (e) {
          debugInfo.push(`Error with selector ${selector}: ${e}`)
        }
      }

      for (const selector of selectors.comment) {
        try {
          const el = document.querySelector(selector)
          if (el) {
            const text = el.textContent?.trim() || ''
            if (text) {
              debugInfo.push(`Trying comment selector: ${selector} = "${text}"`)
              const num = parseInt(text.replace(/\D/g, ''), 10)
              if (!isNaN(num) && num >= 0) {
                commentCount = num
                debugInfo.push(`✓ Found commentCount: ${num}`)
                break
              }
            }
          }
        } catch (e) {
          debugInfo.push(`Error with selector ${selector}: ${e}`)
        }
      }

      // 方法2: 从 window 全局对象获取
      try {
        const win = window as any

        // 检查各种可能的全局变量
        const possibleVars = [
          'appmsg_stat',
          'appmsgstat',
          'msg_link',
          'biz_wvx',
          'appmsg_like_type',
          'appmsg_type',
          'user_uin',
          'msg_title',
          'msg_desc',
          'msg_cdn_url',
          'appmsg_token',
          '__appmsgCgiData'
        ]

        for (const varName of possibleVars) {
          if (win[varName]) {
            const value = win[varName]
            const valueStr = typeof value === 'object' ? JSON.stringify(value).substring(0, 300) : String(value)
            debugInfo.push(`window.${varName}: ${valueStr}`)
          }
        }

        // 检查 __appmsgCgiData（微信新版本可能使用）
        if (win.__appmsgCgiData) {
          debugInfo.push(`__appmsgCgiData: ${JSON.stringify(win.__appmsgCgiData).substring(0, 300)}`)
          const cgiData = win.__appmsgCgiData
          if (cgiData.read_num !== undefined && readCount === null) {
            readCount = cgiData.read_num
            debugInfo.push(`✓ Got readCount from __appmsgCgiData: ${readCount}`)
          }
          if (cgiData.like_num !== undefined && likeCount === null) {
            likeCount = cgiData.like_num
            debugInfo.push(`✓ Got likeCount from __appmsgCgiData: ${likeCount}`)
          }
        }

        // 特别检查 biz_wvx
        if (win.biz_wvx) {
          if (win.biz_wvx.appmsg_read) {
            const data = win.biz_wvx.appmsg_read
            debugInfo.push(`biz_wvx.appmsg_read: ${JSON.stringify(data)}`)
            if (data.read_num !== undefined && readCount === null) {
              readCount = data.read_num
              debugInfo.push(`✓ Got readCount from biz_wvx: ${readCount}`)
            }
            if (data.like_num !== undefined && likeCount === null) {
              likeCount = data.like_num
              debugInfo.push(`✓ Got likeCount from biz_wvx: ${likeCount}`)
            }
            if (data.old_like_num !== undefined && likeCount === null) {
              likeCount = data.old_like_num
              debugInfo.push(`✓ Got likeCount from biz_wvx.old_like_num: ${likeCount}`)
            }
          }
        }

        // 检查 appmsgstat
        if (win.appmsgstat) {
          const stat = win.appmsgstat
          debugInfo.push(`appmsgstat: ${JSON.stringify(stat)}`)
          if (stat.read_num !== undefined && readCount === null) {
            readCount = stat.read_num
            debugInfo.push(`✓ Got readCount from appmsgstat: ${readCount}`)
          }
          if (stat.like_num !== undefined && likeCount === null) {
            likeCount = stat.like_num
            debugInfo.push(`✓ Got likeCount from appmsgstat: ${likeCount}`)
          }
        }

        // 尝试从页面内嵌的 script 标签中提取数据
        const scripts = document.querySelectorAll('script')
        scripts.forEach((script, index) => {
          const content = script.textContent || ''
          // 查找包含数字数据的脚本
          if (content.includes('read_num') || content.includes('like_num') || content.includes('appmsgstat')) {
            debugInfo.push(`Script ${index} contains data keywords (length: ${content.length})`)

            // 多种正则模式尝试提取
            const patterns = {
              read: [
                /["']read_num["']\s*:\s*(\d+)/,
                /read_num["\s:=]+(\d+)/,
                /readNum["\s:=]+(\d+)/,
                /"read_num":(\d+)/,
                /'read_num':(\d+)/
              ],
              like: [
                /["']like_num["']\s*:\s*(\d+)/,
                /like_num["\s:=]+(\d+)/,
                /likeNum["\s:=]+(\d+)/,
                /"like_num":(\d+)/,
                /'like_num':(\d+)/,
                /["']old_like_num["']\s*:\s*(\d+)/
              ],
              wow: [
                /["']wow_num["']\s*:\s*(\d+)/,
                /wow_num["\s:=]+(\d+)/,
                /"wow_num":(\d+)/
              ],
              share: [
                /["']share_num["']\s*:\s*(\d+)/,
                /share_num["\s:=]+(\d+)/,
                /"share_num":(\d+)/
              ],
              favorite: [
                /["']favorite_num["']\s*:\s*(\d+)/,
                /favorite_num["\s:=]+(\d+)/,
                /"favorite_num":(\d+)/
              ],
              comment: [
                /["']comment_count["']\s*:\s*(\d+)/,
                /comment_count["\s:=]+(\d+)/,
                /"comment_count":(\d+)/
              ]
            }

            // 尝试提取 read_num
            if (readCount === null) {
              for (const pattern of patterns.read) {
                const match = content.match(pattern)
                if (match && match[1]) {
                  readCount = parseInt(match[1], 10)
                  debugInfo.push(`✓ Got readCount from script ${index}: ${readCount}`)
                  break
                }
              }
            }

            // 尝试提取 like_num
            if (likeCount === null) {
              for (const pattern of patterns.like) {
                const match = content.match(pattern)
                if (match && match[1]) {
                  likeCount = parseInt(match[1], 10)
                  debugInfo.push(`✓ Got likeCount from script ${index}: ${likeCount}`)
                  break
                }
              }
            }

            // 尝试提取其他数据
            if (wowCount === null) {
              for (const pattern of patterns.wow) {
                const match = content.match(pattern)
                if (match && match[1]) {
                  wowCount = parseInt(match[1], 10)
                  debugInfo.push(`✓ Got wowCount from script ${index}: ${wowCount}`)
                  break
                }
              }
            }

            if (shareCount === null) {
              for (const pattern of patterns.share) {
                const match = content.match(pattern)
                if (match && match[1]) {
                  shareCount = parseInt(match[1], 10)
                  debugInfo.push(`✓ Got shareCount from script ${index}: ${shareCount}`)
                  break
                }
              }
            }

            if (favoriteCount === null) {
              for (const pattern of patterns.favorite) {
                const match = content.match(pattern)
                if (match && match[1]) {
                  favoriteCount = parseInt(match[1], 10)
                  debugInfo.push(`✓ Got favoriteCount from script ${index}: ${favoriteCount}`)
                  break
                }
              }
            }

            if (commentCount === null) {
              for (const pattern of patterns.comment) {
                const match = content.match(pattern)
                if (match && match[1]) {
                  commentCount = parseInt(match[1], 10)
                  debugInfo.push(`✓ Got commentCount from script ${index}: ${commentCount}`)
                  break
                }
              }
            }

            // 输出脚本片段用于调试（前200个字符）
            const snippet = content.substring(0, 200).replace(/\n/g, ' ')
            debugInfo.push(`  Script ${index} snippet: ${snippet}...`)
          }
        })
      } catch (e) {
        debugInfo.push(`Error accessing window: ${e}`)
      }

      // 方法3: 检查所有包含数字的元素（增强版）
      const numericElements = document.querySelectorAll('span, em, strong, div, p, a')
      let foundElements: string[] = []
      let suspiciousElements: string[] = []

      numericElements.forEach(el => {
        const text = el.textContent?.trim() || ''
        const id = el.id || ''
        const className = el.className || ''

        // 查找包含纯数字的元素
        if (/^\d+$/.test(text)) {
          const num = parseInt(text)
          if (num > 10 && num < 100000) { // 可能是数据的数字范围
            const info = `${el.tagName.toLowerCase()}${id ? '#' + id : ''}${className ? '.' + String(className).split(' ')[0] : ''} = "${text}"`
            if (foundElements.length < 30) {
              foundElements.push(info)
            }
          }
        }

        // 查找包含"数字+文字"的元素（如"阅读 8311"）
        if (/\d+/.test(text) && text.length < 30) {
          const keywords = ['阅读', '点赞', '在看', '转发', '分享', '收藏', '评论', '赞', '次', 'read', 'like', 'view', 'share']
          if (keywords.some(keyword => text.includes(keyword))) {
            const info = `${el.tagName}${id ? '#' + id : ''} = "${text}"`
            if (suspiciousElements.length < 20) {
              suspiciousElements.push(info)
            }
          }
        }
      })

      if (foundElements.length > 0) {
        debugInfo.push(`Pure numbers found: ${foundElements.join(' | ')}`)
      }

      if (suspiciousElements.length > 0) {
        debugInfo.push(`Keyword matches: ${suspiciousElements.join(' | ')}`)
      }

      return {
        readCount,
        likeCount,
        wowCount,
        shareCount,
        favoriteCount,
        commentCount,
        debugInfo
      }
    })

    // 记录调试信息
    logger.debug('数据提取调试信息', { debugInfo: stats.debugInfo })
    logger.info('提取到的统计数据', {
      readCount: stats.readCount,
      likeCount: stats.likeCount,
      wowCount: stats.wowCount,
      shareCount: stats.shareCount,
      favoriteCount: stats.favoriteCount,
      commentCount: stats.commentCount
    })

    return {
      readCount: stats.readCount,
      likeCount: stats.likeCount,
      wowCount: stats.wowCount,
      shareCount: stats.shareCount,
      favoriteCount: stats.favoriteCount,
      commentCount: stats.commentCount,
      isManualInput: stats.readCount === null && stats.likeCount === null
    }
  } catch (error) {
    logger.error('提取统计数据时出错', { error: error instanceof Error ? error.message : error })
    return {
      readCount: null,
      likeCount: null,
      wowCount: null,
      shareCount: null,
      favoriteCount: null,
      commentCount: null,
      isManualInput: true
    }
  }
}
