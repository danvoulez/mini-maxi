// AI Tools for Memory System Integration (LLM Tool Contracts) - Fixed TypeScript
import { tool } from "ai";
import { z } from "zod";
import { MemoryManager } from "@/lib/memory/manager";
import { getMetricsCollector } from "@/lib/memory/metrics";
import { RAGManager } from "@/lib/memory/rag-manager";

const connStr = process.env.POSTGRES_URL!;

export const memoryGetWorkingSetTool = tool({
  description:
    "Obtém contexto combinado de camadas dentro do orçamento de tokens. Use no início de cada conversa para recuperar memória relevante.",
  inputSchema: z.object({
    sessionId: z.string().describe("ID da sessão atual"),
    keys: z
      .array(z.string())
      .optional()
      .describe("Chaves específicas para recuperar"),
    tags: z.array(z.string()).optional().describe("Tags para filtrar memórias"),
    tokenBudget: z
      .number()
      .optional()
      .describe("Orçamento de tokens disponível"),
  }),
  execute: async (input) => {
    const { sessionId, keys, tags, tokenBudget } = input;
    const mgr = new MemoryManager(connStr);
    const metrics = getMetricsCollector();

    const startTime = Date.now();

    try {
      const result = await mgr.getWorkingSet({
        ownerId: sessionId,
        maxTokens: tokenBudget,
        tags,
      });

      metrics.recordLatency("memory_get_workingset_latency_ms", startTime);
      metrics.increment("memory_used_context_count");

      return {
        context: result.items.filter((i: any) => i.layer === "context"),
        temporary: result.items.filter((i: any) => i.layer === "temporary"),
        permanent: result.items.filter((i: any) => i.layer === "permanent"),
        ragSnippets: [],
        tokenBudget: result.budget,
      };
    } catch (error) {
      metrics.recordLatency("memory_get_workingset_latency_ms", startTime, {
        error: "true",
      });
      throw error;
    }
  },
});

export const memoryUpsertTool = tool({
  description:
    "Cria/atualiza memória com validação de schema e criptografia seletiva. Use para salvar informações importantes da conversa.",
  inputSchema: z.object({
    layer: z
      .enum(["context", "temporary", "permanent"])
      .describe(
        "Camada de memória: context (efêmero), temporary (7 dias), permanent (permanente)"
      ),
    key: z
      .string()
      .describe("Chave única no formato scope:entity:id:attribute:detail"),
    value: z.any().describe("Valor a ser armazenado"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Nível de confiança (0-1)"),
    tags: z.array(z.string()).optional().describe("Tags para categorização"),
    sensitivity: z
      .enum(["pii", "secret", "confidential", "public"])
      .optional()
      .describe("Nível de sensibilidade para criptografia"),
    source: z.string().optional().describe("Fonte da informação"),
  }),
  execute: async (input) => {
    const { layer, key, value, confidence, tags, sensitivity, source } = input;
    const mgr = new MemoryManager(connStr);
    const metrics = getMetricsCollector();

    const startTime = Date.now();

    try {
      const result = await mgr.upsertMemory({
        ownerId: "system", // In production, use actual user ID
        scope: "agent_managed",
        layer,
        key,
        content: value,
        confidence,
        tags,
        sensitivity: sensitivity as any,
        actorId: "ai-agent",
      });

      metrics.recordLatency("memory_upsert_latency_ms", startTime);
      metrics.increment("memory_upsert_count");

      if (result.error) {
        metrics.increment("memory_validation_error_count");
      }

      return {
        ok: !result.error,
        id: result.id,
        needsReview: result.needsReview || false,
        error: result.error,
      };
    } catch (error) {
      metrics.recordLatency("memory_upsert_latency_ms", startTime, {
        error: "true",
      });
      throw error;
    }
  },
});

export const memoryPromoteTool = tool({
  description:
    "Promove memória temporary para permanent (com regras). Use quando uma informação temporária se mostrar importante e persistente.",
  inputSchema: z.object({
    key: z.string().describe("Chave da memória a promover"),
    force: z
      .boolean()
      .optional()
      .describe("Forçar promoção mesmo se needsReview=true"),
    merge: z
      .boolean()
      .optional()
      .describe("Merge com memória permanent existente"),
    reason: z.string().optional().describe("Razão para a promoção"),
  }),
  execute: async (input) => {
    const { key, force, merge, reason } = input;
    const mgr = new MemoryManager(connStr);
    const metrics = getMetricsCollector();

    const startTime = Date.now();

    try {
      const result = await mgr.promote({
        ownerId: "system",
        key,
        force,
        merge,
        reason,
        actorId: "ai-agent",
        actorRole: "agent",
      });

      metrics.recordLatency("memory_promote_latency_ms", startTime);

      if (result.ok) {
        metrics.increment("memory_promote_count");
      }

      return { ok: result.ok, error: result.error };
    } catch (error) {
      metrics.recordLatency("memory_promote_latency_ms", startTime, {
        error: "true",
      });
      throw error;
    }
  },
});

export const memorySearchTool = tool({
  description:
    "Busca semântica/por chaves em memórias. Use para encontrar informações específicas no histórico.",
  inputSchema: z.object({
    query: z.string().describe("Texto de busca"),
    layer: z
      .enum(["context", "temporary", "permanent"])
      .optional()
      .describe("Filtrar por camada"),
    keys: z
      .array(z.string())
      .optional()
      .describe("Filtrar por chaves específicas"),
    tags: z.array(z.string()).optional().describe("Filtrar por tags"),
    minConfidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Confiança mínima"),
  }),
  execute: async (input) => {
    const { query, layer, keys, tags, minConfidence } = input;
    const mgr = new MemoryManager(connStr);

    const result = await mgr.search({
      ownerId: "system",
      query,
      layer,
      keys,
      tags,
      minConfidence,
      limit: 50,
    });

    return { items: result.items };
  },
});

export const ragRetrieveTool = tool({
  description:
    "Recuperação de conhecimento externo com resiliência. Use quando precisar de informações além da memória interna.",
  inputSchema: z.object({
    query: z.string().describe("Consulta para buscar conhecimento externo"),
    hints: z
      .record(z.any())
      .optional()
      .describe("Dicas contextuais para melhorar a busca"),
  }),
  execute: async (input) => {
    const { query, hints } = input;
    const ragManager = new RAGManager();
    const metrics = getMetricsCollector();

    metrics.increment("rag_trigger_count");
    const startTime = Date.now();

    try {
      const result = await ragManager.retrieve(query, hints);

      metrics.recordLatency("rag_latency_ms", startTime);

      if (result.degraded) {
        metrics.increment("rag_fallback_count");
      }

      return result;
    } catch (error) {
      metrics.increment("rag_error_count");
      metrics.recordLatency("rag_latency_ms", startTime, { error: "true" });
      throw error;
    }
  },
});

// Export all tools as a group
export const cerebroTools = {
  memory_get_workingset: memoryGetWorkingSetTool,
  memory_upsert: memoryUpsertTool,
  memory_promote: memoryPromoteTool,
  memory_search: memorySearchTool,
  rag_retrieve: ragRetrieveTool,
};
