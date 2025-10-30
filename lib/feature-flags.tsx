/**
 * Feature flags system
 *
 * Enables/disables features dynamically without code deployment.
 * Supports percentage rollouts, user targeting, and A/B testing.
 *
 * @module feature-flags
 */

export interface FeatureFlag {
  /**
   * Unique feature identifier
   */
  key: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Feature description
   */
  description?: string;

  /**
   * Whether feature is enabled globally
   */
  enabled: boolean;

  /**
   * Percentage of users to enable (0-100)
   */
  rolloutPercentage?: number;

  /**
   * Specific user IDs to enable
   */
  enabledFor?: string[];

  /**
   * Specific user IDs to disable (takes precedence)
   */
  disabledFor?: string[];

  /**
   * Environment restrictions (dev, staging, production)
   */
  environments?: string[];
}

/**
 * Feature flag configuration
 */
const featureFlags: Record<string, FeatureFlag> = {
  // Example: Chat features
  voiceInput: {
    key: "voice_input",
    name: "Voice Input",
    description: "Enable voice input for chat messages",
    enabled: false,
    rolloutPercentage: 0,
  },

  chatExport: {
    key: "chat_export",
    name: "Chat Export",
    description: "Allow users to export chat history",
    enabled: true,
    environments: ["development", "production"],
  },

  advancedSearch: {
    key: "advanced_search",
    name: "Advanced Search",
    description: "Enhanced search with filters",
    enabled: true,
    rolloutPercentage: 50, // 50% rollout
  },

  // Example: CEREBRO features
  vectorSearch: {
    key: "vector_search",
    name: "Vector Search",
    description: "Use pgvector for semantic search",
    enabled: false,
    environments: ["production"],
  },

  autoPromotion: {
    key: "auto_promotion",
    name: "Auto Memory Promotion",
    description: "Automatically promote frequently used memories",
    enabled: true,
  },

  // Example: UI features
  darkMode: {
    key: "dark_mode",
    name: "Dark Mode",
    description: "Dark theme support",
    enabled: true,
  },

  skeletonLoading: {
    key: "skeleton_loading",
    name: "Skeleton Loading",
    description: "Show skeleton screens while loading",
    enabled: false,
    rolloutPercentage: 25,
  },

  // Example: Experimental features
  collaborativeChat: {
    key: "collaborative_chat",
    name: "Collaborative Chat",
    description: "Share and collaborate on chats",
    enabled: false,
    enabledFor: [], // Beta users only
  },
};

/**
 * Hash function for consistent user bucketing
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Check if user is in rollout percentage
 */
function isInRollout(userId: string, percentage: number): boolean {
  if (percentage === 0) return false;
  if (percentage === 100) return true;

  const hash = hashString(userId);
  const bucket = hash % 100;
  return bucket < percentage;
}

/**
 * Check if feature is enabled for user
 */
export function isFeatureEnabled(
  featureKey: string,
  userId?: string,
  environment?: string
): boolean {
  const flag = featureFlags[featureKey];

  if (!flag) {
    console.warn(`Feature flag '${featureKey}' not found`);
    return false;
  }

  // Check environment restrictions
  if (
    flag.environments &&
    environment &&
    !flag.environments.includes(environment)
  ) {
    return false;
  }

  // Check if globally disabled
  if (!flag.enabled) {
    return false;
  }

  // If no user ID provided, return global enabled state
  if (!userId) {
    return flag.enabled;
  }

  // Check disabled list (takes precedence)
  if (flag.disabledFor?.includes(userId)) {
    return false;
  }

  // Check enabled list
  if (flag.enabledFor) {
    return flag.enabledFor.includes(userId);
  }

  // Check rollout percentage
  if (flag.rolloutPercentage !== undefined) {
    return isInRollout(userId, flag.rolloutPercentage);
  }

  // Default to global enabled state
  return flag.enabled;
}

/**
 * Get all enabled features for user
 */
export function getEnabledFeatures(
  userId?: string,
  environment?: string
): string[] {
  return Object.keys(featureFlags).filter((key) =>
    isFeatureEnabled(key, userId, environment)
  );
}

/**
 * Get feature flag details
 */
export function getFeatureFlag(featureKey: string): FeatureFlag | null {
  return featureFlags[featureKey] || null;
}

