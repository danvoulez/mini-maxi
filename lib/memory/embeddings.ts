export type EmbeddingModel =
  | "text-embedding-3-small"
  | "text-embedding-3-large";

const DEFAULT_MODEL: EmbeddingModel =
  (process.env.OPENAI_EMBEDDING_MODEL as EmbeddingModel) ||
  "text-embedding-3-small";

export async function embedText(
  input: string,
  apiKey?: string,
  model: EmbeddingModel = DEFAULT_MODEL
): Promise<number[]> {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required to run embeddings");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI embeddings failed: ${res.status} ${txt}`);
  }
  const json = await res.json();
  const vec = json?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error("Invalid embedding response");
  return vec;
}
