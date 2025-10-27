import { tool } from "ai";
import { z } from "zod";

export const ledgerAggregates = ({ origin }: { origin: string }) =>
  tool({
    description:
      "Obter estatísticas e contadores dos registros salvos (quantos clientes, projetos, etc.). Use para mostrar um resumo ao usuário.",
    inputSchema: z.object({}),
    execute: async () => {
      const r = await fetch(`${origin}/api/ledger/aggregates`);
      if (!r.ok) throw new Error(`ledgerAggregates:get failed: ${r.status}`);
      return await r.json();
    },
  });
