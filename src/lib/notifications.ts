import { prisma } from "@/lib/prisma";

type CreateNotificationParams = {
  type: "like" | "comment" | "follow" | "ai_comment" | "dm";
  content: string;
  userId: string; // recipient
  actorId?: string; // human actor
  aiActorId?: string; // AI actor
  postId?: string;
};

export async function createNotification(params: CreateNotificationParams) {
  // Don't notify yourself
  if (params.actorId && params.actorId === params.userId) return;

  try {
    await prisma.notification.create({
      data: {
        type: params.type,
        content: params.content,
        userId: params.userId,
        actorId: params.actorId ?? null,
        aiActorId: params.aiActorId ?? null,
        postId: params.postId ?? null,
      },
    });
  } catch {
    // Silently ignore notification errors
  }
}
