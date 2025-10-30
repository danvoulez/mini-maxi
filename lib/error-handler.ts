/**
 * Centralized error handling utilities
 *
 * Provides consistent error handling, logging, and user-friendly error messages
 * across the application.
 *
 * @module error-handler
 */

import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Application error types
 */
export enum ErrorType {
  VALIDATION = "validation_error",
  AUTHENTICATION = "authentication_error",
  AUTHORIZATION = "authorization_error",
  NOT_FOUND = "not_found",
  RATE_LIMIT = "rate_limit_exceeded",
  DATABASE = "database_error",
  EXTERNAL_API = "external_api_error",
  INTERNAL = "internal_error",
  BAD_REQUEST = "bad_request",
  CONFLICT = "conflict",
}

/**
 * Application error class with additional context
 */
export class AppError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public statusCode = 500,
    public details?: Record<string, any>,
    public originalError?: Error
  ) {
    super(message);
    this.name = "AppError";

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      error: this.type,
      message: this.message,
      ...(this.details && { details: this.details }),
      ...(process.env.NODE_ENV === "development" && {
        stack: this.stack,
        originalError: this.originalError?.message,
      }),
    };
  }
}

/**
 * Common error factories
 */
export const errors = {
  validation: (message: string, details?: Record<string, any>) =>
    new AppError(ErrorType.VALIDATION, message, 400, details),

  unauthorized: (message = "Authentication required") =>
    new AppError(ErrorType.AUTHENTICATION, message, 401),

  forbidden: (message = "Insufficient permissions") =>
    new AppError(ErrorType.AUTHORIZATION, message, 403),

  notFound: (resource = "Resource", id?: string) =>
    new AppError(
      ErrorType.NOT_FOUND,
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404
    ),

  conflict: (message: string) => new AppError(ErrorType.CONFLICT, message, 409),

  rateLimit: (message = "Too many requests") =>
    new AppError(ErrorType.RATE_LIMIT, message, 429),

  database: (message: string, originalError?: Error) =>
    new AppError(ErrorType.DATABASE, message, 500, undefined, originalError),

  externalApi: (service: string, originalError?: Error) =>
    new AppError(
      ErrorType.EXTERNAL_API,
      `Failed to communicate with ${service}`,
      502,
      undefined,
      originalError
    ),

  internal: (message = "An unexpected error occurred", originalError?: Error) =>
    new AppError(ErrorType.INTERNAL, message, 500, undefined, originalError),
};

/**
 * Error logger interface
 */
interface ErrorLogger {
  error: (message: string, meta?: Record<string, any>) => void;
  warn: (message: string, meta?: Record<string, any>) => void;
  info: (message: string, meta?: Record<string, any>) => void;
}

/**
 * Default console-based logger
 */
const defaultLogger: ErrorLogger = {
  error: (message, meta) => console.error(message, meta),
  warn: (message, meta) => console.warn(message, meta),
  info: (message, meta) => console.info(message, meta),
};

let logger: ErrorLogger = defaultLogger;

/**
 * Set custom logger (e.g., Sentry, DataDog)
 */
export function setErrorLogger(customLogger: ErrorLogger) {
  logger = customLogger;
}

/**
 * Log error with appropriate level and context
 */
function logError(error: Error | AppError, context?: Record<string, any>) {
  const isAppError = error instanceof AppError;
  const level = isAppError && error.statusCode < 500 ? "warn" : "error";

  logger[level](
    `[${isAppError ? error.type : "UnhandledError"}] ${error.message}`,
    {
      ...context,
      stack: error.stack,
      ...(isAppError && {
        statusCode: error.statusCode,
        details: error.details,
        originalError: error.originalError?.message,
      }),
    }
  );
}

/**
 * Convert various error types to AppError
 */
export function normalizeError(
  error: unknown,
  defaultMessage = "An error occurred"
): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Zod validation error
  if (error instanceof ZodError) {
    return new AppError(ErrorType.VALIDATION, "Validation failed", 400, {
      issues: error.errors,
    });
  }

  // Standard Error
  if (error instanceof Error) {
    // Check for common database errors
    if (error.message.includes("unique constraint")) {
      return errors.conflict("Resource already exists");
    }
    if (error.message.includes("foreign key constraint")) {
      return errors.validation("Invalid reference to related resource");
    }
    if (error.message.includes("connect ECONNREFUSED")) {
      return errors.database("Database connection failed", error);
    }

    // Generic error
    return errors.internal(error.message, error);
  }

  // Unknown error type
  return errors.internal(defaultMessage);
}

/**
 * Express/Next.js error handler middleware
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   return withErrorHandler(async () => {
 *     // Your route logic here
 *     return NextResponse.json({ success: true });
 *   }, request);
 * }
 * ```
 */
export async function withErrorHandler<T>(
  handler: () => Promise<T>,
  request?: NextRequest,
  context?: Record<string, any>
): Promise<T | NextResponse> {
  try {
    return await handler();
  } catch (error) {
    const appError = normalizeError(error);

    // Log error with request context
    logError(appError, {
      ...context,
      ...(request && {
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
      }),
    });

    // Return error response
    return NextResponse.json(appError.toJSON(), {
      status: appError.statusCode,
    }) as T;
  }
}

/**
 * Async error wrapper for handlers
 * Catches errors and converts them to proper responses
 */
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = normalizeError(error);
      logError(appError);

      return NextResponse.json(appError.toJSON(), {
        status: appError.statusCode,
      }) as R;
    }
  };
}

/**
 * Assert condition or throw error
 */
export function assert(
  condition: boolean,
  error: AppError | string
): asserts condition {
  if (!condition) {
    throw typeof error === "string" ? errors.internal(error) : error;
  }
}

/**
 * Safe async operation executor with error handling
 * Returns [error, result] tuple
 */
export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<[AppError | null, T | null]> {
  try {
    const result = await fn();
    return [null, result];
  } catch (error) {
    return [normalizeError(error), null];
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10_000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        break;
      }

      onRetry?.(attempt, lastError);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw errors.internal(
    `Operation failed after ${maxAttempts} attempts: ${lastError!.message}`,
    lastError!
  );
}

/**
 * Error boundary for React Server Components
 * Use in error.tsx files
 */
export function getErrorMessage(error: unknown): string {
  const appError = normalizeError(error);
  return appError.message;
}

/**
 * Check if error is of specific type
 */
export function isErrorType(error: unknown, type: ErrorType): boolean {
  return error instanceof AppError && error.type === type;
}
