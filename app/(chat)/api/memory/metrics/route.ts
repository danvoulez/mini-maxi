import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getAutoTuner } from "@/lib/memory/autotuner";
import { getMetricsCollector } from "@/lib/memory/metrics";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const metrics = getMetricsCollector();
    const autoTuner = getAutoTuner();

    const report = {
      metrics: metrics.getReport(),
      alerts: metrics.checkAlerts(),
      config: {
        cache: autoTuner.getCacheConfig(),
        promotion: autoTuner.getPromotionConfig(),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(report, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "metrics_failed", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
