import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { NextResponse } from "next/server";
import postgres from "postgres";
import { auth } from "@/app/(auth)/auth";
import { ledgerObject, ledgerTransaction, objectType } from "@/lib/db/ledger";
import { transactionPostSchema } from "../schemas";
import { randomUUID } from "crypto";

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

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await request.json().catch(() => ({}));
  const parsed = transactionPostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", issues: parsed.error.format() }, { status: 400 });
  }
  const { objectId, operationType, changes } = parsed.data;



  
  const createdBy = session.user.id;
try {
    if (!objectId || !operationType || !changes) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: "objectId, operationType and changes are required",
        },
        { status: 400 }
      );
    }
    const found = await db
      .select()
      .from(ledgerObject)
      .where(eq(ledgerObject.id, objectId));
    if (found.length === 0)
      return NextResponse.json(
        { error: "not_found", message: "object not found" },
        { status: 404 }
      );

    const previousData = found[0].data;
    const newData = { ...(previousData ?? {}), ...(changes ?? {}) };

    await db.insert(ledgerTransaction).values({
      objectId,
      operationType,
      previousData,
      newData,
      createdBy,
    });

    const [updated] = await db
      .update(ledgerObject)
      .set({
        data: newData,
        version: (found[0].version ?? 1) + 1,
        updatedAt: new Date(),
      })
      .where(eq(ledgerObject.id, objectId))
      .returning();

    // POST success log
    const __logTypeId = await ensureLogTypeId(db);
    await db
      .insert(ledgerObject)
      .values({
        typeId: __logTypeId,
        data: {
          level: "info",
          message: "ledger.transactions.post",
          context: { objectId, operationType, version: updated?.version },
        },
      });
    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    const __logTypeId = await ensureLogTypeId(db);
    await db
      .insert(ledgerObject)
      .values({
        typeId: __logTypeId,
        data: {
          level: "error",
          message: "ledger.transactions.post.error",
          context: { objectId, operationType, error: String(e?.message || e) },
        },
      });
    return NextResponse.json(
      { error: "record_failed", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  } finally {
    await client.end({ timeout: 1 });
  }
}