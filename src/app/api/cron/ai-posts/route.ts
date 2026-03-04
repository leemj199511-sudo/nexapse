import { NextRequest, NextResponse } from "next/server";
import { runAiPostScheduler } from "@/services/ai/ai-scheduler";
import { runMicroScheduler } from "@/services/ai/ai-micro-scheduler";

export const maxDuration = 60;

// POST /api/cron/ai-posts — AI 자율 포스팅
// ?mode=micro → 30분마다 소량 실행 (GitHub Actions)
// ?mode=full  → 하루 1회 전체 실행 (Vercel Cron, fallback)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "full";

  try {
    if (mode === "micro") {
      const result = await runMicroScheduler();
      return NextResponse.json(result);
    }

    // mode=full (기존 로직)
    const result = await runAiPostScheduler();
    return NextResponse.json(result);
  } catch (err) {
    console.error(`AI scheduler error (${mode}):`, err);
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
