/**
 * Unit tests for rate limiting functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createMockRequest } from '../test-utils';
import { rateLimit, rateLimitPresets } from '../../lib/rate-limit';

describe('Rate Limiting', () => {
  describe('rateLimit', () => {
    beforeEach(() => {
      // Clear rate limit store before each test
      // In production, this would be handled by Redis or similar
    });

    it('should allow requests within limit', async () => {
      const request = createMockRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
      });

      const result = await rateLimit(request, {
        maxRequests: 5,
        windowMs: 60000,
      });

      expect(result.success).toBe(true);
      expect(result.response).toBeUndefined();
    });

    it('should block requests exceeding limit', async () => {
      const request = createMockRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
      });

      const config = {
        maxRequests: 2,
        windowMs: 60000,
      };

      // First two requests should succeed
      await rateLimit(request, config);
      await rateLimit(request, config);

      // Third request should be blocked
      const result = await rateLimit(request, config);
      
      expect(result.success).toBe(false);
      expect(result.response).toBeDefined();
      expect(result.response?.status).toBe(429);
    });

    it('should use custom error message', async () => {
      const request = createMockRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
      });

      const config = {
        maxRequests: 1,
        windowMs: 60000,
        message: 'Custom rate limit message',
      };

      await rateLimit(request, config);
      const result = await rateLimit(request, config);

      expect(result.success).toBe(false);
      const json = await result.response?.json();
      expect(json.message).toBe('Custom rate limit message');
    });

    it('should include rate limit headers', async () => {
      const request = createMockRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
      });

      const config = {
        maxRequests: 1,
        windowMs: 60000,
        includeHeaders: true,
      };

      await rateLimit(request, config);
      const result = await rateLimit(request, config);

      expect(result.success).toBe(false);
      expect(result.response?.headers.has('X-RateLimit-Limit')).toBe(true);
      expect(result.response?.headers.has('Retry-After')).toBe(true);
    });
  });

  describe('rateLimitPresets', () => {
    it('should have auth preset', () => {
      expect(rateLimitPresets.auth).toBeDefined();
      expect(rateLimitPresets.auth.maxRequests).toBe(5);
      expect(rateLimitPresets.auth.windowMs).toBe(60000);
    });

    it('should have api preset', () => {
      expect(rateLimitPresets.api).toBeDefined();
      expect(rateLimitPresets.api.maxRequests).toBe(100);
    });

    it('should have chat preset', () => {
      expect(rateLimitPresets.chat).toBeDefined();
      expect(rateLimitPresets.chat.maxRequests).toBe(30);
    });

    it('should have expensive preset', () => {
      expect(rateLimitPresets.expensive).toBeDefined();
      expect(rateLimitPresets.expensive.maxRequests).toBe(20);
    });
  });
});
