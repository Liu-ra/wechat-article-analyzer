import axios from 'axios'
import { logger } from './logger'

// Cookie 存储
export interface WechatCookies {
  key?: string
  pass_ticket?: string
  uin?: string
  appmsg_token?: string
  [key: string]: string | undefined
}

// 文章参数
interface ArticleParams {
  biz: string
  mid: string
  idx: string
  sn: string
}

// API 响应数据
interface AppmsgExtResponse {
  appmsgstat?: {
    read_num?: number
    like_num?: number
    old_like_num?: number
    ret?: number
    real_read_num?: number
    is_need_update?: number
  }
  comment_count?: number
  reward_head_imgs?: any[]
  reward_total_count?: number
  ret?: number
  msg?: string
}

/**
 * 从 Cookie 字符串解析为对象
 */
export function parseCookies(cookieString: string): WechatCookies {
  const cookies: WechatCookies = {}

  try {
    // 支持多种格式：
    // 1. key=value; key2=value2 (标准格式)
    // 2. key=value\nkey2=value2 (换行分隔)
    // 3. JSON 格式

    if (cookieString.trim().startsWith('{')) {
      // JSON 格式
      return JSON.parse(cookieString)
    }

    // 标准格式或换行分隔
    const pairs = cookieString.split(/[;\n]/).map(s => s.trim()).filter(s => s)

    for (const pair of pairs) {
      const idx = pair.indexOf('=')
      if (idx > 0) {
        const key = pair.substring(0, idx).trim()
        const value = pair.substring(idx + 1).trim()
        cookies[key] = value
      }
    }

    logger.info('Cookie 解析成功', {
      keys: Object.keys(cookies),
      hasKey: !!cookies.key,
      hasPassTicket: !!cookies.pass_ticket,
      hasUin: !!cookies.uin
    })

    return cookies
  } catch (error) {
    logger.error('Cookie 解析失败', { error: error instanceof Error ? error.message : String(error) })
    throw new Error('Cookie 格式错误，请检查格式')
  }
}

/**
 * 从文章 URL 提取参数
 */
export function extractArticleParams(url: string): ArticleParams | null {
  try {
    const urlObj = new URL(url)
    const params = urlObj.searchParams

    const biz = params.get('__biz') || ''
    const mid = params.get('mid') || ''
    const idx = params.get('idx') || '1'
    const sn = params.get('sn') || ''

    if (!biz || !mid || !sn) {
      logger.warn('URL 参数不完整', { biz, mid, sn })
      return null
    }

    logger.info('URL 参数提取成功', { biz: biz.substring(0, 20), mid, idx, sn: sn.substring(0, 20) })

    return { biz, mid, idx, sn }
  } catch (error) {
    logger.error('URL 解析失败', { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

/**
 * 调用微信 getappmsgext API 获取文章数据
 */
export async function fetchArticleStats(
  url: string,
  cookies: WechatCookies
): Promise<{
  readCount: number | null
  likeCount: number | null
  wowCount: number | null
  commentCount: number | null
}> {
  logger.info('开始调用微信 API 获取数据', { url: url.substring(0, 100) })

  // 提取文章参数
  const params = extractArticleParams(url)
  if (!params) {
    throw new Error('无法从 URL 提取文章参数，请检查链接格式')
  }

  // 检查必需的 cookies
  if (!cookies.key && !cookies.appmsg_token) {
    throw new Error('缺少必需的 Cookie：key 或 appmsg_token')
  }

  // 构建 API URL
  const apiUrl = 'https://mp.weixin.qq.com/mp/getappmsgext'

  // 构建请求参数
  const requestParams: any = {
    __biz: params.biz,
    mid: params.mid,
    sn: params.sn,
    idx: params.idx,
    is_only_read: '1',
    req_id: Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  // 添加 appmsg_token（如果有）
  if (cookies.appmsg_token) {
    requestParams.appmsg_token = cookies.appmsg_token
  }

  // 构建 Cookie 头
  const cookieHeader = Object.entries(cookies)
    .filter(([_, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')

  logger.debug('API 请求参数', {
    url: apiUrl,
    params: requestParams,
    hasCookie: !!cookieHeader
  })

  try {
    // 发送请求
    const response = await axios.get<AppmsgExtResponse>(apiUrl, {
      params: requestParams,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MicroMessenger/8.0.44',
        'Referer': url,
        'Cookie': cookieHeader,
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 15000
    })

    logger.info('API 响应成功', {
      status: response.status,
      data: JSON.stringify(response.data).substring(0, 500)
    })

    // 解析响应数据
    const data = response.data

    if (data.ret && data.ret !== 0) {
      logger.error('API 返回错误', { ret: data.ret, msg: data.msg })
      throw new Error(data.msg || `API 错误: ${data.ret}`)
    }

    // 提取数据
    const result = {
      readCount: data.appmsgstat?.read_num || data.appmsgstat?.real_read_num || null,
      likeCount: data.appmsgstat?.like_num || data.appmsgstat?.old_like_num || null,
      wowCount: null, // 在看数通常需要单独的接口
      commentCount: data.comment_count || null
    }

    logger.info('✓ 数据提取成功', result)

    return result
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('API 请求失败', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Cookie 已过期或无效，请重新获取')
      } else if (error.response?.status === 404) {
        throw new Error('文章不存在或已被删除')
      } else {
        throw new Error(`API 请求失败: ${error.message}`)
      }
    } else {
      logger.error('未知错误', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }
}

/**
 * 验证 Cookie 是否有效
 */
export async function validateCookies(cookies: WechatCookies): Promise<boolean> {
  try {
    // 基本验证：至少需要 pass_ticket 或 wap_sid2
    if (!cookies.pass_ticket && !cookies.wap_sid2) {
      logger.warn('Cookie 缺少基本认证字段 (pass_ticket 或 wap_sid2)')
      return false
    }

    // 警告：如果缺少 key 或 appmsg_token，获取文章列表可能会失败
    if (!cookies.key && !cookies.appmsg_token) {
      logger.warn('Cookie 缺少 key 或 appmsg_token，获取文章列表时可能需要这些字段')
    }

    logger.info('Cookie 基本验证通过')
    return true
  } catch (error) {
    logger.error('Cookie 验证失败', { error })
    return false
  }
}
