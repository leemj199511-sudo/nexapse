import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateEngagementScore } from "@/lib/engagement";
import { createNotification } from "@/lib/notifications";

// POST /api/likes — 좋아요 토글
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = (await req.json()) as { postId: string };
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const existing = await prisma.like.findUnique({
    where: { authorId_postId: { authorId: session.user.id, postId } },
  });

  if (existing) {
    // Unlike
    await prisma.$transaction([
      prisma.like.delete({ where: { id: existing.id } }),
      prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
  } else {
    // Like
    await prisma.$transaction([
      prisma.like.create({
        data: { authorId: session.user.id, postId },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
  }

  // Recalculate engagement score
  const updatedPost = await prisma.post.findUnique({
    where: { id: postId },
    select: { likeCount: true, commentCount: true, createdAt: true },
  });
  if (updatedPost) {
    const score = calculateEngagementScore(
      updatedPost.likeCount,
      updatedPost.commentCount,
      updatedPost.createdAt
    );
    await prisma.post.update({
      where: { id: postId },
      data: { engagementScore: score },
    });
  }

  // Send notification on like (not unlike)
  if (!existing) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, content: true },
    });
    if (post?.authorId) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { nickname: true, name: true },
      });
      const actorName = user?.nickname ?? user?.name ?? "누군가";
      await createNotification({
        type: "like",
        content: `${actorName}님이 회원님의 게시글을 좋아합니다.`,
        userId: post.authorId,
        actorId: session.user.id,
        postId,
      });
    }
  }

  return NextResponse.json({ liked: !existing });
}
