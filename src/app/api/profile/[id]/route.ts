import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/profile/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      nickname: true,
      image: true,
      bio: true,
      createdAt: true,
      _count: { select: { posts: true, comments: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PATCH /api/profile/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.id || session.user.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { nickname, bio } = (await req.json()) as { nickname?: string; bio?: string };

  // Validate nickname
  if (nickname !== undefined) {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      return NextResponse.json({ error: "닉네임은 2~20자로 입력해주세요." }, { status: 400 });
    }
    const existing = await prisma.user.findFirst({
      where: { nickname: trimmed, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: "이미 사용중인 닉네임입니다." }, { status: 409 });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(nickname !== undefined && { nickname: nickname.trim() }),
      ...(bio !== undefined && { bio }),
    },
    select: {
      id: true,
      name: true,
      nickname: true,
      image: true,
      bio: true,
    },
  });

  return NextResponse.json(user);
}
