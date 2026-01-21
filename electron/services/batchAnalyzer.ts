import axios from 'axios'
import puppeteer from 'puppeteer'
import { logger } from './logger'
import { parseCookies, WechatCookies } from './wechatApi'

// 公众号信息
export interface AccountInfo {
  biz: string
  nickname: string
  avatar: string
  signature: string
}

// 文章摘要
export interface ArticleItem {
  title: string
  url: string
  cover: string
  digest: string
  publishTime: number
  author: string
  aid: string
  appmsgid: string
  itemidx: string
}

// 文章完整数据
export interface ArticleFullData {
  title: string
  url: string
  author: string
  publishTime: string
  readCount: number | null
  likeCount: number | null
  wowCount: number | null
  shareCount: number | null
  favoriteCount: number | null
  commentCount: number | null
  wordCount: number
  digest: string
}

/**
 * 从文章URL提取公众号biz参数
 * 支持短链接、长链接和历史消息页面链接
 */
export async function extractBizFromUrl(url: string): Promise<string | null> {
  try {
    logger.info('开始提取biz参数', { url })

    // 先尝试从URL参数中直接提取
    const urlObj = new URL(url)
    let biz = urlObj.searchParams.get('__biz')

    if (biz) {
      logger.info('从URL参数直接提取到biz', { biz: biz.substring(0, 20) })
      return biz
    }

    // 如果URL中没有biz参数，需要访问页面从HTML中提取
    // 这适用于短链接 (/s/xxx) 和其他形式的文章链接
    logger.info('URL参数中未找到biz，正在访问页面提取')

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    })

    try {
      const page = await browser.newPage()

      // 设置User-Agent为微信浏览器
      await page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.38(0x18002633) NetType/WIFI Language/zh_CN'
      )

      // 访问页面
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })

      // 获取重定向后的URL，尝试从URL提取
      const finalUrl = page.url()
      logger.info('页面最终URL', { finalUrl: finalUrl.substring(0, 150) })

      const finalUrlObj = new URL(finalUrl)
      biz = finalUrlObj.searchParams.get('__biz')

      // 如果URL中还是没有，从页面HTML中提取
      if (!biz) {
        logger.info('URL中未找到biz，尝试从HTML提取')

        // 获取页面HTML
        const html = await page.content()

        // biz 是 Base64 编码的字符串，通常格式如 MzkwMDY2NzIxNQ== (以字母开头，由字母数字组成，可能以=结尾)
        // Base64 编码的 biz 通常是 16-24 个字符

        // 使用全局匹配找出所有可能的 biz 值
        const allBizMatches: string[] = []

        // 从 URL 参数中提取（最可靠）
        const urlBizMatches = html.matchAll(/[?&]__biz=([A-Za-z0-9%+=]{12,30})/g)
        for (const m of urlBizMatches) {
          allBizMatches.push(m[1])
        }

        // 从 href 属性中提取
        const hrefBizMatches = html.matchAll(/href="[^"]*__biz=([A-Za-z0-9%+=]{12,30})[^"]*"/g)
        for (const m of hrefBizMatches) {
          allBizMatches.push(m[1])
        }

        // 从 JavaScript 变量中提取
        const jsBizMatches = html.matchAll(/(?:__biz|biz)\s*[:=]\s*["']([A-Za-z0-9+=]{12,30})["']/g)
        for (const m of jsBizMatches) {
          allBizMatches.push(m[1])
        }

        logger.debug('找到的所有潜在biz值', { count: allBizMatches.length, values: allBizMatches.slice(0, 5) })

        // 验证并选择第一个有效的 biz
        for (const candidateBiz of allBizMatches) {
          let decodedBiz = candidateBiz

          // 解码可能的URL编码
          if (decodedBiz.includes('%')) {
            try {
              decodedBiz = decodeURIComponent(decodedBiz)
            } catch {
              // 保持原值
            }
          }

          // 验证是否是有效的 Base64 格式：
          // 1. 以字母或数字开头（不是空格或特殊字符）
          // 2. 只包含 Base64 字符
          // 3. 长度在 12-30 之间（典型的 biz 编码长度）
          // 4. 不包含空格或加号开头（排除模板字符串如 ' + biz + '）
          if (
            decodedBiz.length >= 12 &&
            decodedBiz.length <= 30 &&
            /^[A-Za-z0-9][A-Za-z0-9+=]*$/.test(decodedBiz) &&
            !decodedBiz.includes(' ')
          ) {
            biz = decodedBiz
            logger.info('从HTML中提取到有效biz', { biz: biz })
            break
          }
        }
      }

      await browser.close()
    } catch (error) {
      await browser.close()
      throw error
    }

    if (!biz) {
      logger.warn('无法从页面提取__biz参数', { url })
      return null
    }

    logger.info('成功提取biz参数', { biz: biz.substring(0, 20) })
    return biz
  } catch (error) {
    logger.error('提取biz参数失败', { error: error instanceof Error ? error.message : error })
    return null
  }
}

