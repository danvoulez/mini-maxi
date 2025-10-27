import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "edge";
export async function GET() {
  return NextResponse.json({ ok: true, time: new Date().toISOString() });
}
