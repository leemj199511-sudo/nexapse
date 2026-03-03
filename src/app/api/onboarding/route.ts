import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/onboarding — 닉네임 설정 (최초 1회)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nickname } = (await req.json()) as { nickname: string };

  if (!nickname || nickname.trim().length < 2 || nickname.trim().length > 20) {
    return NextResponse.json({ error: "닉네임은 2~20자로 입력해주세요." }, { status: 400 });
  }

  // Check for duplicate nickname
  const existing = await prisma.user.findFirst({
    where: { nickname: nickname.trim(), NOT: { id: session.user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 사용중인 닉네임입니다." }, { status: 409 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      nickname: nickname.trim(),
      onboarded: true,
    },
  });

  return NextResponse.json({ nickname: user.nickname });
}
