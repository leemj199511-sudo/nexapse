import { prisma } from "@/lib/prisma";
import { generateText } from "./ai-engine";
import { buildPostPrompt, buildCommentPrompt, buildReplyPrompt, buildKnowledgeEnhancedPostPrompt } from "./ai-prompt-builder";
import { decrypt } from "@/lib/encryption";
import { createNotification } from "@/lib/notifications";
import { gatherWebKnowledge } from "./ai-web-gatherer";
import { getRelevantKnowledge, markKnowledgeUsed } from "./ai-knowledge-service";

// 24시간 자율 활동 (Vercel Hobby 10초 제한)
const MAX_POSTS_PER_RUN = 1;
const MAX_COMMENTS_PER_RUN = 1;
const MAX_REPLIES_PER_RUN = 1;
const DEADLINE_MS = 8_000; // 8초 (Hobby 10초 제한, 2초 여유)

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

  // Get active AI characters (24시간 활동)
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

  // --- Phase 2.5a: 인간 댓글 필수 답글 (100%, 제한 없음) ---
  const userCommentsOnAiPosts = await prisma.comment.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }, // 48시간 이내
      parentId: null,
      aiCharacterId: null, // 인간이 단 댓글
      authorId: { not: null },
      post: { aiCharacterId: { not: null } }, // AI 포스트에
      replies: { none: { isAiGenerated: true } }, // AI 답글 아직 없음
    },
    include: {
      post: {
        select: {
          content: true,
          aiCharacterId: true,
          aiCharacter: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  for (const targetComment of userCommentsOnAiPosts) {
    if (!hasTime()) break;
    const postAi = targetComment.post.aiCharacter;
    if (!postAi) continue;

    try {
      const prompt = buildReplyPrompt(postAi, targetComment.post, targetComment);
      const content = await generateText({
        provider: postAi.aiProvider as "claude" | "gemini" | "openai" | "custom",
        apiKey: postAi.apiKeyEncrypted ? decrypt(postAi.apiKeyEncrypted) : null,
        prompt,
        maxTokens: 120,
      });

      if (!content) continue;

      await prisma.$transaction([
        prisma.comment.create({
          data: {
            content,
            postId: targetComment.postId,
            parentId: targetComment.id,
            aiCharacterId: postAi.id,
            isAiGenerated: true,
          },
        }),
        prisma.post.update({
          where: { id: targetComment.postId },
          data: { commentCount: { increment: 1 } },
        }),
      ]);

      if (targetComment.authorId) {
        await createNotification({
          type: "ai_comment",
          content: `AI ${postAi.name}이(가) 회원님의 댓글에 답글을 남겼습니다.`,
          userId: targetComment.authorId,
          aiActorId: postAi.id,
          postId: targetComment.postId,
        });
      }

      repliesCreated++;
    } catch (err) {
      errors.push(`UserReplyMust(${postAi.name}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Phase 2.5b: 일반 답글 (30%) ---
  const recentComments = await prisma.comment.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      parentId: null,
      replies: { none: { isAiGenerated: true } },
    },
    include: {
      post: { select: { content: true, aiCharacterId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  for (const char of characters) {
    if (repliesCreated >= MAX_REPLIES_PER_RUN + 5 || !hasTime()) break;

    if (Math.random() > 0.3) continue;

    const eligibleComments = recentComments.filter(
      (c) => c.aiCharacterId !== char.id
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
