import { tool } from "ai";
import { z } from "zod";

export const ledgerObjects = ({ origin }: { origin: string }) =>
  tool({
    description:
      "Consultar ou criar registros de informações. Use 'get' para buscar registros existentes ou 'post' para salvar novas informações. Exemplos: Cliente, Projeto, Contrato, Tarefa, Reuniao, etc.",
    inputSchema: z.object({
      op: z
        .enum(["get", "post"])
        .describe("Operação: 'get' para consultar, 'post' para criar"),
      typeName: z
        .string()
        .optional()
        .describe("Nome do tipo de registro (ex: Cliente, Projeto, Contrato)"),
      data: z
        .record(z.any())
        .optional()
        .describe(
          "Dados a serem salvos (apenas para 'post'). Ex: { nome: 'João Silva', email: 'joao@email.com' }"
        ),
      metadata: z
        .record(z.any())
        .optional()
        .describe("Metadados opcionais sobre o registro"),
    }),
    execute: async (input) => {
      const base = origin;
      if (input.op === "get") {
        const qs = input.typeName ? `?type=${encodeURIComponent(input.typeName)}` : "";
        const r = await fetch(`${base}/api/ledger/objects${qs}`);
        if (!r.ok) throw new Error(`ledgerObjects:get failed: ${r.status}`);
        return await r.json();
      }
      if (input.op === "post") {
        const r = await fetch(`${base}/api/ledger/objects`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            typeName: input.typeName,
            data: input.data,
            metadata: input.metadata,
          }),
        });
        if (!r.ok) throw new Error(`ledgerObjects:post failed: ${r.status}`);
        return await r.json();
      }
      throw new Error("Unsupported op for ledgerObjects");
    },
  });
