import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: any
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private logFilePath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.logFilePath = path.join(userDataPath, 'app.log')
    this.loadLogsFromFile()
  }

  private loadLogsFromFile() {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const content = fs.readFileSync(this.logFilePath, 'utf-8')
        const lines = content.split('\n').filter(line => line.trim())
        this.logs = lines.slice(-this.maxLogs).map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        }).filter(Boolean) as LogEntry[]
      }
    } catch (error) {
      console.error('Failed to load logs from file:', error)
    }
  }

  private writeToFile(entry: LogEntry) {
    try {
      fs.appendFileSync(this.logFilePath, JSON.stringify(entry) + '\n', 'utf-8')
    } catch (error) {
      console.error('Failed to write log to file:', error)
    }
  }

  private log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    }

    this.logs.push(entry)

    // 限制内存中的日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // 写入文件
    this.writeToFile(entry)

    // 同时输出到控制台
    const consoleMessage = `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`
    switch (level) {
      case 'error':
        console.error(consoleMessage, data || '')
        break
      case 'warn':
        console.warn(consoleMessage, data || '')
        break
      case 'debug':
        console.debug(consoleMessage, data || '')
        break
      default:
        console.log(consoleMessage, data || '')
    }
  }

  info(message: string, data?: any) {
    this.log('info', message, data)
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data)
  }

  error(message: string, data?: any) {
    this.log('error', message, data)
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data)
  }

  getLogs(limit?: number): LogEntry[] {
    if (limit) {
      return this.logs.slice(-limit)
    }
    return this.logs
  }

  clearLogs() {
    this.logs = []
    try {
      fs.writeFileSync(this.logFilePath, '', 'utf-8')
    } catch (error) {
      console.error('Failed to clear log file:', error)
    }
  }

  getLogFilePath(): string {
    return this.logFilePath
  }
}

export const logger = new Logger()
