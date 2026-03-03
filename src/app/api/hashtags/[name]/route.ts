import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/json-fields";

// GET /api/hashtags/[name] — 특정 해시태그의 포스트 목록
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  const hashtag = await prisma.hashtag.findUnique({
    where: { name: name.toLowerCase() },
    include: {
      posts: {
        include: {
          post: {
            select: {
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
                  id: true, content: true, isAiGenerated: true, createdAt: true, updatedAt: true,
                  parentId: true, authorId: true, aiCharacterId: true,
                  author: { select: { id: true, name: true, nickname: true, image: true } },
                  aiCharacter: { select: { id: true, name: true, avatar: true, username: true, isSystem: true } },
                },
                orderBy: { createdAt: "asc" },
                take: 3,
              },
            },
          },
        },
        orderBy: { post: { createdAt: "desc" } },
        take: 50,
      },
    },
  });

  if (!hashtag) {
    return NextResponse.json({ hashtag: name, posts: [] });
  }

  const posts = hashtag.posts.map((ph) => ({
    ...ph.post,
    images: parseJsonArray(ph.post.images),
  }));

  return NextResponse.json({ hashtag: hashtag.name, postCount: hashtag.postCount, posts });
}
