// Observability and Metrics (EP3-Qualidade & EP5-AutoOtimizacao)
export type MetricName =
  | "memory_cache_l1_hit"
  | "memory_cache_l2_hit"
  | "memory_cache_miss"
  | "memory_get_workingset_latency_ms"
  | "memory_upsert_latency_ms"
  | "memory_promote_latency_ms"
  | "memory_upsert_count"
  | "memory_promote_count"
  | "memory_archive_count"
  | "memory_demote_count"
  | "memory_used_context_count"
  | "memory_used_temporary_count"
  | "memory_used_permanent_count"
  | "rag_trigger_count"
  | "rag_latency_ms"
  | "rag_fallback_count"
  | "rag_error_count"
  | "memory_needs_review_count"
  | "memory_validation_error_count"
  | "drift_detected_count"
  | "llm_answer_with_memory_ratio"
  | "llm_context_token_usage";

interface Metric {
  name: MetricName;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private readonly MAX_METRICS_PER_TYPE = 1000;

  record(name: MetricName, value: number, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    const existing = this.metrics.get(key) || [];

    existing.push({
      name,
      value,
      timestamp: Date.now(),
      labels,
    });

    // Keep only recent metrics
    if (existing.length > this.MAX_METRICS_PER_TYPE) {
      existing.shift();
    }

    this.metrics.set(key, existing);
  }

  increment(name: MetricName, labels?: Record<string, string>) {
    this.record(name, 1, labels);
  }

  recordLatency(
    name: MetricName,
    startTime: number,
    labels?: Record<string, string>
  ) {
    const latency = Date.now() - startTime;
    this.record(name, latency, labels);
  }

  getMetrics(name: MetricName, labels?: Record<string, string>): Metric[] {
    const key = this.getKey(name, labels);
    return this.metrics.get(key) || [];
  }

  getP95(name: MetricName, labels?: Record<string, string>): number {
    return this.getPercentile(name, 0.95, labels);
  }

  getP99(name: MetricName, labels?: Record<string, string>): number {
    return this.getPercentile(name, 0.99, labels);
  }

  private getPercentile(
    name: MetricName,
    percentile: number,
    labels?: Record<string, string>
  ): number {
    const metrics = this.getMetrics(name, labels);
    if (metrics.length === 0) return 0;

    const sorted = metrics.map((m) => m.value).sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index] || 0;
  }

  getAverage(name: MetricName, labels?: Record<string, string>): number {
    const metrics = this.getMetrics(name, labels);
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  getCount(name: MetricName, labels?: Record<string, string>): number {
    const metrics = this.getMetrics(name, labels);
    return metrics.reduce((acc, m) => acc + m.value, 0);
  }

  getSum(name: MetricName, labels?: Record<string, string>): number {
    return this.getCount(name, labels);
  }

  private getKey(name: MetricName, labels?: Record<string, string>): string {
    if (!labels) return name;
    const sortedLabels = Object.keys(labels)
      .sort()
      .map((k) => `${k}=${labels[k]}`)
      .join(",");
    return `${name}{${sortedLabels}}`;
  }

  getReport() {
    const report: Record<string, any> = {};

    for (const [key, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue;

      const name = metrics[0].name;
      const values = metrics.map((m) => m.value);
      const sum = values.reduce((a, b) => a + b, 0);

      report[key] = {
        count: metrics.length,
        sum,
        avg: sum / metrics.length,
        min: Math.min(...values),
        max: Math.max(...values),
        recent: values.slice(-10),
      };
    }

    return report;
  }

  checkAlerts() {
    const alerts: string[] = [];

    // High memory latency
    const p95Latency = this.getP95("memory_get_workingset_latency_ms");
    if (p95Latency > 250) {
      alerts.push(`High memory latency P95: ${p95Latency}ms > 250ms`);
    }

    // Low L2 hit ratio
    const l1Hits = this.getCount("memory_cache_l1_hit");
    const l2Hits = this.getCount("memory_cache_l2_hit");
    const misses = this.getCount("memory_cache_miss");
    const total = l1Hits + l2Hits + misses;

    if (total > 100) {
      const l2HitRatio = l2Hits / total;
      if (l2HitRatio < 0.4) {
        alerts.push(
          `Low L2 hit ratio: ${(l2HitRatio * 100).toFixed(1)}% < 40%`
        );
      }
    }

    // RAG fallback rate
    const ragTriggers = this.getCount("rag_trigger_count");
    const ragFallbacks = this.getCount("rag_fallback_count");

    if (ragTriggers > 10) {
      const fallbackRate = ragFallbacks / ragTriggers;
      if (fallbackRate > 0.1) {
        alerts.push(
          `High RAG fallback rate: ${(fallbackRate * 100).toFixed(1)}% > 10%`
        );
      }
    }

    return alerts;
  }

  reset() {
    this.metrics.clear();
  }
}

// Global singleton
let globalMetrics: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!globalMetrics) {
    globalMetrics = new MetricsCollector();
  }
  return globalMetrics;
}

// Helper for timing operations
export async function withMetrics<T>(
  name: MetricName,
  fn: () => Promise<T>,
  labels?: Record<string, string>
): Promise<T> {
  const metrics = getMetricsCollector();
  const startTime = Date.now();

  try {
    const result = await fn();
    metrics.recordLatency(name, startTime, labels);
    return result;
  } catch (error) {
    metrics.recordLatency(name, startTime, { ...labels, error: "true" });
    throw error;
  }
}
