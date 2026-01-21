import http from 'http'
import https from 'https'
import net from 'net'
import tls from 'tls'
import zlib from 'zlib'
import { logger } from './logger'
import { generateCACertificate, generateServerCertificate } from './certificateManager'

interface ArticleData {
  title: string
  url: string
  cover: string
  digest: string
  publishTime: number
  author: string
}

interface ProxyConfig {
  port: number
  onCookieFound: (cookieString: string) => void
  onArticlesFound?: (articles: ArticleData[], nickname?: string) => void
}

// 存储捕获的文章数据
let capturedArticles: ArticleData[] = []
let capturedNickname: string = ''

/**
 * 获取已捕获的文章列表
 */
export function getCapturedArticles(): { articles: ArticleData[], nickname: string } {
  return { articles: capturedArticles, nickname: capturedNickname }
}

/**
 * 清空已捕获的文章列表
 */
export function clearCapturedArticles(): void {
  capturedArticles = []
  capturedNickname = ''
}

let server: http.Server | null = null
let caCert: string = ''
let caKey: string = ''
let isClosing = false // 标记服务器是否正在关闭

// 缓存服务器证书
const certCache = new Map<string, { cert: string; key: string }>()

/**
 * 启动代理服务器来捕获微信Cookie（支持HTTPS解密）
 */
export function startProxyServer(config: ProxyConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      return reject(new Error('代理服务器已在运行'))
    }

    isClosing = false // 重置关闭标志
    logger.info('启动HTTPS解密代理服务器', { port: config.port })

    // 生成或加载CA证书
    const ca = generateCACertificate()
    caCert = ca.cert
    caKey = ca.key

    server = http.createServer((clientReq, clientRes) => {
      // 处理HTTP请求
      handleHttpRequest(clientReq, clientRes, config)
    })

    // 处理HTTPS CONNECT请求
    server.on('connect', (req, clientSocket, head) => {
      handleHttpsConnect(req, clientSocket, head, config)
    })

    server.listen(config.port, '127.0.0.1', () => {
      logger.info('HTTPS解密代理服务器启动成功', {
        port: config.port,
        address: `http://127.0.0.1:${config.port}`
      })
      resolve()
    })

    server.on('error', (err) => {
      logger.error('代理服务器启动失败', { error: (err as Error).message })
      server = null
      reject(err)
    })
  })
}

/**
 * 处理HTTP请求
 */
function handleHttpRequest(
  clientReq: http.IncomingMessage,
  clientRes: http.ServerResponse,
  config: ProxyConfig
) {
  const url = clientReq.url || ''
  const host = clientReq.headers.host || ''

  logger.debug('HTTP请求', { host, url, method: clientReq.method })

  // 检查并提取完整Cookie
  checkAndExtractCompleteCookie(url, clientReq.headers.cookie || '', host, config)

  // 转发请求
  const options: http.RequestOptions = {
    hostname: host.split(':')[0],
    port: parseInt(host.split(':')[1] || '80'),
    path: url,
    method: clientReq.method,
    headers: clientReq.headers
  }

  const proxyReq = http.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
    proxyRes.pipe(clientRes)
  })

  proxyReq.on('error', (err) => {
    logger.error('HTTP请求失败', { error: err.message })
    clientRes.writeHead(502)
    clientRes.end('Bad Gateway')
  })

  clientReq.pipe(proxyReq)
}

/**
 * 处理HTTPS CONNECT请求（中间人解密）
 */
