// Unit tests for CEREBRO Memory System

import { getAutoTuner } from "../../lib/memory/autotuner";
import { decrypt, encrypt, shouldEncrypt } from "../../lib/memory/encryption";
import { getMetricsCollector } from "../../lib/memory/metrics";
import { canPromote, hasPermission } from "../../lib/memory/rbac";
import {
  detectSchemaId,
  validateMemoryContent,
} from "../../lib/memory/schema-registry";

// Simple test runner
const tests: Array<{ name: string; fn: () => void }> = [];
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  tests.push({ name, fn });
}

function expect(value: any) {
  return {
    toBe(expected: any) {
      if (value !== expected) {
        throw new Error(`Expected ${value} to be ${expected}`);
      }
    },
    toBeTruthy() {
      if (!value) {
        throw new Error(`Expected ${value} to be truthy`);
      }
    },
    toBeNull() {
      if (value !== null) {
        throw new Error(`Expected ${value} to be null`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (value <= expected) {
        throw new Error(`Expected ${value} to be greater than ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected: number) {
      if (value > expected) {
        throw new Error(
          `Expected ${value} to be less than or equal to ${expected}`
        );
      }
    },
    toEqual(expected: any) {
      if (JSON.stringify(value) !== JSON.stringify(expected)) {
        throw new Error(
          `Expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`
        );
      }
    },
  };
}

// RBAC Tests
test("admin role has all permissions", () => {
  expect(hasPermission("admin", "memory:read")).toBe(true);
  expect(hasPermission("admin", "memory:write")).toBe(true);
  expect(hasPermission("admin", "memory:promote")).toBe(true);
  expect(hasPermission("admin", "memory:delete")).toBe(true);
  expect(hasPermission("admin", "memory:admin")).toBe(true);
});

test("user role has limited permissions", () => {
  expect(hasPermission("user", "memory:read")).toBe(true);
  expect(hasPermission("user", "memory:write")).toBe(true);
  expect(hasPermission("user", "memory:promote")).toBe(false);
  expect(hasPermission("user", "memory:delete")).toBe(false);
});

test("agents can promote", () => {
  expect(canPromote("agent")).toBe(true);
  expect(canPromote("user")).toBe(false);
  expect(canPromote("admin")).toBe(true);
});

// Encryption Tests
test("public data is not encrypted", () => {
  expect(shouldEncrypt("public")).toBe(false);
});

test("sensitive data is encrypted", () => {
  expect(shouldEncrypt("pii")).toBe(true);
  expect(shouldEncrypt("secret")).toBe(true);
  expect(shouldEncrypt("confidential")).toBe(true);
});

test("encryption and decryption work correctly", () => {
  const testData = { user: "john@example.com", age: 30 };

  const encrypted = encrypt(testData, "pii");
  expect(encrypted).toBeTruthy();

  const decrypted = decrypt(encrypted!, "pii");
  expect(decrypted).toEqual(testData);
});

test("public data returns null on encryption", () => {
  const testData = { public: "info" };
  const encrypted = encrypt(testData, "public");
  expect(encrypted).toBeNull();
});

// Schema Registry Tests
test("schema detection from key patterns", () => {
  expect(detectSchemaId("user:123:preference:theme")).toBe(
    "UserPreferenceSchema"
  );
  expect(detectSchemaId("project:456:architecture:backend")).toBe(
    "ArchitectureSchema"
  );
  expect(detectSchemaId("org:789:policy:code_review")).toBe("PolicySchema");
  expect(detectSchemaId("session:abc:context:current_file")).toBe(
    "ContextSchema"
  );
  expect(detectSchemaId("unknown:key")).toBeNull();
});

test("schema validation passes for valid content", () => {
  const validUserPref = { theme: "dark", value: "test" };
  const result = validateMemoryContent(validUserPref, "UserPreferenceSchema");
  expect(result.valid).toBe(true);
});

test("validation passes when no schema specified", () => {
  const anyContent = { anything: "goes" };
  const result = validateMemoryContent(anyContent, null);
  expect(result.valid).toBe(true);
});

// Metrics Tests
test("metrics can be recorded and retrieved", () => {
  const metrics = getMetricsCollector();
  metrics.reset();

  metrics.increment("memory_cache_l1_hit");
  metrics.increment("memory_cache_l1_hit");
  metrics.increment("memory_cache_l2_hit");

  expect(metrics.getCount("memory_cache_l1_hit")).toBe(2);
  expect(metrics.getCount("memory_cache_l2_hit")).toBe(1);
});

test("percentiles are calculated correctly", () => {
  const metrics = getMetricsCollector();
  metrics.reset();

  for (let i = 1; i <= 100; i++) {
    metrics.record("memory_get_workingset_latency_ms", i);
  }

  const p95 = metrics.getP95("memory_get_workingset_latency_ms");
  expect(p95).toBeGreaterThan(90);
  expect(p95).toBeLessThanOrEqual(100);
});

// AutoTuner Tests
test("autotuner provides cache configuration", () => {
  const tuner = getAutoTuner();
  const config = tuner.getCacheConfig();

  expect(config.l1MaxEntries).toBeGreaterThan(0);
  expect(config.l1TtlContext).toBeGreaterThan(0);
  expect(config.l2TtlPermanent).toBeGreaterThan(0);
});

test("autotuner provides promotion configuration", () => {
  const tuner = getAutoTuner();
  const config = tuner.getPromotionConfig();

  expect(config.minAccessCount).toBeGreaterThan(0);
  expect(config.minUsedInResponses).toBeGreaterThan(0);
  expect(config.minConfidence).toBeGreaterThan(0);
  expect(config.minConfidence).toBeLessThanOrEqual(1);
});

// Run all tests
export function runMemoryTests() {
  console.log("Running CEREBRO Memory System Tests...\n");

  for (const test of tests) {
    try {
      test.fn();
      passed++;
      console.log(`✓ ${test.name}`);
    } catch (error) {
      failed++;
      console.log(`✗ ${test.name}`);
      console.log(`  ${error}`);
    }
  }

  console.log(
    `\nTests: ${passed} passed, ${failed} failed, ${tests.length} total`
  );

  return { passed, failed, total: tests.length };
}

// Auto-run if executed directly
if (require.main === module) {
  runMemoryTests();
}
