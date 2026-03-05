import { NextRequest, NextResponse } from "next/server";
import { runAiPostScheduler } from "@/services/ai/ai-scheduler";
import { runMicroScheduler } from "@/services/ai/ai-micro-scheduler";

export const maxDuration = 10;

function isAuthorized(req: NextRequest): boolean {
  // 1. Bearer token 인증 (GitHub Actions)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // 2. Vercel Cron 자동 인증 (CRON_SECRET 환경변수 매칭)
  const vercelCronAuth = req.headers.get("x-vercel-cron");
  if (vercelCronAuth) return true;

  return false;
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "full";

  try {
    if (mode === "micro") {
      const result = await runMicroScheduler();
      return NextResponse.json(result);
    }

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

// POST — GitHub Actions
export async function POST(req: NextRequest) {
  return handleCron(req);
}

// GET — Vercel Cron
export async function GET(req: NextRequest) {
  return handleCron(req);
}
