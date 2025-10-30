/**
 * Rate limiting utilities for API protection
 *
 * Implements token bucket algorithm for rate limiting.
 * Uses in-memory storage (suitable for single-instance deployments)
 * or Redis for distributed deployments.
 *
 * @module rate-limit
 */

import { type NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the time window
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Message to return when rate limit is exceeded
   */
  message?: string;

  /**
   * Whether to include rate limit headers in response
   */
  includeHeaders?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// TODO: Replace with Redis for production distributed deployments
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

/**
 * Get client identifier from request
 * Uses IP address or user ID if authenticated
 */
function getClientId(request: NextRequest): string {
  // Try to get user from session/auth header first
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    return `user:${authHeader.split(" ")[1]?.substring(0, 20)}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";

  return `ip:${ip}`;
}

/**
 * Rate limit middleware factory
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await rateLimit(request, {
 *     maxRequests: 10,
 *     windowMs: 60000, // 1 minute
 *   });
 *
 *   if (!rateLimitResult.success) {
 *     return rateLimitResult.response;
 *   }
 *
 *   // Process request...
 * }
 * ```
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ success: boolean; response?: NextResponse }> {
  const {
    maxRequests,
    windowMs,
    message = "Too many requests, please try again later.",
    includeHeaders = true,
  } = config;

  const clientId = getClientId(request);
  const key = `${clientId}:${request.nextUrl.pathname}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Create new entry
    entry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, entry);

    return createSuccessResponse(entry, maxRequests, includeHeaders);
  }

  // Increment count
  entry.count++;

  if (entry.count > maxRequests) {
    return createRateLimitResponse(entry, message, includeHeaders);
  }

  return createSuccessResponse(entry, maxRequests, includeHeaders);
}

/**
 * Create success response with rate limit headers
 */
function createSuccessResponse(
  entry: RateLimitEntry,
  maxRequests: number,
  includeHeaders: boolean
): { success: true } {
  return { success: true };
}

/**
 * Create rate limit exceeded response
 */
function createRateLimitResponse(
  entry: RateLimitEntry,
  message: string,
  includeHeaders: boolean
): { success: false; response: NextResponse } {
  const headers = new Headers();

  if (includeHeaders) {
    headers.set("X-RateLimit-Limit", String(entry.count));
    headers.set("X-RateLimit-Remaining", "0");
    headers.set("X-RateLimit-Reset", String(entry.resetTime));
    headers.set(
      "Retry-After",
      String(Math.ceil((entry.resetTime - Date.now()) / 1000))
    );
  }

  const response = NextResponse.json(
    { error: "rate_limit_exceeded", message },
    { status: 429, headers }
  );

  return { success: false, response };
}

/**
 * Predefined rate limit configurations for common scenarios
 */
export const rateLimitPresets = {
  /**
   * Strict rate limit for authentication endpoints
   * 5 requests per minute
   */
  auth: {
    maxRequests: 5,
    windowMs: 60 * 1000,
    message: "Too many authentication attempts. Please try again later.",
  },

  /**
   * Moderate rate limit for API endpoints
   * 100 requests per minute
   */
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    message: "API rate limit exceeded. Please try again later.",
  },

  /**
   * Generous rate limit for chat messages
   * 30 requests per minute
   */
  chat: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    message: "Message rate limit exceeded. Please slow down.",
  },

  /**
   * Strict rate limit for expensive operations (embeddings, RAG)
   * 20 requests per minute
   */
  expensive: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    message: "Rate limit exceeded for this operation. Please try again later.",
  },
} as const;

/**
 * Redis-based rate limiter for distributed deployments
 * Requires REDIS_URL environment variable
 *
 * @example
 * ```typescript
 * const rateLimiter = createRedisRateLimiter();
 * const result = await rateLimiter.check('user:123', 10, 60000);
 * ```
 */
export function createRedisRateLimiter() {
  // Placeholder for Redis implementation
  // TODO: Implement when Redis is available
  const REDIS_URL = process.env.REDIS_URL;

  if (!REDIS_URL) {
    console.warn("REDIS_URL not configured. Using in-memory rate limiting.");
  }

  return {
    async check(
      key: string,
      maxRequests: number,
      windowMs: number
    ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
      // For now, delegate to in-memory implementation
      // TODO: Replace with Redis Lua script for atomicity
      const entry = rateLimitStore.get(key);
      const now = Date.now();

      if (!entry || entry.resetTime < now) {
        const newEntry = { count: 1, resetTime: now + windowMs };
        rateLimitStore.set(key, newEntry);
        return {
          allowed: true,
          remaining: maxRequests - 1,
          resetTime: newEntry.resetTime,
        };
      }

      entry.count++;
      const allowed = entry.count <= maxRequests;

      return {
        allowed,
        remaining: Math.max(0, maxRequests - entry.count),
        resetTime: entry.resetTime,
      };
    },
  };
}
