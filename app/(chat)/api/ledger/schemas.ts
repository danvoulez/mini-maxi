// Auto-generated schemas for Ledger endpoints (by assistant patch)
import { z } from "zod";

export const objectPostSchema = z.object({
  typeName: z.string().min(1),
  data: z.record(z.any()),
  metadata: z.record(z.any()).optional(),
});

export const transactionPostSchema = z.object({
  objectId: z.string().uuid(),
  operationType: z.enum(["CREATE","UPDATE","DELETE","UPSERT","PATCH","SET","MERGE","REPLACE"]).default("UPDATE"),
  changes: z.record(z.any()).optional(),
  createdBy: z.string().optional(),
});
