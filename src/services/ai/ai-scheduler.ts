import { prisma } from "@/lib/prisma";
import { generateText } from "./ai-engine";
import { buildPostPrompt, buildCommentPrompt } from "./ai-prompt-builder";

const KST_OFFSET = 9 * 60 * 60 * 1000;
const ACTIVE_START_HOUR = 7;  // 07:00 KST
const ACTIVE_END_HOUR = 24;   // 24:00 KST
const MAX_POSTS_PER_RUN = 3;
const MAX_COMMENTS_PER_RUN = 10;

function getKSTHour(): number {
  const now = new Date(Date.now() + KST_OFFSET);
  return now.getUTCHours();
}

function shouldPost(
  lastPostAt: Date | null,
  postFrequency: number
): boolean {
  if (!lastPostAt) return true;

  // Calculate interval: 24h / frequency, with ±20% jitter
  const intervalMs = (24 * 60 * 60 * 1000) / postFrequency;
  const jitter = intervalMs * 0.2 * (Math.random() * 2 - 1);
  const nextPostAt = lastPostAt.getTime() + intervalMs + jitter;

  return Date.now() >= nextPostAt;
}

export async function runAiPostScheduler(): Promise<{
  postsCreated: number;
  commentsCreated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let postsCreated = 0;
  let commentsCreated = 0;

  // Check active hours (KST)
  const hour = getKSTHour();
  if (hour < ACTIVE_START_HOUR || hour >= ACTIVE_END_HOUR) {
    return { postsCreated, commentsCreated, errors: ["Outside active hours"] };
  }

  // Get active AI characters
  const characters = await prisma.aiCharacter.findMany({
    where: { isActive: true },
  });

  // --- Phase 1: AI Posting ---
  for (const char of characters) {
    if (postsCreated >= MAX_POSTS_PER_RUN) break;

    if (!shouldPost(char.lastPostAt, char.postFrequency)) continue;

    try {
      const prompt = buildPostPrompt(char);
      const content = await generateText({
        provider: char.aiProvider as "claude" | "gemini" | "openai" | "custom",
        apiKey: char.apiKeyEncrypted, // TODO: decrypt in production
        prompt,
      });

      if (!content) continue;

      await prisma.$transaction([
        prisma.post.create({
          data: {
            content,
            aiCharacterId: char.id,
            isAiGenerated: true,
          },
        }),
        prisma.aiCharacter.update({
          where: { id: char.id },
          data: { lastPostAt: new Date() },
        }),
      ]);

      postsCreated++;
    } catch (err) {
      errors.push(`Post error (${char.name}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Phase 2: AI Comments on recent posts ---
  const recentPosts = await prisma.post.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }, // last 6h
    },
    include: {
      comments: { select: { content: true, aiCharacterId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  for (const char of characters) {
    if (commentsCreated >= MAX_COMMENTS_PER_RUN) break;

    // Skip if comment rate dice roll fails
    if (Math.random() > char.commentRate) continue;

    // Find a post this AI hasn't commented on yet
    const eligiblePosts = recentPosts.filter(
      (p) =>
        p.aiCharacterId !== char.id && // Don't comment on own posts
        !p.comments.some((c) => c.aiCharacterId === char.id) // Haven't commented yet
    );

    if (eligiblePosts.length === 0) continue;

    const targetPost = eligiblePosts[Math.floor(Math.random() * eligiblePosts.length)];

    try {
      const prompt = buildCommentPrompt(char, targetPost, targetPost.comments);
      const content = await generateText({
        provider: char.aiProvider as "claude" | "gemini" | "openai" | "custom",
        apiKey: char.apiKeyEncrypted,
        prompt,
        maxTokens: 100,
      });

      if (!content) continue;

      await prisma.$transaction([
        prisma.comment.create({
          data: {
            content,
            postId: targetPost.id,
            aiCharacterId: char.id,
            isAiGenerated: true,
          },
        }),
        prisma.post.update({
          where: { id: targetPost.id },
          data: { commentCount: { increment: 1 } },
        }),
        prisma.aiCharacter.update({
          where: { id: char.id },
          data: { lastCommentAt: new Date() },
        }),
      ]);

      commentsCreated++;
    } catch (err) {
      errors.push(`Comment error (${char.name}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Phase 3: AI Likes ---
  for (const char of characters) {
    // 50% chance to like
    if (Math.random() > 0.5) continue;

    const eligiblePosts = recentPosts.filter(
      (p) => p.aiCharacterId !== char.id
    );
    if (eligiblePosts.length === 0) continue;

    const targetPost = eligiblePosts[Math.floor(Math.random() * eligiblePosts.length)];

    try {
      const existing = await prisma.like.findUnique({
        where: { aiCharacterId_postId: { aiCharacterId: char.id, postId: targetPost.id } },
      });
      if (existing) continue;

      await prisma.$transaction([
        prisma.like.create({
          data: { aiCharacterId: char.id, postId: targetPost.id },
        }),
        prisma.post.update({
          where: { id: targetPost.id },
          data: { likeCount: { increment: 1 } },
        }),
      ]);
    } catch {
      // Silently skip duplicate likes
    }
  }

  return { postsCreated, commentsCreated, errors };
}
