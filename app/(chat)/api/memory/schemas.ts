// Auto-generated schemas for Memory endpoints (by assistant patch)
import { z } from "zod";

export const memoryLayers = z.enum(["context","temporary","permanent"]);
export const memoryScopes = z.enum(["agent_managed","user_owned"]);

export const contextRequestSchema = z.object({
  ownerId: z.string().min(1),
  maxTokens: z.number().int().positive().optional(),
  reserveForModel: z.number().int().nonnegative().optional(),
  layers: z.array(memoryLayers).optional(),
  includeScopes: z.array(memoryScopes).optional(),
  tags: z.array(z.string()).optional(),
  now: z.string().datetime().optional(),
});

export type ContextRequest = z.infer<typeof contextRequestSchema>;

export const promoteRequestSchema = z.object({
  ownerId: z.string().min(1),
  key: z.string().min(1),
  force: z.boolean().optional(),
  merge: z.union([z.boolean(), z.record(z.any())]).optional(),
  reason: z.string().optional(),
  requestId: z.string().optional(),
});

export const deleteRequestSchema = z.object({
  ownerId: z.string().min(1),
  ids: z.array(z.string().uuid()).optional(),
  keys: z.array(z.string().min(1)).optional(),
  requestId: z.string().optional(),
}).refine((v) => !!(v.ids?.length || v.keys?.length), {
  message: "Either ids or keys must be provided",
  path: ["ids"],
});

export const ragRequestSchema = z.object({
  query: z.string().min(1),
  hints: z.record(z.any()).optional(),
});
