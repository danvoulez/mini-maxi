import { and, desc, gt, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { type MemoryRow, memories, memoryAudit } from "@/lib/db/cerebro";
import {
  getWorkingSetCache,
  invalidateOwnerWorkingSets,
  setWorkingSetCache,
} from "./cache";
import {
  decrypt,
  encrypt,
  type SensitivityLevel,
  shouldEncrypt,
} from "./encryption";
import {
  CEREBRO_TOKEN_BUDGET_MODEL_RESERVE,
  CEREBRO_TOKEN_BUDGET_TOTAL,
} from "./env";
import type { Role } from "./rbac";
import { canPromote } from "./rbac";
import { detectSchemaId, validateMemoryContent } from "./schema-registry";

function estimateTokens(obj: unknown): number {
  try {
    const s = typeof obj === "string" ? obj : JSON.stringify(obj);
    // rough heuristic ~4 chars/token
    return Math.ceil(s.length / 4);
  } catch {
    return 64;
  }
}

function layerPriority(layer: string): number {
  switch (layer) {
    case "context":
      return 3;
    case "temporary":
      return 2;
    case "permanent":
      return 1;
    default:
      return 0;
  }
}

export type WorkingSetRequest = {
  ownerId: string;
  maxTokens?: number;
  reserveForModel?: number;
  layers?: ("context" | "temporary" | "permanent")[];
  includeScopes?: ("agent_managed" | "user_owned")[];
  tags?: string[];
  now?: string;
};

export class MemoryManager {
  constructor(private connStr: string) {}

  private db() {
    const client = postgres(this.connStr);
    const db = drizzle(client);
    return { client, db } as const;
  }

  async getWorkingSet(req: WorkingSetRequest) {
    const selectionParams = {
      ownerId: req.ownerId,
      maxTokens: req.maxTokens ?? CEREBRO_TOKEN_BUDGET_TOTAL,
      reserveForModel:
        req.reserveForModel ?? CEREBRO_TOKEN_BUDGET_MODEL_RESERVE,
      layers: req.layers ?? ["context", "temporary", "permanent"],
      includeScopes: req.includeScopes ?? ["agent_managed", "user_owned"],
      tags: req.tags ?? [],
      now: req.now ?? new Date().toISOString(),
    };

    // Try cache first (L1/L2)
    const cached = await getWorkingSetCache(req.ownerId, selectionParams);
    if (cached) return cached;

    const { client, db } = this.db();
    try {
      const nowTs = new Date(selectionParams.now);

      const whereClauses = [
        sql`${memories.ownerId} = ${selectionParams.ownerId}`,
        inArray(memories.scope, selectionParams.includeScopes as any),
        inArray(memories.layer, selectionParams.layers as any),
        or(sql`${memories.expiresAt} IS NULL`, gt(memories.expiresAt, nowTs)),
      ];

      if (selectionParams.tags && selectionParams.tags.length) {
        whereClauses.push(
          sql`${memories.tags} ?| ${selectionParams.tags}` as any
        );
      }

      const candidates: MemoryRow[] = await db
        .select()
        .from(memories)
        .where(and.apply(null, whereClauses as any))
        .limit(1000); // hard cap

      // Rank in-app
      const ranked = [...candidates].sort((a, b) => {
        const lp = layerPriority(a.layer) - layerPriority(b.layer);
        if (lp !== 0) return lp * -1; // higher first
        const nr =
          Number((b as any).needsReview === false) -
          Number((a as any).needsReview === false);
        if (nr !== 0) return nr;
        const conf = (b.confidence ?? 0) - (a.confidence ?? 0);
        if (conf !== 0) return conf > 0 ? 1 : -1;
        const used = (b.usedInResponses ?? 0) - (a.usedInResponses ?? 0);
        if (used !== 0) return used;
        const acc = (b.accessCount ?? 0) - (a.accessCount ?? 0);
        if (acc !== 0) return acc;
        return (
          (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0)
        );
      });

      // Greedy fit into token budget
      const cap = Math.max(
        0,
        selectionParams.maxTokens - selectionParams.reserveForModel
      );
      const items: any[] = [];
      let usedTokens = 0;

      for (const it of ranked) {
        const tokenCost =
          it.tokenCost && it.tokenCost > 0
            ? it.tokenCost
            : estimateTokens(it.content);
        if (usedTokens + tokenCost > cap) continue;
        usedTokens += tokenCost;
        items.push({
          id: it.id,
          scope: it.scope,
          layer: it.layer,
          key: it.key,
          attribute: it.attribute,
          detail: it.detail,
          tags: it.tags,
          content: it.content,
          tokenCost,
          confidence: it.confidence,
        });
      }

      // Increment access_count for selected IDs
      if (items.length) {
        const ids = items.map((x) => x.id);
        await db
          .update(memories)
          .set({
            accessCount: sql`${memories.accessCount} + 1`,
            updatedAt: sql`now()`,
          })
          .where(inArray(memories.id, ids as any));
      }

      const result = {
        totalTokens: usedTokens,
        items,
        budget: {
          cap: selectionParams.maxTokens,
          reservedForModel: selectionParams.reserveForModel,
          availableForContext: usedTokens,
        },
      };

      // Cache working set
      await setWorkingSetCache(req.ownerId, selectionParams, result);

      // Minimal audit log
      await db.insert(memoryAudit).values({
        ownerId: req.ownerId,
        action: "PREWARM",
        entityId: null,
        entityKey: null,
        scope: null,
        layer: null,
        before: null,
        after:
          sql`jsonb_build_object('items', ${JSON.stringify(items.map((i: any) => i.id))})` as any,
        requestId: null,
      });

      return result;
    } finally {
      await (client as any).end({ timeout: 1 });
    }
  }

  async upsertMemory(params: {
    ownerId: string;
    scope: "agent_managed" | "user_owned";
    layer: "context" | "temporary" | "permanent";
    key: string;
    attribute?: string;
    detail?: string;
    content: any;
    confidence?: number;
    tags?: string[];
    ttlSeconds?: number;
    needsReview?: boolean;
    requestId?: string;
    actorId?: string;
    sensitivity?: SensitivityLevel;
  }) {
    const { client, db } = this.db();
    try {
      // Auto-detect schema
      const schemaId = detectSchemaId(params.key);

      // Validate content against schema
      const validation = validateMemoryContent(params.content, schemaId);
      if (!validation.valid) {
        return {
          id: null,
          updated: false,
          error: `Schema validation failed: ${validation.error}`,
          needsReview: true,
        };
      }

      // Encrypt content if needed
      let contentToStore = params.content;
      const sensitivity = params.sensitivity || "public";

      if (shouldEncrypt(sensitivity)) {
        const encrypted = encrypt(params.content, sensitivity);
        if (encrypted) {
          contentToStore = { _encrypted: encrypted, _sensitivity: sensitivity };
        }
      }

      const existing = await db
        .select()
        .from(memories)
        .where(
          and(
            sql`${memories.ownerId} = ${params.ownerId}`,
            sql`${memories.key} = ${params.key}`
          )
        )
        .limit(1);

      const expiresAt = params.ttlSeconds
        ? new Date(Date.now() + params.ttlSeconds * 1000)
        : null;
      const tokenCost = estimateTokens(params.content);

      if (existing.length) {
        const before = existing[0];
        await db
          .update(memories)
          .set({
            scope: params.scope,
            layer: params.layer,
            attribute: params.attribute,
            detail: params.detail,
            tags: (params.tags as any) ?? before.tags,
            content: contentToStore as any,
            confidence: params.confidence ?? before.confidence,
            needsReview:
              (params.needsReview as any) ??
              (before as any).needsReview ??
              false,
            tokenCost,
            expiresAt: expiresAt as any,
            updatedAt: sql`now()` as any,
            schemaId: schemaId ?? before.schemaId,
          })
          .where(sql`${memories.id} = ${before.id}`);

        // Audit
        await db.insert(memoryAudit).values({
          ownerId: params.ownerId,
          actorId: params.actorId ?? null,
          action: "UPDATE",
          entityId: before.id,
          entityKey: params.key,
          scope: params.scope,
          layer: params.layer,
          before: before as any,
          after: params as any,
          requestId: params.requestId ?? null,
        });

        // Invalidate caches
        await invalidateOwnerWorkingSets(params.ownerId);
        return { id: existing[0].id, updated: true };
      }

      const inserted = await db
        .insert(memories)
        .values({
          ownerId: params.ownerId,
          scope: params.scope,
          layer: params.layer,
          key: params.key,
          attribute: params.attribute,
          detail: params.detail,
          tags: (params.tags as any) ?? [],
          content: contentToStore as any,
          tokenCost,
          confidence: params.confidence ?? 0,
          needsReview: (params.needsReview as any) ?? false,
          expiresAt: expiresAt as any,
          schemaId,
        })
        .returning({ id: memories.id });

      const id = inserted[0].id as string;

      await db.insert(memoryAudit).values({
        ownerId: params.ownerId,
        actorId: params.actorId ?? null,
        action: "CREATE",
        entityId: id,
        entityKey: params.key,
        scope: params.scope,
        layer: params.layer,
        before: null,
        after: params as any,
        requestId: params.requestId ?? null,
      });

      await invalidateOwnerWorkingSets(params.ownerId);
      return { id, updated: false };
    } finally {
      await (client as any).end({ timeout: 1 });
    }
  }

  async deleteByIdsOrKeys(params: {
    ownerId: string;
    ids?: string[];
    keys?: string[];
    requestId?: string;
    actorId?: string;
  }) {
    const { client, db } = this.db();
    try {
      let deleted = 0;
      if (params.ids && params.ids.length) {
        const toDelete = await db
          .select()
          .from(memories)
          .where(
            and(
              sql`${memories.ownerId} = ${params.ownerId}`,
              inArray(memories.id, params.ids as any)
            )
          );
        await db
          .delete(memories)
          .where(
            and(
              sql`${memories.ownerId} = ${params.ownerId}`,
              inArray(memories.id, params.ids as any)
            )
          );
        deleted += toDelete.length;
        for (const row of toDelete) {
          await db.insert(memoryAudit).values({
            ownerId: params.ownerId,
            actorId: params.actorId ?? null,
            action: "DELETE",
            entityId: row.id,
            entityKey: row.key,
            scope: row.scope,
            layer: row.layer,
            before: row as any,
            after: null,
            requestId: params.requestId ?? null,
          });
        }
      }
      if (params.keys && params.keys.length) {
        const toDelete = await db
          .select()
          .from(memories)
          .where(
            and(
              sql`${memories.ownerId} = ${params.ownerId}`,
              inArray(memories.key, params.keys as any)
            )
          );
        await db
          .delete(memories)
          .where(
            and(
              sql`${memories.ownerId} = ${params.ownerId}`,
              inArray(memories.key, params.keys as any)
            )
          );
        deleted += toDelete.length;
        for (const row of toDelete) {
          await db.insert(memoryAudit).values({
            ownerId: params.ownerId,
            actorId: params.actorId ?? null,
            action: "DELETE",
            entityId: row.id,
            entityKey: row.key,
            scope: row.scope,
            layer: row.layer,
            before: row as any,
            after: null,
            requestId: params.requestId ?? null,
          });
        }
      }

      await invalidateOwnerWorkingSets(params.ownerId);
      return { deleted };
    } finally {
      await (client as any).end({ timeout: 1 });
    }
  }

  async promote(params: {
    ownerId: string;
    key: string;
    force?: boolean;
    merge?: boolean;
    reason?: string;
    requestId?: string;
    actorId?: string;
    actorRole?: Role;
  }) {
    const { client, db } = this.db();
    try {
      // Check permissions
      if (params.actorRole && !canPromote(params.actorRole)) {
        return { ok: false, error: "Insufficient permissions to promote" };
      }

      // Get the temporary memory
      const existing = await db
        .select()
        .from(memories)
        .where(
          and(
            sql`${memories.ownerId} = ${params.ownerId}`,
            sql`${memories.key} = ${params.key}`,
            sql`${memories.layer} = 'temporary'`
          )
        )
        .limit(1);

      if (!existing.length) {
        return { ok: false, error: "Memory not found in temporary layer" };
      }

      const memory = existing[0];

      // Check needsReview flag
      if ((memory as any).needsReview && !params.force) {
        return {
          ok: false,
          error: "Memory needs review, use force=true to promote anyway",
        };
      }

      // Check auto-promotion criteria
      const minAccessCount = 20;
      const minUsedInResponses = 10;
      const minConfidence = 0.7;

      if (
        !params.force &&
        ((memory.accessCount ?? 0) < minAccessCount ||
          (memory.usedInResponses ?? 0) < minUsedInResponses ||
          (memory.confidence ?? 0) < minConfidence)
      ) {
        return {
          ok: false,
          error: `Memory does not meet promotion criteria. Access: ${memory.accessCount}/${minAccessCount}, Used: ${memory.usedInResponses}/${minUsedInResponses}, Confidence: ${memory.confidence}/${minConfidence}`,
        };
      }

      // Check if permanent memory with same key exists
      const permanentExists = await db
        .select()
        .from(memories)
        .where(
          and(
            sql`${memories.ownerId} = ${params.ownerId}`,
            sql`${memories.key} = ${params.key}`,
            sql`${memories.layer} = 'permanent'`
          )
        )
        .limit(1);

      if (permanentExists.length && !params.merge) {
        return {
          ok: false,
          error: "Permanent memory already exists, use merge=true to merge",
        };
      }

      if (permanentExists.length && params.merge) {
        // Merge: update existing permanent
        await db
          .update(memories)
          .set({
            content: memory.content,
            confidence: Math.max(
              memory.confidence ?? 0,
              permanentExists[0].confidence ?? 0
            ),
            accessCount:
              (permanentExists[0].accessCount ?? 0) + (memory.accessCount ?? 0),
            usedInResponses:
              (permanentExists[0].usedInResponses ?? 0) +
              (memory.usedInResponses ?? 0),
            updatedAt: sql`now()` as any,
            expiresAt: null as any, // Permanent never expires
          })
          .where(sql`${memories.id} = ${permanentExists[0].id}`);

        // Delete temporary
        await db.delete(memories).where(sql`${memories.id} = ${memory.id}`);

        await db.insert(memoryAudit).values({
          ownerId: params.ownerId,
          actorId: params.actorId ?? null,
          action: "PROMOTE_MERGE",
          entityId: permanentExists[0].id,
          entityKey: params.key,
          scope: memory.scope,
          layer: "permanent" as any,
          before: permanentExists[0] as any,
          after: {
            ...memory,
            layer: "permanent",
            reason: params.reason,
          } as any,
          requestId: params.requestId ?? null,
        });
      } else {
        // Simple promotion: update layer
        await db
          .update(memories)
          .set({
            layer: "permanent" as any,
            expiresAt: null as any, // Permanent never expires
            updatedAt: sql`now()` as any,
          })
          .where(sql`${memories.id} = ${memory.id}`);

        await db.insert(memoryAudit).values({
          ownerId: params.ownerId,
          actorId: params.actorId ?? null,
          action: "PROMOTE",
          entityId: memory.id,
          entityKey: params.key,
          scope: memory.scope,
          layer: "permanent" as any,
          before: memory as any,
          after: {
            ...memory,
            layer: "permanent",
            reason: params.reason,
          } as any,
          requestId: params.requestId ?? null,
        });
      }

      await invalidateOwnerWorkingSets(params.ownerId);
      return { ok: true };
    } finally {
      await (client as any).end({ timeout: 1 });
    }
  }

  async search(params: {
    ownerId: string;
    query?: string;
    layer?: "context" | "temporary" | "permanent";
    keys?: string[];
    tags?: string[];
    minConfidence?: number;
    limit?: number;
  }) {
    const { client, db } = this.db();
    try {
      const whereClauses = [sql`${memories.ownerId} = ${params.ownerId}`];

      if (params.layer) {
        whereClauses.push(sql`${memories.layer} = ${params.layer}`);
      }

      if (params.keys && params.keys.length) {
        whereClauses.push(inArray(memories.key, params.keys as any));
      }

      if (params.tags && params.tags.length) {
        whereClauses.push(sql`${memories.tags} ?| ${params.tags}` as any);
      }

      if (params.minConfidence !== undefined) {
        whereClauses.push(
          sql`${memories.confidence} >= ${params.minConfidence}`
        );
      }

      if (params.query) {
        // Simple text search in key or content
        whereClauses.push(
          or(
            sql`${memories.key} ILIKE ${"%" + params.query + "%"}`,
            sql`${memories.content}::text ILIKE ${"%" + params.query + "%"}`
          ) as any
        );
      }

      const results = await db
        .select()
        .from(memories)
        .where(and.apply(null, whereClauses as any))
        .orderBy(desc(memories.confidence), desc(memories.updatedAt))
        .limit(params.limit ?? 100);

      return {
        items: results.map((r) => ({
          id: r.id,
          scope: r.scope,
          layer: r.layer,
          key: r.key,
          attribute: r.attribute,
          detail: r.detail,
          tags: r.tags,
          content: r.content,
          confidence: r.confidence,
          usedInResponses: r.usedInResponses,
          accessCount: r.accessCount,
          needsReview: r.needsReview,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      };
    } finally {
      await (client as any).end({ timeout: 1 });
    }
  }
}