function handleHttpsConnect(
  req: http.IncomingMessage,
  clientSocket: net.Socket,
  head: Buffer,
  config: ProxyConfig
) {
  const { host, port } = parseHostPort(req.url || '')

  logger.debug('HTTPS CONNECT', { host, port })

  // 检查是否是微信域名
  const isWechatDomain = host.includes('mp.weixin.qq.com')

  if (!isWechatDomain) {
    // 非微信域名，直接透传
    tunnelConnection(host, port, clientSocket, head)
    return
  }

  logger.info('检测到微信HTTPS连接，开始解密', { host })

  // 为目标域名生成服务器证书
  let serverCert = certCache.get(host)
  if (!serverCert) {
    serverCert = generateServerCertificate(host, caCert, caKey)
    certCache.set(host, serverCert)
    logger.debug('为域名生成证书', { host })
  }

  // 向客户端返回Connection Established
  clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

  // 与客户端建立TLS连接（使用生成的服务器证书）
  const tlsOptions: tls.TlsOptions = {
    key: serverCert.key,
    cert: serverCert.cert,
    isServer: true
  }

  const tlsSocket = new tls.TLSSocket(clientSocket, tlsOptions)

  // 处理解密后的HTTPS请求
  tlsSocket.on('data', (data) => {
    try {
      // 解析HTTP请求
      const requestStr = data.toString()
      const lines = requestStr.split('\r\n')
      const requestLine = lines[0]

      // 提取请求路径
      const requestParts = requestLine.split(' ')
      const requestPath = requestParts.length > 1 ? requestParts[1] : ''

      // 提取Cookie header
      let cookieHeader = ''
      for (const line of lines) {
        if (line.toLowerCase().startsWith('cookie:')) {
          cookieHeader = line.substring(7).trim()
          break
        }
      }

      // 检查并提取完整Cookie（包括URL参数）
      checkAndExtractCompleteCookie(requestPath, cookieHeader, host, config)

      // 检查是否是 getmsg 请求，需要捕获响应
      const isGetmsgRequest = requestPath.includes('action=getmsg')

      // 转发到真实服务器
      forwardToRealServer(host, port, data, tlsSocket, isGetmsgRequest, config)
    } catch (err) {
      logger.error('处理解密请求失败', { error: err instanceof Error ? err.message : String(err) })
    }
  })

  tlsSocket.on('error', (err) => {
    // 如果服务器正在关闭，降低日志级别
    if (isClosing) {
      logger.debug('TLS连接错误（服务器关闭中）', { error: err.message, host })
    } else {
      logger.error('TLS连接错误', { error: err.message, host })
    }
    try {
      clientSocket.end()
    } catch (e) {
      // 忽略关闭时的错误
    }
  })
}

/**
 * 转发到真实服务器
 */
function forwardToRealServer(
  host: string,
  port: number,
  data: Buffer,
  clientTlsSocket: tls.TLSSocket,
  captureResponse: boolean = false,
  config?: ProxyConfig
) {
  const serverSocket = tls.connect(
    {
      host,
      port,
      servername: host
    },
    () => {
      // 发送请求
      serverSocket.write(data)

      if (captureResponse && config) {
        // 需要捕获响应数据
        const responseChunks: Buffer[] = []

        serverSocket.on('data', (chunk) => {
          responseChunks.push(chunk)
          // 同时转发给客户端
          clientTlsSocket.write(chunk)
        })

        serverSocket.on('end', () => {
          // 解析响应
          try {
            const fullResponse = Buffer.concat(responseChunks)
            parseAndStoreArticles(fullResponse, config)
          } catch (err) {
            logger.debug('解析getmsg响应失败', { error: err instanceof Error ? err.message : String(err) })
          }
          clientTlsSocket.end()
        })

        // 仍然允许客户端向服务器发送数据
        clientTlsSocket.pipe(serverSocket)
      } else {
        // 普通双向转发
        serverSocket.pipe(clientTlsSocket)
        clientTlsSocket.pipe(serverSocket)
      }
    }
  )

  serverSocket.on('error', (err) => {
    if (isClosing) {
      logger.debug('连接真实服务器失败（服务器关闭中）', { error: err.message, host })
    } else {
      logger.error('连接真实服务器失败', { error: err.message, host })
    }
    try {
      clientTlsSocket.end()
    } catch (e) {
      // 忽略关闭时的错误
    }
  })
}

/**
 * 从chunked编码的body中提取实际数据
 */
function extractChunkedBody(chunkedBody: Buffer): Buffer {
  const chunks: Buffer[] = []
  let offset = 0

  while (offset < chunkedBody.length) {
    // 找到chunk size行的结束位置
    let lineEnd = -1
    for (let i = offset; i < chunkedBody.length - 1; i++) {
      if (chunkedBody[i] === 0x0d && chunkedBody[i + 1] === 0x0a) {
        lineEnd = i
        break
      }
    }
    if (lineEnd === -1) break

    // 解析chunk size（十六进制）
    const sizeLine = chunkedBody.slice(offset, lineEnd).toString('utf-8').trim()
    const chunkSize = parseInt(sizeLine, 16)
    if (isNaN(chunkSize) || chunkSize === 0) break

    // 读取chunk数据
    const chunkStart = lineEnd + 2
    const chunkEnd = chunkStart + chunkSize
    if (chunkEnd > chunkedBody.length) break

    chunks.push(chunkedBody.slice(chunkStart, chunkEnd))

    // 跳过chunk末尾的\r\n
    offset = chunkEnd + 2
  }

  return Buffer.concat(chunks)
}

/**
 * 解析并存储文章数据
 */
