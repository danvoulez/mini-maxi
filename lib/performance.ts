/**
 * Performance monitoring utilities
 * 
 * Tracks and reports Web Vitals and custom performance metrics.
 * 
 * @module performance
 */

/**
 * Web Vitals metric names
 */
export type WebVitalsMetric = 
  | 'CLS'   // Cumulative Layout Shift
  | 'FID'   // First Input Delay
  | 'FCP'   // First Contentful Paint
  | 'LCP'   // Largest Contentful Paint
  | 'TTFB'; // Time to First Byte

/**
 * Performance metric data
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id?: string;
  navigationType?: string;
}

/**
 * Performance thresholds for Web Vitals
 */
const WEB_VITALS_THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
};

/**
 * Calculate metric rating based on thresholds
 */
function getMetricRating(
  name: WebVitalsMetric,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = WEB_VITALS_THRESHOLDS[name];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Performance observer manager
 */
class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private observers: PerformanceObserver[] = [];
  private listeners: ((metric: PerformanceMetric) => void)[] = [];

  /**
   * Initialize performance monitoring
   */
  init() {
    if (typeof window === 'undefined') {
      return; // Server-side
    }

    this.observeWebVitals();
    this.observeCustomMetrics();
  }

  /**
   * Observe Web Vitals metrics
   */
  private observeWebVitals() {
    if (!('PerformanceObserver' in window)) {
      return;
    }

    // Observe CLS
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ((entry as any).hadRecentInput) {
            continue; // Ignore if caused by user input
          }
          const value = (entry as any).value || 0;
          this.reportMetric({
            name: 'CLS',
            value,
            rating: getMetricRating('CLS', value),
            id: entry.id,
          });
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(clsObserver);
    } catch (e) {
      console.warn('Failed to observe CLS:', e);
    }

    // Observe LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        const value = lastEntry.startTime;
        this.reportMetric({
          name: 'LCP',
          value,
          rating: getMetricRating('LCP', value),
          id: lastEntry.id,
        });
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.push(lcpObserver);
    } catch (e) {
      console.warn('Failed to observe LCP:', e);
    }

    // Observe FID
    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const value = (entry as any).processingStart - entry.startTime;
          this.reportMetric({
            name: 'FID',
            value,
            rating: getMetricRating('FID', value),
            id: entry.id,
          });
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
      this.observers.push(fidObserver);
    } catch (e) {
      console.warn('Failed to observe FID:', e);
    }

    // Observe FCP
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            const value = entry.startTime;
            this.reportMetric({
              name: 'FCP',
              value,
              rating: getMetricRating('FCP', value),
              id: entry.id,
            });
          }
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });
      this.observers.push(fcpObserver);
    } catch (e) {
      console.warn('Failed to observe FCP:', e);
    }

    // Observe TTFB
    try {
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const navEntry = entry as PerformanceNavigationTiming;
          const value = navEntry.responseStart - navEntry.requestStart;
          this.reportMetric({
            name: 'TTFB',
            value,
            rating: getMetricRating('TTFB', value),
            navigationType: navEntry.type,
          });
        }
      });
      navigationObserver.observe({ type: 'navigation', buffered: true });
      this.observers.push(navigationObserver);
    } catch (e) {
      console.warn('Failed to observe TTFB:', e);
    }
  }

  /**
   * Observe custom performance metrics
   */
  private observeCustomMetrics() {
    if (!('PerformanceObserver' in window)) {
      return;
    }

    try {
      const measureObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.reportMetric({
            name: entry.name,
            value: entry.duration,
            rating: 'good', // Custom metrics don't have standard thresholds
          });
        }
      });
      measureObserver.observe({ type: 'measure', buffered: true });
      this.observers.push(measureObserver);
    } catch (e) {
      console.warn('Failed to observe custom metrics:', e);
    }
  }

  /**
   * Report a metric
   */
  private reportMetric(metric: PerformanceMetric) {
    this.metrics.set(metric.name, metric);
    
    // Notify listeners
    for (const listener of this.listeners) {
      listener(metric);
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[Performance] ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`
      );
    }
  }

  /**
   * Add metric listener
   */
  onMetric(callback: (metric: PerformanceMetric) => void) {
    this.listeners.push(callback);
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get specific metric
   */
  getMetric(name: string): PerformanceMetric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear();
  }

  /**
   * Disconnect all observers
   */
  disconnect() {
    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers = [];
    this.listeners = [];
  }

  /**
   * Mark start of a custom performance measurement
   */
  mark(name: string) {
    if (typeof performance !== 'undefined') {
      performance.mark(name);
    }
  }

  /**
   * Measure duration between two marks
   */
  measure(name: string, startMark: string, endMark?: string) {
    if (typeof performance !== 'undefined') {
      try {
        if (endMark) {
          performance.measure(name, startMark, endMark);
        } else {
          performance.measure(name, startMark);
        }
      } catch (e) {
        console.warn(`Failed to measure ${name}:`, e);
      }
    }
  }

  /**
   * Measure async function execution time
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    
    this.mark(startMark);
    try {
      const result = await fn();
      this.mark(endMark);
      this.measure(name, startMark, endMark);
      return result;
    } catch (error) {
      this.mark(endMark);
      this.measure(name, startMark, endMark);
      throw error;
    }
  }

  /**
   * Get resource timing information
   */
  getResourceTiming(urlPattern?: RegExp): PerformanceResourceTiming[] {
    if (typeof performance === 'undefined') {
      return [];
    }

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    if (urlPattern) {
      return resources.filter((r) => urlPattern.test(r.name));
    }
    
    return resources;
  }

  /**
   * Get navigation timing
   */
  getNavigationTiming(): PerformanceNavigationTiming | null {
    if (typeof performance === 'undefined') {
      return null;
    }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return navigation || null;
  }

  /**
   * Send metrics to analytics endpoint
   */
  async sendToAnalytics(endpoint: string) {
    const metrics = this.getMetrics();
    
    if (metrics.length === 0) {
      return;
    }

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        }),
        // Use sendBeacon if available for reliability
        keepalive: true,
      });
    } catch (e) {
      console.warn('Failed to send metrics to analytics:', e);
    }
  }
}

/**
 * Global performance monitor instance
 */
let monitor: PerformanceMonitor | null = null;

/**
 * Get or create performance monitor instance
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!monitor) {
    monitor = new PerformanceMonitor();
    monitor.init();
  }
  return monitor;
}

/**
 * Report Web Vitals to console or analytics
 */
export function reportWebVitals(onPerfEntry?: (metric: PerformanceMetric) => void) {
  const monitor = getPerformanceMonitor();
  
  if (onPerfEntry) {
    monitor.onMetric(onPerfEntry);
  }
}

/**
 * Decorator for measuring function performance
 */
export function measure(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const monitor = getPerformanceMonitor();
    const name = `${target.constructor.name}.${propertyKey}`;
    return monitor.measureAsync(name, () => originalMethod.apply(this, args));
  };

  return descriptor;
}
