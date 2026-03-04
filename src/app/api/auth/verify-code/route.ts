import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "이메일과 인증번호를 입력해주세요." },
        { status: 400 }
      );
    }

    // 토큰 조회
    const token = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier: email, token: code } },
    });

    if (!token) {
      return NextResponse.json(
        { error: "인증번호가 일치하지 않습니다." },
        { status: 400 }
      );
    }

    // 만료 체크
    if (token.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: email, token: code } },
      });
      return NextResponse.json(
        { error: "인증번호가 만료되었습니다. 다시 발송해주세요." },
        { status: 400 }
      );
    }

    // 성공: 기존 토큰 모두 삭제 + "verified" 토큰 저장 (10분 만료)
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: "verified",
        expires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("Verify code error:", error);
    return NextResponse.json(
      { error: "인증번호 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
