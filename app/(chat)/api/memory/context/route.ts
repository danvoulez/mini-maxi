import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { MemoryManager } from "@/lib/memory/manager";
import { contextRequestSchema } from "../schemas";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await request.json().catch(() => ({}));
  const parsed = contextRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request", issues: parsed.error.format() }, { status: 400 });
  }
  const ownerId = session.user.id;
  const requestId = (parsed.data as any).requestId ?? randomUUID();
  const { maxTokens, reserveForModel, layers, includeScopes, tags, now } = parsed.data;

  const conn = process.env.POSTGRES_URL;
  if (!conn) {
    return NextResponse.json({ error: "missing_db" }, { status: 500 });
  }

  try {
    const mgr = new MemoryManager(conn);
    const result = await mgr.getWorkingSet({
      ownerId,
      maxTokens,
      reserveForModel,
      layers,
      includeScopes,
      tags,
      now,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "context_failed", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}