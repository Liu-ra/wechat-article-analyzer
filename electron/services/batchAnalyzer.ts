import axios from 'axios'
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
 */
export function extractBizFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const biz = urlObj.searchParams.get('__biz')

    if (!biz) {
      logger.warn('URL中未找到__biz参数', { url })
      return null
    }

    logger.info('成功提取biz参数', { biz: biz.substring(0, 20) })
    return biz
  } catch (error) {
    logger.error('URL解析失败', { error: error instanceof Error ? error.message : error })
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
    const profileUrl = generateProfileUrl(biz)

    const cookieHeader = Object.entries(cookies)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')

    logger.info('开始获取公众号信息', { biz: biz.substring(0, 20) })

    const response = await axios.get(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44',
        'Cookie': cookieHeader,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      },
      timeout: 15000
    })

    // 从HTML中提取公众号信息
    const html = response.data

    // 提取昵称
    const nicknameMatch = html.match(/var\s+nickname\s*=\s*"([^"]+)"/) ||
                          html.match(/nickname:\s*"([^"]+)"/)
    const nickname = nicknameMatch ? nicknameMatch[1] : '未知公众号'

    // 提取头像
    const avatarMatch = html.match(/var\s+headimg\s*=\s*"([^"]+)"/) ||
                       html.match(/headimg:\s*"([^"]+)"/)
    const avatar = avatarMatch ? avatarMatch[1] : ''

    // 提取签名
    const signatureMatch = html.match(/var\s+signature\s*=\s*"([^"]+)"/) ||
                          html.match(/signature:\s*"([^"]+)"/)
    const signature = signatureMatch ? signatureMatch[1] : ''

    logger.info('✓ 公众号信息获取成功', { nickname, biz: biz.substring(0, 20) })

    return {
      biz,
      nickname,
      avatar,
      signature
    }
  } catch (error) {
    logger.error('获取公众号信息失败', {
      error: error instanceof Error ? error.message : error
    })
    return null
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

    logger.info('开始获取文章列表', { offset, count })

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
        x5: 0
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44',
        'Cookie': cookieHeader,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': generateProfileUrl(biz)
      },
      timeout: 15000
    })

    const data = response.data

    if (data.ret !== 0) {
      logger.error('API返回错误', { ret: data.ret, errmsg: data.errmsg })
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

  logger.info('开始批量获取文章', { maxCount })

  try {
    while (allArticles.length < maxCount) {
      const result = await fetchArticleList(biz, cookies, offset, batchSize)

      allArticles.push(...result.list)
      offset += batchSize

      if (onProgress) {
        onProgress(allArticles.length, maxCount)
      }

      logger.info('已获取文章', { current: allArticles.length, total: maxCount })

      if (!result.canLoadMore || result.list.length === 0) {
        logger.info('已获取所有文章', { total: allArticles.length })
        break
      }

      // 避免请求过快被限制
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return allArticles.slice(0, maxCount)
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