/**
 * 生成公众号历史消息页面URL
 */
export function generateProfileUrl(biz: string): string {
  const profileUrl = `https://mp.weixin.qq.com/mp/profile_ext?action=home&__biz=${encodeURIComponent(biz)}&scene=124#wechat_redirect`
  logger.info('生成公众号历史消息页面', { url: profileUrl.substring(0, 100) })
  return profileUrl
}

/**
 * 获取公众号基本信息
 */
export async function fetchAccountInfo(
  biz: string,
  cookies: WechatCookies
): Promise<AccountInfo | null> {
  try {
    logger.info('开始获取公众号信息（使用Puppeteer）', { biz: biz.substring(0, 20) })

    // 使用 Puppeteer 来访问页面，更好地模拟真实浏览器
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      const page = await browser.newPage()

      // 设置 User-Agent
      await page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44'
      )

      // 设置 Cookie
      const cookieList = Object.entries(cookies)
        .filter(([_, value]) => value)
        .map(([name, value]) => ({
          name,
          value: value!,
          domain: 'mp.weixin.qq.com',
          path: '/'
        }))

      // 同时设置到多个域名
      const allCookies = [
        ...cookieList,
        ...cookieList.map(c => ({ ...c, domain: '.qq.com' })),
        ...cookieList.map(c => ({ ...c, domain: '.weixin.qq.com' }))
      ]

      await page.setCookie(...allCookies)

      // 访问公众号历史页面
      const profileUrl = generateProfileUrl(biz)
      await page.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 提取页面信息
      const result = await page.evaluate(() => {
        const html = document.documentElement.innerHTML

        // 检测验证页面
        if (document.title === '验证' ||
            html.includes('请在微信客户端打开') ||
            html.includes('请长按网址复制')) {
          return { error: 'verification_page' }
        }

        // 尝试从页面脚本提取信息
        const nicknameMatch = html.match(/var\s+nickname\s*=\s*["']([^"']+)["']/) ||
                              html.match(/"nickname"\s*:\s*"([^"]+)"/)
        const avatarMatch = html.match(/var\s+headimg\s*=\s*["']([^"']+)["']/) ||
                           html.match(/"headimg"\s*:\s*"([^"]+)"/)
        const signatureMatch = html.match(/var\s+signature\s*=\s*["']([^"']+)["']/) ||
                              html.match(/"signature"\s*:\s*"([^"]+)"/)

        return {
          nickname: nicknameMatch ? nicknameMatch[1] : null,
          avatar: avatarMatch ? avatarMatch[1] : '',
          signature: signatureMatch ? signatureMatch[1] : ''
        }
      })

      if ('error' in result) {
        logger.warn('Puppeteer访问返回验证页面，尝试直接获取文章验证Cookie')
        // 尝试直接调用 getmsg API 验证 Cookie
        const testResult = await testCookieByFetchingArticle(page, biz, cookies)
        if (testResult) {
          logger.info('✓ Cookie验证成功（通过获取文章）')
          return {
            biz,
            nickname: '公众号',  // 使用默认名称
            avatar: '',
            signature: ''
          }
        }
        throw new Error('Cookie 无效或已过期，请重新获取 Cookie')
      }

      if (!result.nickname) {
        // 尝试通过获取文章验证
        const testResult = await testCookieByFetchingArticle(page, biz, cookies)
        if (testResult) {
          logger.info('✓ Cookie验证成功（通过获取文章）')
          return {
            biz,
            nickname: '公众号',
            avatar: '',
            signature: ''
          }
        }
        throw new Error('无法获取公众号信息，Cookie 可能无效')
      }

      let nickname = result.nickname
      if (nickname.includes('的历史消息')) {
        nickname = nickname.replace('的历史消息', '').trim()
      }

      logger.info('✓ 公众号信息获取成功', { nickname, biz: biz.substring(0, 20) })

      return {
        biz,
        nickname,
        avatar: result.avatar,
        signature: result.signature
      }
    } finally {
      await browser.close()
    }
  } catch (error) {
    logger.error('获取公众号信息失败', {
      error: error instanceof Error ? error.message : error
    })
    // 重新抛出错误以便前端显示具体错误信息
    throw error
  }
}

