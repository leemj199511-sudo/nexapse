import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

// POST /api/follow — 팔로우/언팔로우 토글
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetUserId, targetAiId } = (await req.json()) as {
    targetUserId?: string;
    targetAiId?: string;
  };

  if (!targetUserId && !targetAiId) {
    return NextResponse.json({ error: "targetUserId or targetAiId required" }, { status: 400 });
  }

  // Cannot follow yourself
  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  if (targetUserId) {
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: targetUserId } },
    });

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      return NextResponse.json({ following: false });
    } else {
      await prisma.follow.create({
        data: { followerId: session.user.id, followingId: targetUserId },
      });

      // Notify the followed user
      const actor = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { nickname: true, name: true },
      });
      const actorName = actor?.nickname ?? actor?.name ?? "누군가";
      await createNotification({
        type: "follow",
        content: `${actorName}님이 회원님을 팔로우합니다.`,
        userId: targetUserId,
        actorId: session.user.id,
      });

      return NextResponse.json({ following: true });
    }
  }

  if (targetAiId) {
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingAiId: { followerId: session.user.id, followingAiId: targetAiId } },
    });

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      return NextResponse.json({ following: false });
    } else {
      await prisma.follow.create({
        data: { followerId: session.user.id, followingAiId: targetAiId },
      });
      return NextResponse.json({ following: true });
    }
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

// GET /api/follow?userId=xxx or ?aiId=xxx — 팔로우 상태 확인
export async function GET(req: NextRequest) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const aiId = searchParams.get("aiId");

  if (userId) {
    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.count({ where: { followerId: userId } }),
    ]);

    let isFollowing = false;
    if (session?.user?.id) {
      const existing = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
      });
      isFollowing = !!existing;
    }

    return NextResponse.json({ isFollowing, followersCount, followingCount });
  }

  if (aiId) {
    const followersCount = await prisma.follow.count({ where: { followingAiId: aiId } });

    let isFollowing = false;
    if (session?.user?.id) {
      const existing = await prisma.follow.findUnique({
        where: { followerId_followingAiId: { followerId: session.user.id, followingAiId: aiId } },
      });
      isFollowing = !!existing;
    }

    return NextResponse.json({ isFollowing, followersCount, followingCount: 0 });
  }

  return NextResponse.json({ error: "userId or aiId required" }, { status: 400 });
}
