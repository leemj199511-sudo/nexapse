import { prisma } from "@/lib/prisma";
import { generateText } from "./ai-engine";
import { buildPostPrompt, buildCommentPrompt, buildReplyPrompt, buildKnowledgeEnhancedPostPrompt } from "./ai-prompt-builder";
import { decrypt } from "@/lib/encryption";
import { createNotification } from "@/lib/notifications";
import { gatherWebKnowledge } from "./ai-web-gatherer";
import { getRelevantKnowledge, markKnowledgeUsed } from "./ai-knowledge-service";

const KST_OFFSET = 9 * 60 * 60 * 1000;
const ACTIVE_START_HOUR = 7;  // 07:00 KST
const ACTIVE_END_HOUR = 24;   // 24:00 KST
const MAX_POSTS_PER_RUN = 2;
const MAX_COMMENTS_PER_RUN = 4;
const MAX_REPLIES_PER_RUN = 3;
const DEADLINE_MS = 50_000; // 50초 (60초 제한, 10초 여유)

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

const MAX_GATHER_PER_RUN = 3;

export async function runAiPostScheduler(): Promise<{
  postsCreated: number;
  commentsCreated: number;
  repliesCreated: number;
  knowledgeGathered: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let postsCreated = 0;
  let commentsCreated = 0;
  let repliesCreated = 0;
  let knowledgeGathered = 0;

  const startTime = Date.now();
  const hasTime = () => Date.now() - startTime < DEADLINE_MS;

  // Check active hours (KST)
  const hour = getKSTHour();
  if (hour < ACTIVE_START_HOUR || hour >= ACTIVE_END_HOUR) {
    return { postsCreated, commentsCreated, repliesCreated, knowledgeGathered, errors: ["Outside active hours"] };
  }

  // Get active AI characters
  const characters = await prisma.aiCharacter.findMany({
    where: { isActive: true },
  });

  // --- Phase 0: Web Knowledge Gathering ---
  if (process.env.BRAVE_SEARCH_API_KEY) {
    let gatherCount = 0;
    for (const char of characters) {
      if (gatherCount >= MAX_GATHER_PER_RUN || !hasTime()) break;
      try {
        const gathered = await gatherWebKnowledge(char);
        if (gathered > 0) {
          knowledgeGathered += gathered;
          gatherCount++;
        }
      } catch (err) {
        errors.push(`Gather error (${char.name}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // --- Phase 1: AI Posting (with knowledge-enhanced prompts) ---
  for (const char of characters) {
    if (postsCreated >= MAX_POSTS_PER_RUN || !hasTime()) break;

    if (!shouldPost(char.lastPostAt, char.postFrequency)) continue;

    try {
      let content: string;
      let usedIds: string[] = [];

      // 수집된 지식이 있으면 enhanced 프롬프트 사용
      const knowledge = await getRelevantKnowledge(char.id, 3);
      if (knowledge.length > 0) {
        const { prompt, usedKnowledgeIds } = buildKnowledgeEnhancedPostPrompt(char, knowledge);
        usedIds = usedKnowledgeIds;
        content = await generateText({
          provider: char.aiProvider as "claude" | "gemini" | "openai" | "custom",
          apiKey: char.apiKeyEncrypted ? decrypt(char.apiKeyEncrypted) : null,
          prompt,
        }) || "";
      } else {
        // fallback: 기존 프롬프트
        const prompt = buildPostPrompt(char);
        content = await generateText({
          provider: char.aiProvider as "claude" | "gemini" | "openai" | "custom",
          apiKey: char.apiKeyEncrypted ? decrypt(char.apiKeyEncrypted) : null,
          prompt,
        }) || "";
      }

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

      // 사용된 지식 카운트 증가
      if (usedIds.length > 0) {
        await markKnowledgeUsed(usedIds);
      }

      postsCreated++;
    } catch (err) {
      errors.push(`Post error (${char.name}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Phase 2: AI Comments on recent posts ---
  if (!hasTime()) return { postsCreated, commentsCreated, repliesCreated, knowledgeGathered, errors };
  const recentPosts = await prisma.post.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) }, // last 12h
    },
    include: {
      comments: { select: { content: true, aiCharacterId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  for (const char of characters) {
    if (commentsCreated >= MAX_COMMENTS_PER_RUN || !hasTime()) break;

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
        apiKey: char.apiKeyEncrypted ? decrypt(char.apiKeyEncrypted) : null,
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

      // Notify post author about AI comment
      if (targetPost.authorId) {
        await createNotification({
          type: "ai_comment",
          content: `AI ${char.name}이(가) 회원님의 게시글에 댓글을 남겼습니다.`,
          userId: targetPost.authorId,
          aiActorId: char.id,
          postId: targetPost.id,
        });
      }

      commentsCreated++;
    } catch (err) {
      errors.push(`Comment error (${char.name}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Phase 2.5: AI Replies to existing comments ---
  const recentComments = await prisma.comment.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      parentId: null, // top-level comments only
      replies: { none: { isAiGenerated: true } }, // no AI reply yet
    },
    include: {
      post: { select: { content: true, aiCharacterId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // 우선: 내 포스트에 달린 유저 댓글에 답글 (포스트 주인 AI 우선 응답, 80%)
  for (const char of characters) {
    if (repliesCreated >= MAX_REPLIES_PER_RUN || !hasTime()) break;

    const userCommentsOnMyPosts = recentComments.filter(
      (c) =>
        c.post.aiCharacterId === char.id && // 내 포스트에
        !c.aiCharacterId && // 유저가 단 댓글
        c.authorId
    );

    for (const targetComment of userCommentsOnMyPosts) {
      if (repliesCreated >= MAX_REPLIES_PER_RUN || !hasTime()) break;
      if (Math.random() > 0.8) continue;

      try {
        const prompt = buildReplyPrompt(char, targetComment.post, targetComment);
        const content = await generateText({
          provider: char.aiProvider as "claude" | "gemini" | "openai" | "custom",
          apiKey: char.apiKeyEncrypted ? decrypt(char.apiKeyEncrypted) : null,
          prompt,
          maxTokens: 80,
        });

        if (!content) continue;

        await prisma.$transaction([
          prisma.comment.create({
            data: {
              content,
              postId: targetComment.postId,
              parentId: targetComment.id,
              aiCharacterId: char.id,
              isAiGenerated: true,
            },
          }),
          prisma.post.update({
            where: { id: targetComment.postId },
            data: { commentCount: { increment: 1 } },
          }),
        ]);

        // 유저에게 답글 알림
        if (targetComment.authorId) {
          await createNotification({
            type: "ai_comment",
            content: `AI ${char.name}이(가) 회원님의 댓글에 답글을 남겼습니다.`,
            userId: targetComment.authorId,
            aiActorId: char.id,
            postId: targetComment.postId,
          });
        }

        repliesCreated++;
      } catch (err) {
        errors.push(`UserReply error (${char.name}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // 그 다음: 일반 답글 (30%)
  for (const char of characters) {
    if (repliesCreated >= MAX_REPLIES_PER_RUN || !hasTime()) break;

    // 30% chance to reply
    if (Math.random() > 0.3) continue;

    const eligibleComments = recentComments.filter(
      (c) => c.aiCharacterId !== char.id // Don't reply to own comments
    );
    if (eligibleComments.length === 0) continue;

    const targetComment = eligibleComments[Math.floor(Math.random() * eligibleComments.length)];

    try {
      const prompt = buildReplyPrompt(char, targetComment.post, targetComment);
      const content = await generateText({
        provider: char.aiProvider as "claude" | "gemini" | "openai" | "custom",
        apiKey: char.apiKeyEncrypted ? decrypt(char.apiKeyEncrypted) : null,
        prompt,
        maxTokens: 80,
      });

      if (!content) continue;

      await prisma.$transaction([
        prisma.comment.create({
          data: {
            content,
            postId: targetComment.postId,
            parentId: targetComment.id,
            aiCharacterId: char.id,
            isAiGenerated: true,
          },
        }),
        prisma.post.update({
          where: { id: targetComment.postId },
          data: { commentCount: { increment: 1 } },
        }),
      ]);

      repliesCreated++;
    } catch (err) {
      errors.push(`Reply error (${char.name}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Phase 3: AI Likes ---
  for (const char of characters) {
    // 70% chance to like
    if (Math.random() > 0.7) continue;

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

  return { postsCreated, commentsCreated, repliesCreated, knowledgeGathered, errors };
}
