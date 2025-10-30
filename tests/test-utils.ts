/**
 * Testing utilities and helpers
 * 
 * Provides common test utilities, fixtures, and helper functions
 * for unit, integration, and E2E tests.
 * 
 * @module test-utils
 */

import { type NextRequest } from 'next/server';

/**
 * Create mock NextRequest for testing
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    cookies?: Record<string, string>;
  } = {}
): NextRequest {
  const {
    method = 'GET',
    headers = {},
    body,
    cookies = {},
  } = options;

  const request = new Request(url, {
    method,
    headers: new Headers(headers),
    ...(body && {
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  }) as NextRequest;

  // Mock cookies
  Object.defineProperty(request, 'cookies', {
    value: {
      get: (name: string) => cookies[name] ? { value: cookies[name] } : undefined,
      getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
      has: (name: string) => name in cookies,
      set: (name: string, value: string) => { cookies[name] = value; },
      delete: (name: string) => { delete cookies[name]; },
    },
    writable: true,
  });

  return request;
}

/**
 * Create mock session for testing
 */
export function createMockSession(overrides?: Partial<any>) {
  return {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      ...overrides?.user,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  } = {}
): Promise<void> {
  const {
    timeout = 5000,
    interval = 100,
    timeoutMessage = 'Condition not met within timeout',
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(timeoutMessage);
}

/**
 * Create mock database connection
 */
export function createMockDb() {
  const store = new Map<string, any>();

  return {
    // Mock query methods
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    execute: jest.fn(async () => Array.from(store.values())),
    
    // Mock insert/update/delete
    insert: jest.fn().mockReturnThis(),
    values: jest.fn(async (data: any) => {
      const id = Math.random().toString(36);
      store.set(id, { id, ...data });
      return [{ id, ...data }];
    }),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    
    // Direct access to store for testing
    _store: store,
    _clear: () => store.clear(),
  };
}

/**
 * Generate test UUID
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create test memory object
 */
export function createTestMemory(overrides?: Partial<any>) {
  return {
    id: generateTestId('mem'),
    ownerId: 'test-user-id',
    scope: 'user_owned' as const,
    layer: 'temporary' as const,
    key: `test:${Date.now()}`,
    content: { test: 'data' },
    confidence: 0.9,
    sensitivity: 'public' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

/**
 * Create test chat message
 */
export function createTestMessage(overrides?: Partial<any>) {
  return {
    id: generateTestId('msg'),
    chatId: generateTestId('chat'),
    role: 'user' as const,
    content: 'Test message',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Mock console methods for clean test output
 */
export function mockConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
  });

  afterAll(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  });

  return originalConsole;
}

/**
 * Test fixture manager
 */
export class FixtureManager {
  private fixtures: any[] = [];

  /**
   * Create and track a fixture
   */
  create<T>(factory: () => T): T {
    const fixture = factory();
    this.fixtures.push(fixture);
    return fixture;
  }

  /**
   * Create multiple fixtures
   */
  createMany<T>(factory: () => T, count: number): T[] {
    return Array.from({ length: count }, () => this.create(factory));
  }

  /**
   * Clean up all fixtures
   */
  async cleanup() {
    // Implement cleanup logic based on fixture type
    // For now, just clear the array
    this.fixtures = [];
  }
}

/**
 * Setup test environment
 */
export function setupTestEnvironment() {
  const fixtureManager = new FixtureManager();

  beforeEach(() => {
    // Reset environment
    process.env.NODE_ENV = 'test';
  });

  afterEach(async () => {
    // Cleanup fixtures
    await fixtureManager.cleanup();
  });

  return { fixtureManager };
}

/**
 * Mock timers for testing
 */
export function mockTime(date: Date = new Date('2025-10-30T08:00:00.000Z')) {
  const originalNow = Date.now;
  const timestamp = date.getTime();

  beforeAll(() => {
    Date.now = jest.fn(() => timestamp);
  });

  afterAll(() => {
    Date.now = originalNow;
  });

  return {
    advance: (ms: number) => {
      (Date.now as jest.Mock).mockReturnValue(timestamp + ms);
    },
    set: (newDate: Date) => {
      (Date.now as jest.Mock).mockReturnValue(newDate.getTime());
    },
  };
}

/**
 * Snapshot serializer for dates
 */
export const dateSerializer = {
  test: (val: any) => val instanceof Date,
  print: (val: Date) => `Date(${val.toISOString()})`,
};

/**
 * Assert response shape
 */
export function assertResponseShape<T>(
  response: any,
  shape: Record<keyof T, string>
): asserts response is T {
  for (const [key, type] of Object.entries(shape)) {
    if (typeof response[key] !== type) {
      throw new Error(
        `Expected response.${key} to be ${type}, got ${typeof response[key]}`
      );
    }
  }
}

/**
 * Create test error
 */
export function createTestError(message: string, code?: string) {
  const error = new Error(message);
  if (code) {
    (error as any).code = code;
  }
  return error;
}

/**
 * Delay for testing
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