function parseAndStoreArticles(response: Buffer, config: ProxyConfig) {
  try {
    // 找到HTTP header和body的分界点
    const headerEndMarker = Buffer.from('\r\n\r\n')
    let headerEndIndex = -1
    for (let i = 0; i <= response.length - 4; i++) {
      if (response[i] === 0x0d && response[i + 1] === 0x0a &&
          response[i + 2] === 0x0d && response[i + 3] === 0x0a) {
        headerEndIndex = i
        break
      }
    }
    if (headerEndIndex === -1) return

    // 分离header和body
    const headerPart = response.slice(0, headerEndIndex).toString('utf-8')
    let bodyBuffer = response.slice(headerEndIndex + 4)

    // 检查是否是gzip压缩
    const isGzip = headerPart.toLowerCase().includes('content-encoding: gzip')

    // 如果是gzip压缩，解压
    if (isGzip) {
      try {
        // 处理chunked编码：提取实际的body数据
        if (headerPart.toLowerCase().includes('transfer-encoding: chunked')) {
          bodyBuffer = extractChunkedBody(bodyBuffer)
        }
        bodyBuffer = zlib.gunzipSync(bodyBuffer)
        logger.debug('成功解压gzip数据', { decompressedSize: bodyBuffer.length })
      } catch (gzipErr) {
        logger.debug('gzip解压失败', { error: gzipErr instanceof Error ? gzipErr.message : String(gzipErr) })
        return
      }
    }

    let body = bodyBuffer.toString('utf-8')

    // 处理 chunked 编码（如果是未压缩的chunked）
    if (!isGzip && headerPart.toLowerCase().includes('transfer-encoding: chunked')) {
      // 简单处理：尝试提取JSON部分
      const jsonStart = body.indexOf('{')
      const jsonEnd = body.lastIndexOf('}')
      if (jsonStart !== -1 && jsonEnd !== -1) {
        body = body.substring(jsonStart, jsonEnd + 1)
      }
    }

    const data = JSON.parse(body)

    if (data.ret !== 0) {
      logger.debug('getmsg响应ret非0', { ret: data.ret })
      return
    }

    // 提取公众号昵称
    if (data.nickname && !capturedNickname) {
      capturedNickname = data.nickname
      logger.info('✓ 捕获到公众号昵称', { nickname: capturedNickname })
    }

    // 解析文章列表
    const generalMsgList = JSON.parse(data.general_msg_list || '{"list":[]}')
    const newArticles: ArticleData[] = []

    for (const msg of generalMsgList.list) {
      if (msg.app_msg_ext_info) {
        const item = msg.app_msg_ext_info
        newArticles.push({
          title: item.title,
          url: item.content_url,
          cover: item.cover,
          digest: item.digest,
          publishTime: msg.comm_msg_info?.datetime || 0,
          author: item.author || ''
        })

        // 处理多图文
        if (item.multi_app_msg_item_list && item.multi_app_msg_item_list.length > 0) {
          for (const subItem of item.multi_app_msg_item_list) {
            newArticles.push({
              title: subItem.title,
              url: subItem.content_url,
              cover: subItem.cover,
              digest: subItem.digest,
              publishTime: msg.comm_msg_info?.datetime || 0,
              author: subItem.author || ''
            })
          }
        }
      }
    }

    if (newArticles.length > 0) {
      // 去重后添加到已捕获列表
      const existingUrls = new Set(capturedArticles.map(a => a.url))
      const uniqueNewArticles = newArticles.filter(a => !existingUrls.has(a.url))
      capturedArticles.push(...uniqueNewArticles)

      logger.info('✓ 捕获到文章列表', {
        newCount: uniqueNewArticles.length,
        totalCount: capturedArticles.length
      })

      // 通知回调
      if (config.onArticlesFound) {
        config.onArticlesFound(capturedArticles, capturedNickname)
      }
    }
  } catch (err) {
    logger.debug('解析文章数据失败', { error: err instanceof Error ? err.message : String(err) })
  }
}

/**
 * 透传连接（不解密）
 */
function tunnelConnection(host: string, port: number, clientSocket: net.Socket, head: Buffer) {
  const serverSocket = net.connect(port, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    serverSocket.write(head)
    serverSocket.pipe(clientSocket)
    clientSocket.pipe(serverSocket)
  })

  serverSocket.on('error', (err) => {
    if (isClosing) {
      logger.debug('隧道连接失败（服务器关闭中）', { error: err.message, host })
    } else {
      logger.error('隧道连接失败', { error: err.message, host })
    }
    try {
      clientSocket.end()
    } catch (e) {
      // 忽略关闭时的错误
    }
  })
}

