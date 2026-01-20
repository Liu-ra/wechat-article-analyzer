import http from 'http'
import https from 'https'
import net from 'net'
import tls from 'tls'
import { logger } from './logger'
import { generateCACertificate, generateServerCertificate } from './certificateManager'

interface ProxyConfig {
  port: number
  onCookieFound: (cookieString: string) => void
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

      // 转发到真实服务器
      forwardToRealServer(host, port, data, tlsSocket)
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
function forwardToRealServer(host: string, port: number, data: Buffer, clientTlsSocket: tls.TLSSocket) {
  const serverSocket = tls.connect(
    {
      host,
      port,
      servername: host
    },
    () => {
      // 发送请求
      serverSocket.write(data)

      // 双向转发数据
      serverSocket.pipe(clientTlsSocket)
      clientTlsSocket.pipe(serverSocket)
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
