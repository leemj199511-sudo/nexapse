import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/services/ai/ai-engine";
import { buildDmReplyPrompt } from "@/services/ai/ai-prompt-builder";
import { decrypt } from "@/lib/encryption";
import { createNotification } from "@/lib/notifications";
import { canUseFreeTrialMessage, incrementFreeTrialUsage, getRemainingFreeMessages } from "@/lib/free-trial";

// POST /api/messages — 메시지 전송
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId, content } = (await req.json()) as {
    conversationId: string;
    content: string;
  };

  if (!conversationId || !content?.trim()) {
    return NextResponse.json({ error: "conversationId and content required" }, { status: 400 });
  }

  // Verify participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  });

  if (!participant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      content: content.trim(),
      conversationId,
      senderId: session.user.id,
    },
    include: {
      sender: { select: { id: true, nickname: true, name: true, image: true } },
      aiSender: { select: { id: true, name: true, avatar: true, username: true } },
    },
  });

  // Update conversation lastMessageAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  // Notify other participants
  const allParticipants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
  });

  const senderName = message.sender?.nickname ?? message.sender?.name ?? "누군가";

  for (const p of allParticipants) {
    if (p.userId && p.userId !== session.user.id) {
      await createNotification({
        type: "dm",
        content: `${senderName}님이 메시지를 보냈습니다: "${content.trim().slice(0, 30)}..."`,
        userId: p.userId,
        actorId: session.user.id,
      });
    }
  }

  // Check if conversation includes an AI character → auto-reply
  const aiParticipant = allParticipants.find((p) => p.aiCharacterId);
  if (aiParticipant?.aiCharacterId) {
    // Check if this AI character uses system API key (no own key)
    const aiChar = await prisma.aiCharacter.findUnique({
      where: { id: aiParticipant.aiCharacterId },
      select: { apiKeyEncrypted: true, isSystem: true },
    });

    const usesSystemKey = !aiChar?.apiKeyEncrypted;

    if (usesSystemKey) {
      // Free trial check: system AI characters use shared API key with daily limit
      const canUse = await canUseFreeTrialMessage(session.user.id);
      if (!canUse) {
        const usage = await getRemainingFreeMessages(session.user.id);
        return NextResponse.json({
          ...message,
          _freeTrialExhausted: true,
          _freeTrialUsage: usage,
        }, { status: 201 });
      }
      // Increment usage counter
      await incrementFreeTrialUsage(session.user.id);
    }

    // AI 답변을 응답 전에 완료 (Vercel 서버리스에서 fire-and-forget은 죽을 수 있음)
    await generateAiReply(conversationId, aiParticipant.aiCharacterId, content.trim()).catch((err) => {
      console.error("[Messages] AI reply error:", err instanceof Error ? err.message : err);
    });
  }

  return NextResponse.json(message, { status: 201 });
}

async function generateAiReply(conversationId: string, aiCharacterId: string, userMessage: string) {
  const character = await prisma.aiCharacter.findUnique({
    where: { id: aiCharacterId },
  });
  if (!character || !character.isActive) return;

  // Get recent messages for context
  const recentMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      sender: { select: { nickname: true, name: true } },
    },
  });

  const prompt = buildDmReplyPrompt(character, userMessage, recentMessages.reverse());

  // System AI characters without their own key use the shared system API key
  const apiKey = character.apiKeyEncrypted
    ? decrypt(character.apiKeyEncrypted)
    : null; // null → ai-engine falls back to system key (ANTHROPIC_API_KEY)

  const reply = await generateText({
    provider: character.aiProvider as "claude" | "gemini" | "openai" | "custom",
    apiKey,
    prompt,
    maxTokens: 200,
  });

  if (!reply) return;

  await prisma.message.create({
    data: {
      content: reply,
      conversationId,
      aiSenderId: aiCharacterId,
      isAiGenerated: true,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });
}
