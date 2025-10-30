import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { NextResponse } from "next/server";
import postgres from "postgres";
import { auth } from "@/app/(auth)/auth";
import { ledgerObject, objectType } from "@/lib/db/ledger";
import { objectPostSchema } from "../schemas";

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

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const typeName = url.searchParams.get("type");

  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  try {
    if (typeName) {
      // GET success log
      const types = await db
        .select()
        .from(objectType)
        .where(eq(objectType.name, typeName));
      if (types.length === 0) return NextResponse.json([], { status: 200 });
      const rows = await db
        .select()
        .from(ledgerObject)
        .where(eq(ledgerObject.typeId, types[0].id));
      const __logTypeId = await ensureLogTypeId(db);
      await db
        .insert(ledgerObject)
        .values({
          typeId: __logTypeId,
          data: {
            level: "info",
            message: "ledger.objects.get",
            context: { typeName, count: rows.length },
          },
        });
      return NextResponse.json(rows, { status: 200 });
    }
    const rows = await db.select().from(ledgerObject);
    // GET success log (no filter)
    const __logTypeId = await ensureLogTypeId(db);
    await db
      .insert(ledgerObject)
      .values({
        typeId: __logTypeId,
        data: {
          level: "info",
          message: "ledger.objects.get",
          context: { count: rows.length },
        },
      });
    return NextResponse.json(rows, { status: 200 });
  } catch (e: any) {
    const __logTypeId = await ensureLogTypeId(db);
    await db
      .insert(ledgerObject)
      .values({
        typeId: __logTypeId,
        data: {
          level: "error",
          message: "ledger.objects.get.error",
          context: { typeName, error: String(e?.message || e) },
        },
      });
    return NextResponse.json(
      { error: "query_failed", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  } finally {
    await client.end({ timeout: 1 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = objectPostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", issues: parsed.error.format() }, { status: 400 });
  }
  const { typeName, data, metadata } = parsed.data;

  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  try {
    if (!typeName || !data) {
      return NextResponse.json(
        { error: "bad_request", message: "typeName and data are required" },
        { status: 400 }
      );
    }
    // upsert type
    const types = await db
      .select()
      .from(objectType)
      .where(eq(objectType.name, typeName));
    let typeId = types[0]?.id as string | undefined;
    if (!typeId) {
      const ins = await db
        .insert(objectType)
        .values({ name: typeName })
        .returning({ id: objectType.id });
      typeId = ins[0].id;
    }
    const [created] = await db
      .insert(ledgerObject)
      .values({ typeId, data, metadata })
      .returning();
    // POST success log
    const __logTypeId = await ensureLogTypeId(db);
    await db
      .insert(ledgerObject)
      .values({
        typeId: __logTypeId,
        data: {
          level: "info",
          message: "ledger.objects.post",
          context: { typeName, objectId: created.id },
        },
      });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const __logTypeId = await ensureLogTypeId(db);
    await db
      .insert(ledgerObject)
      .values({
        typeId: __logTypeId,
        data: {
          level: "error",
          message: "ledger.objects.post.error",
          context: { error: String(e?.message || e) },
        },
      });
    return NextResponse.json(
      { error: "create_failed", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  } finally {
    await client.end({ timeout: 1 });
  }
}