// RAG Manager with pluggable drivers + simple circuit breaker & cache
import postgres from "postgres";

export type RAGSource =
  | "vectorDB"
  | "webSearch"
  | "internalDocs"
  | "partnerAPIs";
export type RAGProvider = "pgIlike" | "vectorDB";

export interface RAGSnippet {
  source: RAGSource;
  content: string;
  confidence: number;
  metadata?: Record<string, any>;
}
export interface RAGCitation {
  source: string;
  url?: string;
  title?: string;
}

export interface RAGResult {
  ok: boolean;
  degraded?: boolean;
  snippets: RAGSnippet[];
  citations?: RAGCitation[];
}

interface RagDriver {
  readonly name: RAGProvider;
  search(query: string, hints?: Record<string, any>): Promise<RAGResult>;
}

// --- Driver: pgIlike over CEREBRO.memories (raw SQL, portable) ---
class PgIlikeDriver implements RagDriver {
  readonly name: RAGProvider = "pgIlike" as const;

  async search(query: string, hints?: Record<string, any>): Promise<RAGResult> {
    const url = process.env.POSTGRES_URL;
    if (!url) {
      return { ok: false, degraded: true, snippets: [] };
    }
    const sql = postgres(url);
    try {
      const q = `%${String(query || "").toLowerCase()}%`;
      const rows: any[] = await sql`
        SELECT key, layer, content, updated_at
        FROM memories
        WHERE LOWER(content::text) LIKE ${q}
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 8
      `;
      const snippets: RAGSnippet[] = rows.map((r) => ({
        source: "internalDocs",
        content:
          typeof r.content === "string" ? r.content : JSON.stringify(r.content),
        confidence: 0.6,
        metadata: { key: r.key, layer: r.layer, updatedAt: r.updated_at },
      }));
      return { ok: true, snippets };
    } finally {
      await sql.end({ timeout: 1 });
    }
  }
}

// --- Driver: vectorDB (stub) ---
class VectorDbDriver implements RagDriver {
  readonly name: RAGProvider = "vectorDB" as const;
  async search(query: string, hints?: Record<string, any>): Promise<RAGResult> {
    const url = process.env.POSTGRES_URL;
    if (!url) return { ok: false, degraded: true, snippets: [] };
    const sql = (await import("postgres")).default(url);
    try {
      // 1) Embed query
      const { embedText } = await import("./embeddings");
      const qvec = await embedText(query || "");
      // 2) Query by vector distance (L2). pgvector stores as 'vector'
      const rows: any[] = await sql`
        SELECT key, layer, content, updated_at, (embedding <-> ${sql.unsafe("ARRAY[" + qvec.join(",") + "]")}) as distance
        FROM memories
        WHERE embedding IS NOT NULL
        ORDER BY embedding <-> ${sql.unsafe("ARRAY[" + qvec.join(",") + "]")}
        LIMIT 8
      `;
      const snippets: RAGSnippet[] = rows.map((r) => ({
        source: "internalDocs",
        content:
          typeof r.content === "string" ? r.content : JSON.stringify(r.content),
        confidence: Math.max(0, 1 - Number(r.distance || 0)),
        metadata: {
          key: r.key,
          layer: r.layer,
          updatedAt: r.updated_at,
          distance: r.distance,
        },
      }));
      return { ok: true, snippets };
    } catch (e) {
      return { ok: false, degraded: true, snippets: [] };
    } finally {
      await sql.end({ timeout: 1 });
    }
  }
}

// --- Simple circuit breaker ---
type CBState = "CLOSED" | "OPEN" | "HALF_OPEN";
class CircuitBreaker {
  private state: CBState = "CLOSED";
  private failureCount = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private nextTryAt = 0;

  constructor(opts?: { threshold?: number; cooldownMs?: number }) {
    this.threshold = opts?.threshold ?? 3;
    this.cooldownMs = opts?.cooldownMs ?? 5000;
  }
  onSuccess() {
    this.failureCount = 0;
    this.state = "CLOSED";
  }
  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = "OPEN";
      this.nextTryAt = Date.now() + this.cooldownMs;
    }
  }
  canTry() {
    if (this.state === "OPEN" && Date.now() >= this.nextTryAt) {
      this.state = "HALF_OPEN";
      return true;
    }
    return this.state !== "OPEN";
  }
  getState() {
    return this.state;
  }
}

// --- Manager ---
export class RAGManager {
  private cache = new Map<string, { at: number; result: RAGResult }>();
  private circuitBreaker = new CircuitBreaker();
  private driver: RagDriver;
  private ttlMs: number;

  constructor(opts?: { provider?: RAGProvider; ttlMs?: number }) {
    const provider =
      opts?.provider ?? (process.env.RAG_PROVIDER as RAGProvider) ?? "pgIlike";
    this.driver =
      provider === "vectorDB" ? new VectorDbDriver() : new PgIlikeDriver();
    this.ttlMs = opts?.ttlMs ?? 15_000; // 15s cache para queries repetidas curtas
  }

  private key(query: string, hints?: Record<string, any>) {
    return `${this.driver.name}:${query}:${JSON.stringify(hints ?? {})}`;
  }

  async retrieve(
    query: string,
    hints?: Record<string, any>
  ): Promise<RAGResult> {
    const cacheKey = this.key(query, hints);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.at < this.ttlMs) {
      return cached.result;
    }

    if (!this.circuitBreaker.canTry()) {
      const fallback = cached?.result ?? {
        ok: false,
        degraded: true,
        snippets: [],
      };
      return { ...fallback, degraded: true };
    }

    try {
      const result = await this.driver.search(query, hints);
      if (result.ok) {
        this.circuitBreaker.onSuccess();
        this.cache.set(cacheKey, { at: now, result });
        return result;
      }
      this.circuitBreaker.onFailure();
      const fallback = cached?.result ?? {
        ok: false,
        degraded: true,
        snippets: [],
      };
      return { ...fallback, degraded: true };
    } catch {
      this.circuitBreaker.onFailure();
      const fallback = cached?.result ?? {
        ok: false,
        degraded: true,
        snippets: [],
      };
      return { ...fallback, degraded: true };
    }
  }

  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }
  clearCache() {
    this.cache.clear();
  }
}
