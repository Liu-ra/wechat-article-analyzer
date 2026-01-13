import { BrowserWindow } from 'electron'
import { logger } from './logger'

/**
 * 打开微信登录窗口并自动获取Cookie
 */
export async function autoGetCookie(profileUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    logger.info('开始自动获取Cookie', { url: profileUrl.substring(0, 100) })

    // 创建新的浏览器窗口
    const cookieWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: '微信登录 - 请扫码登录',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    })

    // 定期检查Cookie
    const checkInterval = setInterval(async () => {
      try {
        const cookies = await cookieWindow.webContents.session.cookies.get({
          url: 'https://mp.weixin.qq.com'
        })

        // 检查是否已获取到关键Cookie（key或appmsg_token）
        const hasKey = cookies.some(c => c.name === 'key')
        const hasToken = cookies.some(c => c.name === 'appmsg_token')

        if (hasKey || hasToken) {
          logger.info('成功获取Cookie', {
            cookieCount: cookies.length,
            hasKey,
            hasToken
          })

          // 转换为Cookie字符串
          const cookieString = cookies
            .map(c => `${c.name}=${c.value}`)
            .join('; ')

          clearInterval(checkInterval)
          cookieWindow.close()
          resolve(cookieString)
        }
      } catch (error) {
        logger.error('检查Cookie失败', { error: error instanceof Error ? error.message : error })
      }
    }, 2000) // 每2秒检查一次

    // 设置超时（5分钟）
    const timeout = setTimeout(() => {
      clearInterval(checkInterval)
      if (!cookieWindow.isDestroyed()) {
        cookieWindow.close()
      }
      logger.warn('Cookie获取超时')
      resolve(null)
    }, 5 * 60 * 1000)

    // 窗口关闭时清理
    cookieWindow.on('closed', () => {
      clearInterval(checkInterval)
      clearTimeout(timeout)
      resolve(null)
    })

    // 设置User-Agent为微信浏览器
    cookieWindow.webContents.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.38(0x18002633) NetType/WIFI Language/zh_CN'
    )

    // 加载页面
    cookieWindow.loadURL(profileUrl)

    // 页面加载完成后显示提示
    cookieWindow.webContents.on('did-finish-load', () => {
      cookieWindow.webContents.executeJavaScript(`
        // 添加顶部提示条
        const banner = document.createElement('div');
        banner.style.cssText = \`
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px 20px;
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          z-index: 999999;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        \`;
        banner.innerHTML = \`
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <span style="font-size: 24px;">📱</span>
            <span>请使用微信扫描页面中的二维码登录，登录成功后窗口将自动关闭</span>
          </div>
        \`;
        document.body.insertBefore(banner, document.body.firstChild);
        document.body.style.paddingTop = '60px';
      `)
    })
  })
}
