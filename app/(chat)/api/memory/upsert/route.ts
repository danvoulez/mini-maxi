import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { MemoryManager } from "@/lib/memory/manager";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}) as any);
  const {
    ownerId,
    scope,
    layer,
    key,
    attribute,
    detail,
    content,
    confidence,
    tags,
    ttlSeconds,
    needsReview,
    requestId,
  } = body ?? {};

  if (!ownerId || ownerId !== session.user.id) {
    return NextResponse.json({ error: "forbidden_owner" }, { status: 403 });
  }
  if (!scope || !layer || !key || typeof content === "undefined") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const conn = process.env.POSTGRES_URL;
  if (!conn) {
    return NextResponse.json({ error: "missing_db" }, { status: 500 });
  }

  try {
    const mgr = new MemoryManager(conn);
    const result = await mgr.upsertMemory({
      ownerId,
      scope,
      layer,
      key,
      attribute,
      detail,
      content,
      confidence,
      tags,
      ttlSeconds,
      needsReview,
      requestId,
      actorId: session.user.id,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "upsert_failed", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
