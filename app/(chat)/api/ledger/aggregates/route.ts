import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { NextResponse } from "next/server";
import postgres from "postgres";
import { auth } from "@/app/(auth)/auth";
import { ledgerObject, objectType } from "@/lib/db/ledger";

async function ensureLogTypeId(db: any) {
  // Get or create the 'Log' object type
  const existing = await db
    .select()
    .from(objectType)
    .where(eq(objectType.name, "Log"));
  if (existing && existing.length > 0) return existing[0].id;
  const ins = await db
    .insert(objectType)
    .values({ name: "Log" })
    .returning({ id: objectType.id });
  return ins[0].id;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  try {
    // Naive counts — replace with richer metrics later
    const [{ count: objects }] = await db.execute<{ count: number }>(
      sql`SELECT COUNT(*)::int as count FROM "Ledger_Object"`
    );
    const [{ count: txs }] = await db.execute<{ count: number }>(
      sql`SELECT COUNT(*)::int as count FROM "Ledger_Transaction"`
    );
    // GET success log
    const __logTypeId = await ensureLogTypeId(db);
    await db.insert(ledgerObject).values({
      typeId: __logTypeId,
      data: {
        level: "info",
        message: "ledger.aggregates.get",
        context: { objects, transactions: txs },
      },
    });
    return NextResponse.json({ objects, transactions: txs }, { status: 200 });
  } catch (e: any) {
    const __logTypeId = await ensureLogTypeId(db);
    await db.insert(ledgerObject).values({
      typeId: __logTypeId,
      data: {
        level: "error",
        message: "ledger.aggregates.get.error",
        context: { error: String(e?.message || e) },
      },
    });
    return NextResponse.json(
      { error: "aggregate_failed", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  } finally {
    await client.end({ timeout: 1 });
  }
}
