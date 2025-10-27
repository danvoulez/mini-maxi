import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { MemoryManager } from "@/lib/memory/manager";
import { promoteRequestSchema } from "../schemas";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await request.json().catch(() => ({}));
  const parsed = promoteRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", issues: parsed.error.format() }
  const ownerId = session.user.id;
  const requestId = (parsed.data as any).requestId ?? randomUUID();
, { status: 400 });
  }
  const { key, force, merge, reason, requestId } = parsed.data;



  , { status: 403 });
  }

  if (!key) {
    return NextResponse.json({ error: "missing_key" }, { status: 400 });
  }

  const conn = process.env.POSTGRES_URL;
  if (!conn) {
    return NextResponse.json({ error: "missing_db" }, { status: 500 });
  }

  try {
    const mgr = new MemoryManager(conn);
    const result = await mgr.promote({
      ownerId,
      key,
      force,
      merge,
      reason,
      requestId,
      actorId: session.user.id,
      actorRole: "user", // Could be determined from session
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "promote_failed", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}