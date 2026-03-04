import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomInt } from "crypto";
import { sendVerificationCode } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "이메일을 입력해주세요." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "올바른 이메일 형식이 아닙니다." },
        { status: 400 }
      );
    }

    // 중복 체크
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 409 }
      );
    }

    // 6자리 코드 생성
    const code = String(randomInt(100000, 999999));

    // 기존 토큰 삭제 후 새로 저장 (5분 만료)
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: code,
        expires: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // 이메일 발송
    await sendVerificationCode(email, code);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send code error:", error);
    return NextResponse.json(
      { error: "인증번호 발송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
