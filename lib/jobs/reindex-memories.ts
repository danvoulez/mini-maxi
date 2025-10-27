import postgres from "postgres";
import { embedText } from "../memory/embeddings";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL is not set");
  const sql = postgres(url, { max: 1 });
  try {
    // fetch memories lacking embeddings (or recently updated)
    const rows: any[] = await sql`
      SELECT id, content
      FROM memories
      WHERE embedding IS NULL
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 200
    `;
    let ok = 0, fail = 0;
    for (const r of rows) {
      const text = typeof r.content === "string" ? r.content : JSON.stringify(r.content);
      try {
        const emb = await embedText(text);
        // pgvector: array to vector
        await sql`
          UPDATE memories
          SET embedding = ${sql.unsafe("ARRAY[" + emb.join(",") + "]")}
          WHERE id = ${r.id}
        `;
        ok++;
      } catch (e) {
        console.error("Embed fail for", r.id, e);
        fail++;
      }
    }
    console.log(JSON.stringify({ updated: ok, failed: fail }));
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
