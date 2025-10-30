/**
 * Structured logging utilities
 *
 * Provides consistent, structured logging across the application
 * with support for different log levels, contexts, and destinations.
 *
 * @module logger
 */

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  requestId?: string;
  userId?: string;
  source?: string;
}

/**
 * Logger interface for extensibility
 */
export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  child(context: LogContext): ILogger;
}

/**
 * Main logger implementation
 */
class Logger implements ILogger {
  private context: LogContext = {};
  private minLevel: LogLevel;

  constructor(context: LogContext = {}, minLevel: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.minLevel = minLevel;
  }

  /**
   * Check if log level should be emitted
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    const currentIndex = levels.indexOf(this.minLevel);
    const targetIndex = levels.indexOf(level);
    return targetIndex >= currentIndex;
  }

  /**
   * Create log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    additionalContext?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...additionalContext },
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    return entry;
  }

  /**
   * Write log entry
   */
  private write(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // Format for console in development
    if (process.env.NODE_ENV === "development") {
      const color = this.getColor(entry.level);
      const badge = `[${entry.level.toUpperCase()}]`;
      console.log(
        `${color}${badge}\x1b[0m ${entry.message}`,
        entry.context && Object.keys(entry.context).length > 0
          ? entry.context
          : "",
        entry.error || ""
      );
    } else {
      // JSON format for production (structured logging)
      console.log(JSON.stringify(entry));
    }

    // Send to external logging service if configured
    this.sendToExternalService(entry);
  }

  /**
   * Get console color for log level
   */
  private getColor(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: "\x1b[36m", // Cyan
      [LogLevel.INFO]: "\x1b[32m", // Green
      [LogLevel.WARN]: "\x1b[33m", // Yellow
      [LogLevel.ERROR]: "\x1b[31m", // Red
    };
    return colors[level] || "\x1b[0m";
  }

  /**
   * Send to external logging service (DataDog, Sentry, etc.)
   */
  private sendToExternalService(entry: LogEntry): void {
    // TODO: Implement external logging service integration
    // Examples: DataDog, Sentry, LogDNA, Papertrail

    // For now, this is a placeholder
    if (process.env.LOGGING_ENDPOINT && typeof fetch !== "undefined") {
      // Send to external service (only in environments where fetch is available)
      fetch(process.env.LOGGING_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      }).catch((error) => {
        console.error("Failed to send log to external service:", error);
      });
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.write(this.createEntry(LogLevel.DEBUG, message, context));
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.write(this.createEntry(LogLevel.INFO, message, context));
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.write(this.createEntry(LogLevel.WARN, message, context));
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.write(this.createEntry(LogLevel.ERROR, message, context, error));
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): ILogger {
    return new Logger({ ...this.context, ...context }, this.minLevel);
  }
}

/**
 * Global logger instance
 */
let globalLogger: ILogger | null = null;

/**
 * Get or create logger instance
 */
export function getLogger(context?: LogContext): ILogger {
  if (!globalLogger) {
    const minLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
    globalLogger = new Logger({}, minLevel);
  }

  if (context) {
    return globalLogger.child(context);
  }

  return globalLogger;
}

/**
 * Create logger for specific module
 */
export function createModuleLogger(moduleName: string): ILogger {
  return getLogger({ module: moduleName });
}

/**
 * Create logger for specific request
 */
export function createRequestLogger(
  requestId: string,
  userId?: string
): ILogger {
  return getLogger({
    requestId,
    ...(userId && { userId }),
  });
}

/**
 * Log performance metric
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  context?: LogContext
): void {
  const logger = getLogger({ operation, durationMs });

  if (durationMs > 1000) {
    logger.warn("Slow operation detected", context);
  } else {
    logger.debug("Operation completed", context);
  }
}

/**
 * Log security event
 */
export function logSecurityEvent(
  event: string,
  severity: "low" | "medium" | "high" | "critical",
  context?: LogContext
): void {
  const logger = getLogger({ event, severity, type: "security" });

  if (severity === "critical" || severity === "high") {
    logger.error(`Security event: ${event}`, undefined, context);
  } else {
    logger.warn(`Security event: ${event}`, context);
  }
}

/**
 * Log API request
 */
export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  context?: LogContext
): void {
  const logger = getLogger({
    type: "api_request",
    method,
    path,
    statusCode,
    durationMs,
  });

  const message = `${method} ${path} ${statusCode} ${durationMs}ms`;

  if (statusCode >= 500) {
    logger.error(message, undefined, context);
  } else if (statusCode >= 400) {
    logger.warn(message, context);
  } else {
    logger.info(message, context);
  }
}

/**
 * Log database query
 */
export function logDatabaseQuery(
  query: string,
  durationMs: number,
  context?: LogContext
): void {
  const logger = getLogger({
    type: "db_query",
    query: query.substring(0, 100), // Truncate long queries
    durationMs,
  });

  if (durationMs > 100) {
    logger.warn("Slow query detected", context);
  } else {
    logger.debug("Query executed", context);
  }
}

/**
 * Decorator for logging method calls
 */
export function LogMethod(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  const className = target.constructor.name;

  descriptor.value = async function (...args: any[]) {
    const logger = getLogger({ class: className, method: propertyKey });
    const startTime = Date.now();

    try {
      logger.debug(`Calling ${className}.${propertyKey}`);
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - startTime;

      logPerformance(`${className}.${propertyKey}`, duration);

      return result;
    } catch (error) {
      logger.error(
        `Error in ${className}.${propertyKey}`,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  };

  return descriptor;
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitize(data: any): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "apiKey",
    "api_key",
    "authorization",
    "cookie",
    "sessionId",
    "ssn",
    "creditCard",
  ];

  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof sanitized[key] === "object") {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }

  return sanitized;
}
