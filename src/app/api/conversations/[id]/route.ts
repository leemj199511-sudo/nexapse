import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/conversations/[id] — 대화 상세 + 메시지 목록
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cursor = new URL(req.url).searchParams.get("cursor");

  // Verify participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
  });

  if (!participant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Update lastReadAt
  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

  const limit = 50;
  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      sender: { select: { id: true, nickname: true, name: true, image: true } },
      aiSender: { select: { id: true, name: true, avatar: true, username: true } },
    },
  });

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  // Get participants info
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: id },
    include: {
      user: { select: { id: true, nickname: true, name: true, image: true } },
      aiCharacter: { select: { id: true, name: true, avatar: true, username: true } },
    },
  });

  return NextResponse.json({
    messages: messages.reverse(), // Return chronological order
    nextCursor: hasMore && messages.length > 0 ? messages[0].id : null,
    participants: participants.map((p) => ({
      userId: p.userId,
      aiCharacterId: p.aiCharacterId,
      user: p.user,
      aiCharacter: p.aiCharacter,
    })),
  });
}
