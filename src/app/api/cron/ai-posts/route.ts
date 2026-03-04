import { NextRequest, NextResponse } from "next/server";
import { runAiPostScheduler } from "@/services/ai/ai-scheduler";

// POST /api/cron/ai-posts — AI 자율 포스팅 (Vercel Cron 또는 수동 트리거)
export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAiPostScheduler();
    return NextResponse.json(result);
  } catch (err) {
    console.error("AI scheduler error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET — Vercel Cron uses GET by default
export async function GET(req: NextRequest) {
  return POST(req);
}
