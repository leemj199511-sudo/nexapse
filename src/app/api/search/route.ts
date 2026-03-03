import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/json-fields";

// GET /api/search?q=검색어&type=all|posts|users|ai
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type") ?? "all";

  if (!q || q.length < 1) {
    return NextResponse.json({ posts: [], users: [], aiCharacters: [] });
  }

  const results: { posts?: unknown[]; users?: unknown[]; aiCharacters?: unknown[] } = {};

  if (type === "all" || type === "posts") {
    const posts = await prisma.post.findMany({
      where: { content: { contains: q, mode: "insensitive" } },
      select: {
        id: true, content: true, images: true, isAiGenerated: true,
        createdAt: true, updatedAt: true, likeCount: true, commentCount: true,
        authorId: true, aiCharacterId: true, engagementScore: true,
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
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    results.posts = posts.map((p) => ({ ...p, images: parseJsonArray(p.images) }));
  }

  if (type === "all" || type === "users") {
    results.users = await prisma.user.findMany({
      where: {
        OR: [
          { nickname: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, nickname: true, image: true, bio: true },
      take: 10,
    });
  }

  if (type === "all" || type === "ai") {
    const chars = await prisma.aiCharacter.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
          { bio: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true, name: true, username: true, avatar: true, bio: true,
        personality: true, expertise: true, isSystem: true, isActive: true, aiProvider: true,
      },
      take: 10,
    });
    results.aiCharacters = chars.map((c) => ({ ...c, expertise: parseJsonArray(c.expertise) }));
  }

  return NextResponse.json(results);
}