/**
 * Get all feature flags
 */
export function getAllFeatureFlags(): FeatureFlag[] {
  return Object.values(featureFlags);
}

/**
 * Update feature flag (runtime configuration)
 * Use with caution - prefer environment variables or remote config
 */
export function updateFeatureFlag(
  featureKey: string,
  updates: Partial<Omit<FeatureFlag, "key">>
): void {
  const flag = featureFlags[featureKey];

  if (!flag) {
    throw new Error(`Feature flag '${featureKey}' not found`);
  }

  Object.assign(flag, updates);
}

/**
 * Feature flag hook for React components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const hasVoiceInput = useFeature('voice_input');
 *
 *   return (
 *     <div>
 *       {hasVoiceInput && <VoiceInputButton />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFeature(featureKey: string): boolean {
  // This should be implemented with React hooks in a client component
  // For now, returning false as placeholder
  if (typeof window === "undefined") {
    return false;
  }

  // In practice, you'd get userId from session/context
  // const userId = useSession()?.user?.id;
  // const environment = process.env.NODE_ENV;
  // return isFeatureEnabled(featureKey, userId, environment);

  return isFeatureEnabled(featureKey);
}

/**
 * Feature flag component for conditional rendering
 *
 * @example
 * ```tsx
 * <Feature name="voice_input">
 *   <VoiceInputButton />
 * </Feature>
 * ```
 */
export function Feature({
  name,
  children,
  fallback,
}: {
  name: string;
  children: any; // Using any instead of React.ReactNode to avoid React import
  fallback?: any;
}) {
  const enabled = useFeature(name);
  return enabled ? <>{children}</> : <>{fallback}</>;
}

/**
 * A/B test variant
 */
export type Variant = "control" | "variant-a" | "variant-b" | "variant-c";

/**
 * Get A/B test variant for user
 */
export function getVariant(
  testName: string,
  userId: string,
  variants: Variant[] = ["control", "variant-a"]
): Variant {
  const hash = hashString(`${testName}:${userId}`);
  const index = hash % variants.length;
  return variants[index];
}

/**
 * Track feature flag usage
 * Should be integrated with analytics
 */
export function trackFeatureUsage(
  featureKey: string,
  userId?: string,
  metadata?: Record<string, any>
): void {
  // TODO: Integrate with analytics platform
  if (process.env.NODE_ENV === "development") {
    console.log("[Feature Flag]", {
      feature: featureKey,
      userId,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  // In production, send to analytics
  // analytics.track('feature_used', { feature: featureKey, userId, ...metadata });
}

/**
 * Load feature flags from remote config
 * Useful for dynamic updates without deployment
 */
export async function loadRemoteFeatureFlags(endpoint: string): Promise<void> {
  // Only load if fetch is available (browser or Node 18+)
  if (typeof fetch === "undefined") {
    console.warn("fetch not available, skipping remote feature flags");
    return;
  }

  try {
    const response = await fetch(endpoint);
    const remoteFlags = await response.json();

    // Merge with local flags
    for (const [key, value] of Object.entries(remoteFlags)) {
      if (featureFlags[key]) {
        Object.assign(featureFlags[key], value);
      }
    }
  } catch (error) {
    console.error("Failed to load remote feature flags:", error);
  }
}

/**
 * Get current environment
 */
function getCurrentEnvironment(): string {
  return process.env.NODE_ENV || "development";
}

/**
 * Initialize feature flags from environment
 */
export function initFeatureFlags(): void {
  const env = getCurrentEnvironment();

  // Load from environment variables
  for (const [key, flag] of Object.entries(featureFlags)) {
    const envKey = `FEATURE_${key.toUpperCase()}`;
    const envValue = process.env[envKey];

    if (envValue !== undefined) {
      flag.enabled = envValue === "true" || envValue === "1";
    }
  }

  // Load from remote config if endpoint is configured
  const remoteEndpoint = process.env.FEATURE_FLAGS_ENDPOINT;
  if (remoteEndpoint) {
    loadRemoteFeatureFlags(remoteEndpoint);
  }
}

// Auto-initialize on import
if (typeof window !== "undefined") {
  initFeatureFlags();
}