/**
 * 检查并提取完整Cookie（包括URL参数中的uin、key、appmsg_token）
 */
function checkAndExtractCompleteCookie(
  requestPath: string,
  cookieHeader: string,
  host: string,
  config: ProxyConfig
) {
  if (!cookieHeader || !host.includes('mp.weixin.qq.com')) return

  logger.debug('捕获到微信请求', {
    path: requestPath.substring(0, 100),
    cookieLength: cookieHeader.length,
    host
  })

  // 检查是否是 getmsg 请求
  if (!requestPath.includes('action=getmsg')) {
    return
  }

  logger.info('检测到 action=getmsg 请求，开始提取完整Cookie')

  try {
    // 解析URL参数
    const url = new URL(requestPath, `https://${host}`)
    const params = url.searchParams

    const uin = params.get('uin')
    const key = params.get('key')
    const appmsgToken = params.get('appmsg_token')

    // 解析现有Cookie
    const cookies = parseCookieString(cookieHeader)

    // 添加URL参数到Cookie中
    if (uin) {
      // uin 可能已经是 URL 编码的，需要解码
      cookies.uin = decodeURIComponent(uin)
    }
    if (key) {
      cookies.key = key
    }
    if (appmsgToken) {
      cookies.appmsg_token = decodeURIComponent(appmsgToken)
    }

    // 检查是否有关键字段
    if (cookies.key || cookies.appmsg_token) {
      // 重新组合Cookie字符串
      const completeCookie = Object.entries(cookies)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')

      logger.info('✓ 成功提取完整Cookie', {
        hasUin: !!cookies.uin,
        hasKey: !!cookies.key,
        hasAppmsgToken: !!cookies.appmsg_token,
        hasPassTicket: !!cookies.pass_ticket,
        hasWapSid2: !!cookies.wap_sid2,
        cookieLength: completeCookie.length,
        allCookieKeys: Object.keys(cookies),
        cookiePreview: completeCookie.substring(0, 200) + '...'
      })

      config.onCookieFound(completeCookie)
    } else {
      logger.warn('Cookie 缺少关键字段 key 或 appmsg_token')
    }
  } catch (err) {
    logger.error('提取完整Cookie失败', {
      error: err instanceof Error ? err.message : String(err)
    })
  }
}

/**
 * 解析Cookie字符串为对象
 */
function parseCookieString(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  // 使用分号分割，保留空格
  const pairs = cookieStr.split(';').map(s => s.trim()).filter(s => s)

  for (const pair of pairs) {
    const idx = pair.indexOf('=')
    if (idx > 0) {
      const key = pair.substring(0, idx).trim()
      const value = pair.substring(idx + 1).trim()
      if (key && value) {  // 确保key和value都存在
        cookies[key] = value
      }
    }
  }

  return cookies
}

/**
 * 停止代理服务器
 */
export function stopProxyServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server) {
      logger.info('代理服务器未运行，无需停止')
      isClosing = false
      return resolve()
    }

    logger.info('停止代理服务器')
    isClosing = true // 设置关闭标志

    // 设置超时，避免永久等待
    const timeout = setTimeout(() => {
      logger.warn('停止代理服务器超时，强制完成')
      server = null
      certCache.clear()
      isClosing = false
      resolve()
    }, 3000) // 3秒超时

    try {
      // 清空证书缓存
      certCache.clear()

      // 关闭服务器
      server.close((err) => {
        clearTimeout(timeout)

        if (err) {
          logger.error('关闭代理服务器时出错', { error: err.message })
        } else {
          logger.info('代理服务器已停止')
        }

        server = null
        isClosing = false
        resolve()
      })

      // 立即停止接受新连接
      server.unref()
    } catch (err) {
      clearTimeout(timeout)
      logger.error('停止代理服务器异常', { error: err instanceof Error ? err.message : String(err) })
      server = null
      certCache.clear()
      isClosing = false
      resolve() // 即使出错也resolve，避免阻塞
    }
  })
}

/**
 * 检查代理服务器是否运行中
 */
export function isProxyRunning(): boolean {
  return server !== null
}

/**
 * 解析host:port
 */
function parseHostPort(url: string): { host: string; port: number } {
  const [host, portStr] = url.split(':')
  const port = portStr ? parseInt(portStr, 10) : 443
  return { host, port }
}

/**
 * 获取CA证书路径（用于安装）
 */
export function getCACertPath(): string {
  const ca = generateCACertificate()
  return ca.certPath
}
