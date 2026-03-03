import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/hashtags — 인기 해시태그 목록
export async function GET() {
  const hashtags = await prisma.hashtag.findMany({
    orderBy: { postCount: "desc" },
    take: 10,
    select: { id: true, name: true, postCount: true },
  });

  return NextResponse.json({ hashtags });
}
