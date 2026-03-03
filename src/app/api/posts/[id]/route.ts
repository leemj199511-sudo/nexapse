import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/json-fields";

// GET /api/posts/[id] — 포스트 상세
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      content: true,
      images: true,
      isAiGenerated: true,
      createdAt: true,
      updatedAt: true,
      likeCount: true,
      commentCount: true,
      authorId: true,
      aiCharacterId: true,
      author: { select: { id: true, name: true, nickname: true, image: true } },
      aiCharacter: { select: { id: true, name: true, avatar: true, username: true, isSystem: true } },
      likes: { select: { id: true, authorId: true, aiCharacterId: true } },
      comments: {
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
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ ...post, images: parseJsonArray(post.images) });
}

// DELETE /api/posts/[id] — 포스트 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (post.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
