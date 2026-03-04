import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password, passwordConfirm } = await req.json();

    // Validation
    if (!email || !password || !passwordConfirm) {
      return NextResponse.json(
        { error: "모든 필드를 입력해주세요." },
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

    if (password.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    if (password !== passwordConfirm) {
      return NextResponse.json(
        { error: "비밀번호가 일치하지 않습니다." },
        { status: 400 }
      );
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 409 }
      );
    }

    // 이메일 인증 확인
    const verified = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier: email, token: "verified" } },
    });
    if (!verified || verified.expires < new Date()) {
      return NextResponse.json(
        { error: "이메일 인증을 먼저 완료해주세요." },
        { status: 403 }
      );
    }

    // Create user
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        name: email.split("@")[0],
        password: hashed,
        emailVerified: new Date(),
      },
    });

    // verified 토큰 삭제
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "회원가입 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
