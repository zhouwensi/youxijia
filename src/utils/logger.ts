// 日志工具
export class Logger {
  private static logs: string[] = []

  static log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`
    
    this.logs.push(logMessage)
    
    // 输出到控制台
    const styles: Record<string, string[]> = {
      info: ['color: #3b82f6', ''],
      success: ['color: #10b981', ''],
      warning: ['color: #f59e0b', ''],
      error: ['color: #ef4444', '']
    }
    
    const [style1, style2] = styles[type] || styles.info
    console.log(`%c${logMessage}`, style1, style2)
    
    // 限制日志数量
    if (this.logs.length > 100) {
      this.logs.shift()
    }
  }

  static info(message: string) {
    this.log(message, 'info')
  }

  static success(message: string) {
    this.log(message, 'success')
  }

  static warning(message: string) {
    this.log(message, 'warning')
  }

  static error(message: string) {
    this.log(message, 'error')
  }

  static getLogs(): string[] {
    return [...this.logs]
  }

  static clear() {
    this.logs = []
  }
}