/**
 * 通过获取文章来测试 Cookie 是否有效
 */
async function testCookieByFetchingArticle(
  page: puppeteer.Page,
  biz: string,
  cookies: WechatCookies
): Promise<boolean> {
  try {
    const apiUrl = `https://mp.weixin.qq.com/mp/profile_ext?action=getmsg&__biz=${encodeURIComponent(biz)}&f=json&offset=0&count=1&is_ok=1&scene=124&uin=${encodeURIComponent(cookies.uin || '')}&key=${encodeURIComponent(cookies.key || '')}&pass_ticket=${encodeURIComponent(cookies.pass_ticket || '')}&appmsg_token=${encodeURIComponent(cookies.appmsg_token || '')}&x5=0&_=${Date.now()}`

    const response = await page.evaluate(async (url: string) => {
      try {
        const res = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        })
        return await res.json()
      } catch {
        return null
      }
    }, apiUrl)

    if (response && response.ret === 0) {
      return true
    }

    logger.debug('通过获取文章验证Cookie失败', { ret: response?.ret, errmsg: response?.errmsg })
    return false
  } catch (error) {
    logger.debug('testCookieByFetchingArticle 异常', {
      error: error instanceof Error ? error.message : error
    })
    return false
  }
}

/**
 * 获取公众号文章列表
 */
