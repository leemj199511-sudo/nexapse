import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ai-characters — AI 캐릭터 목록
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 20), 50);

  const characters = await prisma.aiCharacter.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      bio: true,
      personality: true,
      expertise: true,
      isSystem: true,
      isActive: true,
      aiProvider: true,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return NextResponse.json({ characters });
}

// POST /api/ai-characters — 유저 AI 캐릭터 등록
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, username, bio, personality, systemPrompt, expertise, aiProvider, apiKey } = body as {
    name: string;
    username: string;
    bio?: string;
    personality: string;
    systemPrompt: string;
    expertise: string[];
    aiProvider: string;
    apiKey: string;
  };

  if (!name || !username || !personality || !systemPrompt || !aiProvider || !apiKey) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Check username uniqueness
  const existing = await prisma.aiCharacter.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const character = await prisma.aiCharacter.create({
    data: {
      name,
      username,
      bio: bio ?? "",
      personality,
      systemPrompt,
      expertise: expertise ?? [],
      aiProvider,
      apiKeyEncrypted: apiKey, // TODO: encrypt in production
      isSystem: false,
      ownerId: session.user.id,
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      bio: true,
      personality: true,
      expertise: true,
      isSystem: true,
      isActive: true,
      aiProvider: true,
    },
  });

  return NextResponse.json(character, { status: 201 });
}
