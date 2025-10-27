import crypto from "crypto";
import { getRedis } from "@/lib/redis/client";
import { getMetricsCollector } from "./metrics";

// L1 cache (best-effort, per-instance)
const L1_WS = new Map<string, { value: any; expiresAt: number }>();

const WS_TTL_MS_DEFAULT = 5 * 60 * 1000; // 5 min default

function hashParams(obj: unknown): string {
  try {
    const s = JSON.stringify(obj);
    return crypto.createHash("sha1").update(s).digest("hex");
  } catch (_) {
    return "na";
  }
}

export function wsCacheKey(ownerId: string, selectionParams: unknown) {
  return `cerebro:WS:${ownerId}:${hashParams(selectionParams)}`;
}

export function memCacheKey(id: string) {
  return `cerebro:MEM:${id}`;
}

export async function getWorkingSetCache(
  ownerId: string,
  selectionParams: unknown
) {
  const metrics = getMetricsCollector();
  const key = wsCacheKey(ownerId, selectionParams);
  // L1 first
  const l1 = L1_WS.get(key);
  if (l1 && l1.expiresAt > Date.now()) {
    metrics.increment("memory_cache_l1_hit");
    return l1.value;
  }

  // L2
  const redis = await getRedis();
  if (redis) {
    const raw = await redis.get(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Warm L1 with shorter TTL window
        L1_WS.set(key, { value: parsed, expiresAt: Date.now() + 60_000 });
        metrics.increment("memory_cache_l2_hit");
        return parsed;
      } catch {}
    }
  }

  metrics.increment("memory_cache_miss");
  return null;
}

export async function setWorkingSetCache(
  ownerId: string,
  selectionParams: unknown,
  value: unknown,
  ttlMs = WS_TTL_MS_DEFAULT
) {
  const key = wsCacheKey(ownerId, selectionParams);
  // L1
  L1_WS.set(key, { value, expiresAt: Date.now() + Math.min(ttlMs, 60_000) });
  // L2
  const redis = await getRedis();
  if (redis) {
    await redis
      .set(key, JSON.stringify(value), { EX: Math.ceil(ttlMs / 1000) })
      .catch(() => {});
  }
}

export async function invalidateOwnerWorkingSets(ownerId: string) {
  // Bust L1 by prefix
  const prefix = `cerebro:WS:${ownerId}:`;
  for (const k of Array.from(L1_WS.keys())) {
    if (k.startsWith(prefix)) L1_WS.delete(k);
  }
  const redis = await getRedis();
  if (!redis) return;
  // Best-effort SCAN + DEL by prefix
  let cursor = 0;
  do {
    const res: any = await (redis as any).scan(cursor, {
      MATCH: `${prefix}*`,
      COUNT: 100,
    });
    cursor = typeof res[0] === "string" ? Number.parseInt(res[0], 10) : res[0];
    const keys: string[] = res[1] || [];
    if (keys.length) await redis.del(keys).catch(() => {});
  } while (cursor !== 0);
}