export async function fetchArticleList(
  biz: string,
  cookies: WechatCookies,
  offset: number = 0,
  count: number = 10
): Promise<{ list: ArticleItem[], canLoadMore: boolean }> {
  try {
    const apiUrl = 'https://mp.weixin.qq.com/mp/profile_ext'

    const cookieHeader = Object.entries(cookies)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')

    logger.info('开始获取文章列表', {
      offset,
      count,
      hasUin: !!cookies.uin,
      hasKey: !!cookies.key,
      hasAppmsgToken: !!cookies.appmsg_token,
      hasPassTicket: !!cookies.pass_ticket,
      cookieKeys: Object.keys(cookies)
    })

    const response = await axios.get(apiUrl, {
      params: {
        action: 'getmsg',
        __biz: biz,
        f: 'json',
        offset,
        count,
        is_ok: 1,
        scene: 124,
        uin: cookies.uin || '',
        key: cookies.key || '',
        pass_ticket: cookies.pass_ticket || '',
        wxtoken: '',
        appmsg_token: cookies.appmsg_token || '',
        x5: 0,
        // 添加时间戳避免缓存
        _: Date.now()
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44',
        'Cookie': cookieHeader,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': generateProfileUrl(biz),
        'Host': 'mp.weixin.qq.com'
      },
      timeout: 15000
    })

    const data = response.data

    if (data.ret !== 0) {
      logger.error('API返回错误', {
        ret: data.ret,
        errmsg: data.errmsg,
        requestUrl: `${apiUrl}?action=getmsg&__biz=${biz.substring(0, 20)}...`,
        responseData: JSON.stringify(data).substring(0, 500)
      })
      throw new Error(data.errmsg || `API错误: ${data.ret}`)
    }

    const generalMsgList = JSON.parse(data.general_msg_list || '{"list":[]}')
    const articles: ArticleItem[] = []

    // 解析文章列表
    for (const msg of generalMsgList.list) {
      if (msg.app_msg_ext_info) {
        const item = msg.app_msg_ext_info
        articles.push({
          title: item.title,
          url: item.content_url,
          cover: item.cover,
          digest: item.digest,
          publishTime: msg.comm_msg_info.datetime,
          author: item.author,
          aid: item.aid || '',
          appmsgid: item.appmsgid || '',
          itemidx: item.itemidx || '1'
        })

        // 处理多图文
        if (item.multi_app_msg_item_list && item.multi_app_msg_item_list.length > 0) {
          for (const subItem of item.multi_app_msg_item_list) {
            articles.push({
              title: subItem.title,
              url: subItem.content_url,
              cover: subItem.cover,
              digest: subItem.digest,
              publishTime: msg.comm_msg_info.datetime,
              author: subItem.author,
              aid: subItem.aid || '',
              appmsgid: subItem.appmsgid || '',
              itemidx: subItem.itemidx || '1'
            })
          }
        }
      }
    }

    const canLoadMore = data.can_msg_continue === 1

    logger.info('✓ 文章列表获取成功', {
      count: articles.length,
      canLoadMore,
      nextOffset: data.next_offset
    })

    return {
      list: articles,
      canLoadMore
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('API请求失败', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Cookie已过期或无效，请重新获取')
      }
    }

    logger.error('获取文章列表失败', {
      error: error instanceof Error ? error.message : error
    })
    throw error
  }
}

/**
 * 批量获取所有文章
 * @param maxCount 最大获取数量，0 表示获取全部
 */
export async function fetchAllArticles(
  biz: string,
  cookies: WechatCookies,
  maxCount: number = 100,
  onProgress?: (current: number, total: number) => void
): Promise<ArticleItem[]> {
  const allArticles: ArticleItem[] = []
  let offset = 0
  const batchSize = 10
  const isUnlimited = maxCount === 0

  logger.info('开始批量获取文章', { maxCount: isUnlimited ? '不限' : maxCount })

  try {
    while (true) {
      const result = await fetchArticleList(biz, cookies, offset, batchSize)

      allArticles.push(...result.list)
      offset += batchSize

      if (onProgress) {
        onProgress(allArticles.length, isUnlimited ? 0 : maxCount)
      }

      logger.info('已获取文章', { current: allArticles.length, total: isUnlimited ? '不限' : maxCount })

      // 检查是否还有更多文章
      if (!result.canLoadMore || result.list.length === 0) {
        logger.info('已获取所有文章', { total: allArticles.length })
        break
      }

      // 如果不是无限制模式，检查是否已达到上限
      if (!isUnlimited && allArticles.length >= maxCount) {
        logger.info('已达到设置的最大数量', { total: allArticles.length })
        break
      }

      // 避免请求过快被限制，使用1-25秒随机延迟
      const delay = Math.floor(Math.random() * 24000) + 1000 // 1000-25000ms (1-25秒)
      logger.info('等待随机延迟', { delaySeconds: (delay / 1000).toFixed(1) })
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    // 如果不是无限制模式，截取到最大数量
    return isUnlimited ? allArticles : allArticles.slice(0, maxCount)
  } catch (error) {
    logger.error('批量获取文章失败', {
      error: error instanceof Error ? error.message : error,
      fetched: allArticles.length
    })

    // 即使失败也返回已获取的文章
    return allArticles
  }
}

export type { WechatCookies }
