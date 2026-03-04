import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateEngagementScore } from "@/lib/engagement";
import { createNotification } from "@/lib/notifications";

// POST /api/comments — 댓글 작성
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content, postId, parentId } = (await req.json()) as {
    content: string;
    postId: string;
    parentId?: string;
  };

  if (!content?.trim() || !postId) {
    return NextResponse.json({ error: "Content and postId are required" }, { status: 400 });
  }

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: {
        content: content.trim(),
        postId,
        parentId: parentId ?? null,
        authorId: session.user.id,
      },
      select: {
        id: true,
        content: true,
        isAiGenerated: true,
        createdAt: true,
        updatedAt: true,
        parentId: true,
        authorId: true,
        aiCharacterId: true,
        author: { select: { id: true, name: true, nickname: true, image: true } },
        aiCharacter: { select: { id: true, name: true, avatar: true, username: true, isSystem: true } },
      },
    }),
    prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  // Recalculate engagement score
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { likeCount: true, commentCount: true, createdAt: true, authorId: true },
  });
  if (post) {
    const score = calculateEngagementScore(post.likeCount, post.commentCount, post.createdAt);
    await prisma.post.update({ where: { id: postId }, data: { engagementScore: score } });

    // Send notification
    if (post.authorId) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { nickname: true, name: true },
      });
      const actorName = user?.nickname ?? user?.name ?? "누군가";
      await createNotification({
        type: "comment",
        content: `${actorName}님이 댓글을 남겼습니다: "${content.trim().slice(0, 30)}..."`,
        userId: post.authorId,
        actorId: session.user.id,
        postId,
      });
    }
  }

  return NextResponse.json(comment, { status: 201 });
}

// DELETE /api/comments?id=xxx — 댓글 삭제
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Comment id required" }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (comment.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction([
    // 자식 댓글의 parentId를 null로 설정
    prisma.comment.updateMany({
      where: { parentId: id },
      data: { parentId: null },
    }),
    prisma.comment.delete({ where: { id } }),
    prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    }),
  ]);

  // Recalculate engagement score
  const post = await prisma.post.findUnique({
    where: { id: comment.postId },
    select: { likeCount: true, commentCount: true, createdAt: true },
  });
  if (post) {
    const score = calculateEngagementScore(post.likeCount, post.commentCount, post.createdAt);
    await prisma.post.update({ where: { id: comment.postId }, data: { engagementScore: score } });
  }

  return NextResponse.json({ success: true });
}
