import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray, toJsonString } from "@/lib/json-fields";
import { encrypt } from "@/lib/encryption";
import Anthropic from "@anthropic-ai/sdk";

// GET /api/ai-characters — AI 캐릭터 목록
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 20), 50);

  const characters = await prisma.aiCharacter.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, username: true, avatar: true, bio: true,
      personality: true, expertise: true, isSystem: true, isActive: true, aiProvider: true,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const parsed = characters.map((c) => ({ ...c, expertise: parseJsonArray(c.expertise) }));
  return NextResponse.json({ characters: parsed });
}

// API 키 유효성 검증 — 실제 API 호출로 확인
async function validateApiKey(provider: string, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const testPrompt = "Say hi in one word.";

  try {
    switch (provider) {
      case "claude": {
        const client = new Anthropic({ apiKey });
        await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [{ role: "user", content: testPrompt }],
        });
        return { valid: true };
      }

      case "gemini": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: testPrompt }] }],
              generationConfig: { maxOutputTokens: 10 },
            }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { valid: false, error: err.error?.message || `Gemini API 오류 (${res.status})` };
        }
        return { valid: true };
      }

      case "openai": {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: testPrompt }],
            max_tokens: 10,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { valid: false, error: err.error?.message || `OpenAI API 오류 (${res.status})` };
        }
        return { valid: true };
      }

      default:
        return { valid: false, error: "지원하지 않는 AI 제공자입니다" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `API 키 검증 실패: ${message}` };
  }
}

// POST /api/ai-characters — 유저 AI 캐릭터 등록
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, username, bio, personality, systemPrompt, expertise, aiProvider, apiKey } = body as {
    name: string; username: string; bio?: string; personality: string;
    systemPrompt: string; expertise: string[]; aiProvider: string; apiKey: string;
  };

  if (!name || !username || !personality || !systemPrompt || !aiProvider || !apiKey) {
    return NextResponse.json({ error: "필수 항목을 모두 입력해주세요" }, { status: 400 });
  }

  // 사용자명 유효성 (최소 2자, 영문/숫자/하이픈/언더스코어)
  if (username.length < 2 || !/^[a-z0-9_-]+$/.test(username)) {
    return NextResponse.json({ error: "사용자명은 2자 이상 영문 소문자, 숫자, -, _ 만 가능합니다" }, { status: 400 });
  }

  // 이름 최소 길이
  if (name.trim().length < 2) {
    return NextResponse.json({ error: "AI 이름은 2자 이상이어야 합니다" }, { status: 400 });
  }

  // 성격/프롬프트 최소 길이
  if (personality.trim().length < 10) {
    return NextResponse.json({ error: "성격 설명을 10자 이상 작성해주세요" }, { status: 400 });
  }
  if (systemPrompt.trim().length < 10) {
    return NextResponse.json({ error: "시스템 프롬프트를 10자 이상 작성해주세요" }, { status: 400 });
  }

  const existing = await prisma.aiCharacter.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "이미 사용 중인 사용자명입니다" }, { status: 409 });
  }

  // API 키 실제 검증 — 테스트 호출로 유효한 키인지 확인
  const validation = await validateApiKey(aiProvider, apiKey);
  if (!validation.valid) {
    return NextResponse.json(
      { error: `API 키가 유효하지 않습니다: ${validation.error}` },
      { status: 422 }
    );
  }

  const character = await prisma.aiCharacter.create({
    data: {
      name: name.trim(),
      username,
      bio: bio?.trim() ?? "",
      personality: personality.trim(),
      systemPrompt: systemPrompt.trim(),
      expertise: toJsonString(expertise),
      aiProvider,
      apiKeyEncrypted: encrypt(apiKey),
      isSystem: false,
      ownerId: session.user.id,
    },
    select: {
      id: true, name: true, username: true, avatar: true, bio: true,
      personality: true, expertise: true, isSystem: true, isActive: true, aiProvider: true,
    },
  });

  return NextResponse.json({ ...character, expertise: parseJsonArray(character.expertise) }, { status: 201 });
}
