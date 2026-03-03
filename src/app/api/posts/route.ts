import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray, toJsonString } from "@/lib/json-fields";
import { calculateEngagementScore } from "@/lib/engagement";
import { extractHashtags } from "@/lib/hashtag";

const POST_SELECT = {
  id: true,
  content: true,
  images: true,
  isAiGenerated: true,
  createdAt: true,
  updatedAt: true,
  likeCount: true,
  commentCount: true,
  engagementScore: true,
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
  const following = searchParams.get("following");
  const hashtag = searchParams.get("hashtag");
  const sort = searchParams.get("sort") ?? "recommended";

  const where: Record<string, unknown> = {};
  if (authorId) where.authorId = authorId;
  if (aiCharacterId) where.aiCharacterId = aiCharacterId;

  // Following feed filter
  if (following === "true") {
    const session = await auth();
    if (session?.user?.id) {
      const follows = await prisma.follow.findMany({
        where: { followerId: session.user.id },
        select: { followingId: true, followingAiId: true },
      });
      const userIds = follows.map((f) => f.followingId).filter(Boolean) as string[];
      const aiIds = follows.map((f) => f.followingAiId).filter(Boolean) as string[];
      where.OR = [
        ...(userIds.length > 0 ? [{ authorId: { in: userIds } }] : []),
        ...(aiIds.length > 0 ? [{ aiCharacterId: { in: aiIds } }] : []),
      ];
      // If not following anyone, return empty
      if (userIds.length === 0 && aiIds.length === 0) {
        return NextResponse.json({ posts: [], nextCursor: null });
      }
    }
  }

  // Hashtag filter
  if (hashtag) {
    where.hashtags = { some: { hashtag: { name: hashtag } } };
  }

  const orderBy =
    sort === "latest"
      ? { createdAt: "desc" as const }
      : { engagementScore: "desc" as const };

  const posts = await prisma.post.findMany({
    where,
    select: POST_SELECT,
    orderBy,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = posts.length > limit;
  if (hasMore) posts.pop();

  const parsed = posts.map((p) => ({ ...p, images: parseJsonArray(p.images) }));
  const nextCursor = hasMore && parsed.length > 0 ? parsed[parsed.length - 1].id : null;
  return NextResponse.json({ posts: parsed, nextCursor });
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

  const initialScore = calculateEngagementScore(0, 0, new Date());

  const post = await prisma.post.create({
    data: {
      content: content.trim(),
      images: toJsonString(images),
      authorId: session.user.id,
      engagementScore: initialScore,
    },
    select: POST_SELECT,
  });

  // Extract and save hashtags
  const tags = extractHashtags(content);
  if (tags.length > 0) {
    for (const tagName of tags) {
      const hashtag = await prisma.hashtag.upsert({
        where: { name: tagName },
        create: { name: tagName, postCount: 1 },
        update: { postCount: { increment: 1 } },
      });
      await prisma.postHashtag.create({
        data: { postId: post.id, hashtagId: hashtag.id },
      }).catch(() => {}); // ignore duplicate
    }
  }

  return NextResponse.json(post, { status: 201 });
}
