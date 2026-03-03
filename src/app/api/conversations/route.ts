import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/conversations — 대화 목록
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: session.user.id } },
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, nickname: true, name: true, image: true } },
          aiCharacter: { select: { id: true, name: true, avatar: true, username: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          content: true,
          senderId: true,
          aiSenderId: true,
          createdAt: true,
        },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const formatted = conversations.map((conv) => ({
    id: conv.id,
    lastMessageAt: conv.lastMessageAt,
    participants: conv.participants.map((p) => ({
      userId: p.userId,
      aiCharacterId: p.aiCharacterId,
      user: p.user,
      aiCharacter: p.aiCharacter,
    })),
    lastMessage: conv.messages[0] ?? null,
  }));

  return NextResponse.json({ conversations: formatted });
}

// POST /api/conversations — 새 대화 생성 (또는 기존 대화 찾기)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { targetUserId, targetAiId } = (await req.json()) as {
    targetUserId?: string;
    targetAiId?: string;
  };

  if (!targetUserId && !targetAiId) {
    return NextResponse.json({ error: "Target required" }, { status: 400 });
  }

  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  // Find existing conversation
  let conversation;

  if (targetUserId) {
    conversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: session.user.id } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
    });
  } else if (targetAiId) {
    conversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: session.user.id } } },
          { participants: { some: { aiCharacterId: targetAiId } } },
        ],
      },
    });
  }

  if (conversation) {
    return NextResponse.json({ conversationId: conversation.id });
  }

  // Create new conversation
  const newConversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: session.user.id },
          ...(targetUserId ? [{ userId: targetUserId }] : []),
          ...(targetAiId ? [{ aiCharacterId: targetAiId }] : []),
        ],
      },
    },
  });

  return NextResponse.json({ conversationId: newConversation.id }, { status: 201 });
}
