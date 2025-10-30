/**
 * Unit tests for error handling functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  AppError,
  ErrorType,
  errors,
  normalizeError,
  withErrorHandler,
  tryCatch,
  retry,
  isErrorType,
} from '../../lib/error-handler';
import { ZodError, z } from 'zod';
import { NextResponse } from 'next/server';
import { createMockRequest } from '../test-utils';

describe('Error Handling', () => {
  describe('AppError', () => {
    it('should create error with type and message', () => {
      const error = new AppError(
        ErrorType.VALIDATION,
        'Invalid input',
        400
      );

      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
    });

    it('should include details in JSON', () => {
      const error = new AppError(
        ErrorType.VALIDATION,
        'Invalid input',
        400,
        { field: 'email' }
      );

      const json = error.toJSON();
      expect(json.error).toBe(ErrorType.VALIDATION);
      expect(json.message).toBe('Invalid input');
      expect(json.details).toEqual({ field: 'email' });
    });

    it('should include stack in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new AppError(ErrorType.INTERNAL, 'Error');
      const json = error.toJSON();

      expect(json.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('error factories', () => {
    it('should create validation error', () => {
      const error = errors.validation('Invalid email');
      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.statusCode).toBe(400);
    });

    it('should create unauthorized error', () => {
      const error = errors.unauthorized();
      expect(error.type).toBe(ErrorType.AUTHENTICATION);
      expect(error.statusCode).toBe(401);
    });

    it('should create forbidden error', () => {
      const error = errors.forbidden();
      expect(error.type).toBe(ErrorType.AUTHORIZATION);
      expect(error.statusCode).toBe(403);
    });

    it('should create not found error', () => {
      const error = errors.notFound('User', '123');
      expect(error.type).toBe(ErrorType.NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('123');
    });

    it('should create conflict error', () => {
      const error = errors.conflict('Resource exists');
      expect(error.type).toBe(ErrorType.CONFLICT);
      expect(error.statusCode).toBe(409);
    });

    it('should create rate limit error', () => {
      const error = errors.rateLimit();
      expect(error.type).toBe(ErrorType.RATE_LIMIT);
      expect(error.statusCode).toBe(429);
    });
  });

  describe('normalizeError', () => {
    it('should pass through AppError', () => {
      const appError = new AppError(ErrorType.VALIDATION, 'Test');
      const normalized = normalizeError(appError);
      expect(normalized).toBe(appError);
    });

    it('should convert ZodError to AppError', () => {
      const schema = z.object({ email: z.string().email() });
      try {
        schema.parse({ email: 'invalid' });
      } catch (e) {
        const normalized = normalizeError(e);
        expect(normalized.type).toBe(ErrorType.VALIDATION);
        expect(normalized.statusCode).toBe(400);
        expect(normalized.details).toBeDefined();
      }
    });

    it('should convert standard Error to AppError', () => {
      const error = new Error('Something went wrong');
      const normalized = normalizeError(error);
      expect(normalized.type).toBe(ErrorType.INTERNAL);
      expect(normalized.statusCode).toBe(500);
    });

    it('should detect unique constraint errors', () => {
      const error = new Error('unique constraint violation');
      const normalized = normalizeError(error);
      expect(normalized.type).toBe(ErrorType.CONFLICT);
    });

    it('should detect foreign key constraint errors', () => {
      const error = new Error('foreign key constraint failed');
      const normalized = normalizeError(error);
      expect(normalized.type).toBe(ErrorType.VALIDATION);
    });
  });

  describe('withErrorHandler', () => {
    it('should return success response', async () => {
      const result = await withErrorHandler(async () => {
        return NextResponse.json({ success: true });
      });

      expect(result).toBeInstanceOf(NextResponse);
    });

    it('should catch and convert errors', async () => {
      const result = await withErrorHandler(async () => {
        throw new Error('Test error');
      });

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.error).toBeDefined();
    });
  });

  describe('tryCatch', () => {
    it('should return result on success', async () => {
      const [error, result] = await tryCatch(async () => {
        return 'success';
      });

      expect(error).toBeNull();
      expect(result).toBe('success');
    });

    it('should return error on failure', async () => {
      const [error, result] = await tryCatch(async () => {
        throw new Error('Test error');
      });

      expect(error).toBeInstanceOf(AppError);
      expect(result).toBeNull();
    });
  });

  describe('retry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const result = await retry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary error');
          }
          return 'success';
        },
        { maxAttempts: 3, initialDelay: 10 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max attempts', async () => {
      await expect(
        retry(
          async () => {
            throw new Error('Permanent error');
          },
          { maxAttempts: 2, initialDelay: 10 }
        )
      ).rejects.toThrow();
    });

    it('should call onRetry callback', async () => {
      const retries: number[] = [];
      
      try {
        await retry(
          async () => {
            throw new Error('Error');
          },
          {
            maxAttempts: 3,
            initialDelay: 10,
            onRetry: (attempt) => retries.push(attempt),
          }
        );
      } catch (e) {
        // Expected to fail
      }

      expect(retries).toEqual([1, 2]);
    });
  });

  describe('isErrorType', () => {
    it('should identify error type correctly', () => {
      const error = errors.validation('Test');
      expect(isErrorType(error, ErrorType.VALIDATION)).toBe(true);
      expect(isErrorType(error, ErrorType.AUTHENTICATION)).toBe(false);
    });

    it('should return false for non-AppError', () => {
      const error = new Error('Test');
      expect(isErrorType(error, ErrorType.INTERNAL)).toBe(false);
    });
  });
});
