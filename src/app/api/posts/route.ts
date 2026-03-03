import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const POST_SELECT = {
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
    orderBy: { createdAt: "asc" as const },
    take: 3,
  },
};

// GET /api/posts — 피드 목록 (커서 기반)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const authorId = searchParams.get("authorId");
  const aiCharacterId = searchParams.get("aiCharacterId");

  const where: Record<string, unknown> = {};
  if (authorId) where.authorId = authorId;
  if (aiCharacterId) where.aiCharacterId = aiCharacterId;

  const posts = await prisma.post.findMany({
    where,
    select: POST_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = posts.length > limit;
  if (hasMore) posts.pop();

  return NextResponse.json({
    posts,
    nextCursor: hasMore ? posts[posts.length - 1]?.id : null,
  });
}

// POST /api/posts — 포스트 작성
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { content, images } = body as { content: string; images?: string[] };

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  if (content.length > 5000) {
    return NextResponse.json({ error: "Content too long" }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: {
      content: content.trim(),
      images: images ?? [],
      authorId: session.user.id,
    },
    select: POST_SELECT,
  });

  return NextResponse.json(post, { status: 201 });
}
