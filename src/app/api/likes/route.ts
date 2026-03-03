import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    return NextResponse.json({ liked: false });
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
    return NextResponse.json({ liked: true });
  }
}
