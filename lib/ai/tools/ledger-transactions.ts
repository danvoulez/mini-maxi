import { tool } from "ai";
import { z } from "zod";

export const ledgerTransactions = ({ origin }: { origin: string }) =>
  tool({
    description:
      "Registrar alteração em um registro existente (atualizar, criar histórico de mudanças). Use quando um registro precisa ser modificado ou você quer manter histórico das alterações.",
    inputSchema: z.object({
      objectId: z.string().uuid().describe("ID do registro que foi alterado"),
      operationType: z
        .enum(["CREATE", "UPDATE", "DELETE"])
        .describe(
          "Tipo de operação: CREATE (criação), UPDATE (atualização), DELETE (exclusão)"
        ),
      changes: z.record(z.any()).describe("Alterações realizadas no registro"),
      createdBy: z
        .string()
        .uuid()
        .optional()
        .describe("ID do usuário que fez a alteração (opcional)"),
    }),
    execute: async (input) => {
      const r = await fetch(`${origin}/api/ledger/transactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objectId: input.objectId,
          operationType: input.operationType,
          changes: input.changes,
          createdBy: input.createdBy,
        }),
      });
      if (!r.ok) throw new Error(`ledgerTransactions:post failed: ${r.status}`);
      return await r.json();
    },
  });
