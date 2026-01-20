import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from './logger'

const execAsync = promisify(exec)

/**
 * 设置 Windows 系统代理
 */
export async function enableSystemProxy(proxyAddress: string): Promise<boolean> {
  try {
    logger.info('开始设置系统代理', { proxyAddress })

    // 使用 PowerShell 设置系统代理
    const command = `powershell -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 1; Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyServer -Value '${proxyAddress}'"`

    await execAsync(command)

    // 刷新系统设置
    await refreshInternetSettings()

    logger.info('系统代理设置成功', { proxyAddress })
    return true
  } catch (error) {
    logger.error('设置系统代理失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

/**
 * 禁用 Windows 系统代理
 */
export async function disableSystemProxy(): Promise<boolean> {
  try {
    logger.info('开始禁用系统代理')

    // 使用 PowerShell 禁用系统代理
    const command = `powershell -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 0"`

    await execAsync(command)

    // 刷新系统设置
    await refreshInternetSettings()

    logger.info('系统代理已禁用')
    return true
  } catch (error) {
    logger.error('禁用系统代理失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

/**
 * 获取当前系统代理状态
 */
export async function getProxyStatus(): Promise<{
  enabled: boolean
  server: string | null
}> {
  try {
    // 获取 ProxyEnable 状态
    const enableCommand = `powershell -Command "Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable | Select-Object -ExpandProperty ProxyEnable"`
    const { stdout: enableOutput } = await execAsync(enableCommand)
    const enabled = enableOutput.trim() === '1'

    // 获取 ProxyServer
    let server: string | null = null
    if (enabled) {
      try {
        const serverCommand = `powershell -Command "Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyServer | Select-Object -ExpandProperty ProxyServer"`
        const { stdout: serverOutput } = await execAsync(serverCommand)
        server = serverOutput.trim()
      } catch {
        // 忽略错误
      }
    }

    return { enabled, server }
  } catch (error) {
    logger.error('获取代理状态失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return { enabled: false, server: null }
  }
}

/**
 * 刷新 Internet 设置（通知系统代理已更改）
 */
async function refreshInternetSettings(): Promise<void> {
  try {
    // 使用 PowerShell 刷新设置
    const command = `powershell -Command "
      Add-Type @'
      using System;
      using System.Runtime.InteropServices;
      public class InternetSettings {
        [DllImport(\"wininet.dll\", SetLastError = true)]
        public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
        public const int INTERNET_OPTION_SETTINGS_CHANGED = 39;
        public const int INTERNET_OPTION_REFRESH = 37;
        public static void Notify() {
          InternetSetOption(IntPtr.Zero, INTERNET_OPTION_SETTINGS_CHANGED, IntPtr.Zero, 0);
          InternetSetOption(IntPtr.Zero, INTERNET_OPTION_REFRESH, IntPtr.Zero, 0);
        }
      }
'@
      [InternetSettings]::Notify()
    "`

    await execAsync(command)
    logger.debug('Internet 设置已刷新')
  } catch (error) {
    logger.warn('刷新 Internet 设置失败，代理可能需要手动刷新', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
