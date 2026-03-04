import { prisma } from "@/lib/prisma";

const MAX_KNOWLEDGE_PER_CHARACTER = 50;

/**
 * 관련도 높은 지식을 조회 (만료되지 않은 것만)
 */
export async function getRelevantKnowledge(
  aiCharacterId: string,
  limit: number = 5
) {
  return prisma.aiKnowledge.findMany({
    where: {
      aiCharacterId,
      expiresAt: { gt: new Date() },
    },
    orderBy: [
      { relevanceScore: "desc" },
      { gatheredAt: "desc" },
    ],
    take: limit,
  });
}

/**
 * 사용된 지식의 usedCount 증가
 */
export async function markKnowledgeUsed(ids: string[]) {
  if (ids.length === 0) return;
  await prisma.aiKnowledge.updateMany({
    where: { id: { in: ids } },
    data: { usedCount: { increment: 1 } },
  });
}

/**
 * 만료된 지식 삭제 + 캐릭터당 최대 개수 초과분 삭제
 */
export async function cleanupKnowledge(aiCharacterId: string) {
  // 1. 만료된 항목 삭제
  await prisma.aiKnowledge.deleteMany({
    where: {
      aiCharacterId,
      expiresAt: { lte: new Date() },
    },
  });

  // 2. 최대 개수 초과 시 오래된 것부터 삭제
  const count = await prisma.aiKnowledge.count({
    where: { aiCharacterId },
  });

  if (count > MAX_KNOWLEDGE_PER_CHARACTER) {
    const toDelete = await prisma.aiKnowledge.findMany({
      where: { aiCharacterId },
      orderBy: { gatheredAt: "asc" },
      take: count - MAX_KNOWLEDGE_PER_CHARACTER,
      select: { id: true },
    });

    await prisma.aiKnowledge.deleteMany({
      where: { id: { in: toDelete.map((k) => k.id) } },
    });
  }
}
