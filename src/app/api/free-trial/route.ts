import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRemainingFreeMessages } from "@/lib/free-trial";

// GET /api/free-trial — 무료 체험 잔여 횟수 확인
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await getRemainingFreeMessages(session.user.id);
  return NextResponse.json(usage);
}
