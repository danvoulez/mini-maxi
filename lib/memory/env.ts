export const CEREBRO_V1 = process.env.CEREBRO_V1 === "1";

export const CEREBRO_TOKEN_BUDGET_TOTAL = Number(
  process.env.CEREBRO_TOKEN_BUDGET_TOTAL ?? 2000
);
export const CEREBRO_TOKEN_BUDGET_MODEL_RESERVE = Number(
  process.env.CEREBRO_TOKEN_BUDGET_MODEL_RESERVE ?? 512
);

export const CEREBRO_TTL_CONTEXT_MINUTES = Number(
  process.env.CEREBRO_TTL_CONTEXT_MINUTES ?? 15
);
export const CEREBRO_TTL_TEMPORARY_DAYS = Number(
  process.env.CEREBRO_TTL_TEMPORARY_DAYS ?? 7
);

export const CEREBRO_SWEEP_BATCH = Number(
  process.env.CEREBRO_SWEEP_BATCH ?? 2000
);

export const nowIso = () => new Date().toISOString();
