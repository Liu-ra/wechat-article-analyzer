import { clipboard } from 'electron'
import { logger } from './logger'

/**
 * 验证字符串是否为有效的Cookie格式
 */
function isValidCookieString(text: string): boolean {
  // 检查是否包含Cookie的特征
  // 1. 包含key=value格式
  // 2. 包含微信相关的Cookie字段
  const hasKeyValuePairs = /\w+=\w+/.test(text)
  const hasWechatCookie = /key=|appmsg_token=|pass_ticket=|uin=/.test(text)

  return hasKeyValuePairs && hasWechatCookie
}

/**
 * 监听剪贴板并自动获取Cookie
 * @param onCookieFound 当检测到Cookie时的回调
 * @param onCancel 用户取消时的回调
 * @returns 停止监听的函数
 */
export function startClipboardMonitoring(
  onCookieFound: (cookieString: string) => void,
  onCancel: () => void
): () => void {
  logger.info('开始监听剪贴板')

  let lastClipboardText = clipboard.readText()
  let isCancelled = false

  // 定期检查剪贴板
  const checkInterval = setInterval(() => {
    if (isCancelled) {
      clearInterval(checkInterval)
      return
    }

    try {
      const currentText = clipboard.readText()

      // 如果剪贴板内容发生变化
      if (currentText && currentText !== lastClipboardText) {
        lastClipboardText = currentText

        // 验证是否为Cookie格式
        if (isValidCookieString(currentText)) {
          logger.info('检测到Cookie格式的剪贴板内容')
          clearInterval(checkInterval)
          onCookieFound(currentText)
        }
      }
    } catch (error) {
      logger.error('检查剪贴板失败', {
        error: error instanceof Error ? error.message : error
      })
    }
  }, 500) // 每500ms检查一次

  // 设置超时（3分钟）
  const timeout = setTimeout(() => {
    if (!isCancelled) {
      logger.warn('剪贴板监听超时')
      clearInterval(checkInterval)
      onCancel()
    }
  }, 3 * 60 * 1000)

  // 返回停止监听的函数
  return () => {
    isCancelled = true
    clearInterval(checkInterval)
    clearTimeout(timeout)
    logger.info('停止监听剪贴板')
  }
}
