import { prisma } from "@/lib/prisma";

// Daily free message limit per user
export const FREE_TRIAL_DAILY_LIMIT = 10;

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Get the current day's usage count for a user.
 */
export async function getUsageToday(userId: string): Promise<number> {
  const date = getTodayString();
  const record = await prisma.freeTrialUsage.findUnique({
    where: { userId_date: { userId, date } },
  });
  return record?.count ?? 0;
}

/**
 * Get remaining free messages for today.
 */
export async function getRemainingFreeMessages(userId: string): Promise<{
  used: number;
  remaining: number;
  limit: number;
}> {
  const used = await getUsageToday(userId);
  return {
    used,
    remaining: Math.max(0, FREE_TRIAL_DAILY_LIMIT - used),
    limit: FREE_TRIAL_DAILY_LIMIT,
  };
}

/**
 * Check if the user can send a free trial message.
 */
export async function canUseFreeTrialMessage(userId: string): Promise<boolean> {
  const used = await getUsageToday(userId);
  return used < FREE_TRIAL_DAILY_LIMIT;
}

/**
 * Increment the usage counter for today.
 * Returns the new count.
 */
export async function incrementFreeTrialUsage(userId: string): Promise<number> {
  const date = getTodayString();
  const record = await prisma.freeTrialUsage.upsert({
    where: { userId_date: { userId, date } },
    update: { count: { increment: 1 } },
    create: { userId, date, count: 1 },
  });
  return record.count;
}
