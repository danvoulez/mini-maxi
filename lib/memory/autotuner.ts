// Auto-optimization and tuning (EP5-AutoOtimizacao)
import { getMetricsCollector } from "./metrics";

export interface CacheConfig {
  l1MaxEntries: number;
  l1TtlContext: number;
  l1TtlTemporary: number;
  l1TtlPermanent: number;
  l2TtlContext: number;
  l2TtlTemporary: number;
  l2TtlPermanent: number;
}

export interface PromotionConfig {
  minAccessCount: number;
  minUsedInResponses: number;
  minConfidence: number;
}

export class AutoTuner {
  private currentCacheConfig: CacheConfig = {
    l1MaxEntries: 10_000,
    l1TtlContext: 300,
    l1TtlTemporary: 1800,
    l1TtlPermanent: 3600,
    l2TtlContext: 600,
    l2TtlTemporary: 3600,
    l2TtlPermanent: 86_400,
  };

  private currentPromotionConfig: PromotionConfig = {
    minAccessCount: 20,
    minUsedInResponses: 10,
    minConfidence: 0.7,
  };

  private maxChangePercent = 50;
  private rollbackOnDegradation = true;
  private previousConfigs: Array<{
    cache: CacheConfig;
    promotion: PromotionConfig;
    timestamp: number;
  }> = [];

  getCacheConfig(): CacheConfig {
    return { ...this.currentCacheConfig };
  }

  getPromotionConfig(): PromotionConfig {
    return { ...this.currentPromotionConfig };
  }

  optimizeCacheSizing() {
    const metrics = getMetricsCollector();

    const l1Hits = metrics.getCount("memory_cache_l1_hit");
    const l2Hits = metrics.getCount("memory_cache_l2_hit");
    const misses = metrics.getCount("memory_cache_miss");
    const total = l1Hits + l2Hits + misses;

    if (total < 100) {
      return { changed: false, reason: "Insufficient data for optimization" };
    }

    const l1HitRate = l1Hits / total;
    const l2HitRate = l2Hits / total;
    const missRate = misses / total;

    const changes: string[] = [];
    const newConfig = { ...this.currentCacheConfig };

    // If L1 hit rate is low but L2 hit rate is high, increase L1 cache size
    if (l1HitRate < 0.5 && l2HitRate > 0.3) {
      const increase = Math.min(
        Math.floor(this.currentCacheConfig.l1MaxEntries * 0.2),
        Math.floor(
          this.currentCacheConfig.l1MaxEntries * (this.maxChangePercent / 100)
        )
      );
      newConfig.l1MaxEntries += increase;
      changes.push(`Increased L1 cache size by ${increase} entries`);
    }

    // If miss rate is high, increase TTLs
    if (missRate > 0.4) {
      const ttlIncrease = 1.2;
      newConfig.l1TtlContext = Math.min(
        Math.floor(newConfig.l1TtlContext * ttlIncrease),
        Math.floor(
          this.currentCacheConfig.l1TtlContext *
            (1 + this.maxChangePercent / 100)
        )
      );
      newConfig.l1TtlTemporary = Math.min(
        Math.floor(newConfig.l1TtlTemporary * ttlIncrease),
        Math.floor(
          this.currentCacheConfig.l1TtlTemporary *
            (1 + this.maxChangePercent / 100)
        )
      );
      changes.push("Increased cache TTLs by 20%");
    }

    if (changes.length > 0) {
      this.previousConfigs.push({
        cache: this.currentCacheConfig,
        promotion: this.currentPromotionConfig,
        timestamp: Date.now(),
      });
      this.currentCacheConfig = newConfig;
      return { changed: true, changes, newConfig };
    }

    return { changed: false, reason: "No optimization needed" };
  }

  optimizePromotionPolicy() {
    const metrics = getMetricsCollector();

    const promotions = metrics.getCount("memory_promote_count");
    const needsReview = metrics.getCount("memory_needs_review_count");

    if (promotions + needsReview < 10) {
      return { changed: false, reason: "Insufficient data for optimization" };
    }

    const changes: string[] = [];
    const newConfig = { ...this.currentPromotionConfig };

    // If too many items need review, relax criteria
    if (needsReview > promotions * 2) {
      newConfig.minAccessCount = Math.max(
        Math.floor(newConfig.minAccessCount * 0.8),
        5
      );
      newConfig.minUsedInResponses = Math.max(
        Math.floor(newConfig.minUsedInResponses * 0.8),
        3
      );
      newConfig.minConfidence = Math.max(newConfig.minConfidence * 0.9, 0.5);
      changes.push("Relaxed promotion criteria to reduce review backlog");
    }

    // If promotions are too frequent, tighten criteria
    if (promotions > 100 && needsReview < 10) {
      newConfig.minAccessCount = Math.floor(newConfig.minAccessCount * 1.2);
      newConfig.minUsedInResponses = Math.floor(
        newConfig.minUsedInResponses * 1.2
      );
      newConfig.minConfidence = Math.min(newConfig.minConfidence * 1.1, 0.95);
      changes.push("Tightened promotion criteria to be more selective");
    }

    if (changes.length > 0) {
      this.previousConfigs.push({
        cache: this.currentCacheConfig,
        promotion: this.currentPromotionConfig,
        timestamp: Date.now(),
      });
      this.currentPromotionConfig = newConfig;
      return { changed: true, changes, newConfig };
    }

    return { changed: false, reason: "No optimization needed" };
  }

  rollback() {
    if (this.previousConfigs.length === 0) {
      return {
        success: false,
        reason: "No previous configuration to rollback to",
      };
    }

    const previous = this.previousConfigs.pop()!;
    this.currentCacheConfig = previous.cache;
    this.currentPromotionConfig = previous.promotion;

    return { success: true, rolledBackTo: previous.timestamp };
  }

  checkDegradation(): boolean {
    const metrics = getMetricsCollector();

    const p95Latency = metrics.getP95("memory_get_workingset_latency_ms");
    const alerts = metrics.checkAlerts();

    // If latency is too high or there are alerts, we might have degradation
    return p95Latency > 500 || alerts.length > 2;
  }

  autoOptimize() {
    const cacheResult = this.optimizeCacheSizing();
    const promotionResult = this.optimizePromotionPolicy();

    const results = {
      cache: cacheResult,
      promotion: promotionResult,
      timestamp: Date.now(),
    };

    // Check for degradation after changes
    if (
      (cacheResult.changed || promotionResult.changed) &&
      this.rollbackOnDegradation
    ) {
      setTimeout(() => {
        if (this.checkDegradation()) {
          this.rollback();
        }
      }, 60_000); // Check after 1 minute
    }

    return results;
  }

  getReport() {
    const metrics = getMetricsCollector();

    return {
      currentConfig: {
        cache: this.currentCacheConfig,
        promotion: this.currentPromotionConfig,
      },
      metrics: metrics.getReport(),
      alerts: metrics.checkAlerts(),
      historyLength: this.previousConfigs.length,
    };
  }
}

// Global singleton
let globalAutoTuner: AutoTuner | null = null;

export function getAutoTuner(): AutoTuner {
  if (!globalAutoTuner) {
    globalAutoTuner = new AutoTuner();
  }
  return globalAutoTuner;
}
