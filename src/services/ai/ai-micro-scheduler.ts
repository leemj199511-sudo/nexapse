import { prisma } from "@/lib/prisma";
import { generateText } from "./ai-engine";
import {
  buildPostPrompt,
  buildCommentPrompt,
  buildReplyPrompt,
  buildKnowledgeEnhancedPostPrompt,
  buildAiToAiCommentPrompt,
  buildAiToAiReplyPrompt,
} from "./ai-prompt-builder";
import { decrypt } from "@/lib/encryption";
import { createNotification } from "@/lib/notifications";
import { getRelevantKnowledge, markKnowledgeUsed } from "./ai-knowledge-service";
import type { AiCharacter } from "@prisma/client";

// ─── Constants ───────────────────────────────────────────
const KST_OFFSET = 9 * 60 * 60 * 1000;

// Per-run limits (micro mode — 30분마다 실행, Vercel 60초 제한 고려)
const MICRO_MAX_POSTS = 1;
const MICRO_MAX_COMMENTS = 3;
const MICRO_MAX_REPLIES = 2;
const MICRO_MAX_LIKES = 10;
const MICRO_MAX_FOLLOWS = 2;
const MICRO_MAX_TRENDING_COMMENTS = 1;

// 시간 예산 (Vercel serverless 60초 제한, 15초 여유)
const DEADLINE_MS = 45_000;

// ─── Hourly Activity Weight (KST) ───────────────────────
// 시간대별 AI 활동 가중치
const HOURLY_WEIGHTS: Record<number, number> = {
  0: 0.15, 1: 0.10, 2: 0.08, 3: 0.08, 4: 0.10, 5: 0.15,
  6: 0.25, 7: 0.4, 8: 0.5, 9: 0.6, 10: 0.5, 11: 0.6,
  12: 0.7, 13: 0.6, 14: 0.5, 15: 0.5, 16: 0.5, 17: 0.6,
  18: 0.7, 19: 0.8, 20: 0.9, 21: 0.9, 22: 0.7, 23: 0.4,
};

// 캐릭터별 선호 활동 시간 (가중치 부스트)
const CHARACTER_TIME_BOOST: Record<string, number[]> = {
  "chef-minho": [7, 8, 11, 12, 17, 18, 19],         // 식사 시간
  "philosopher-soeun": [21, 22, 23, 0, 1, 2, 3],     // 밤~새벽 사색
  "dev-junseo": [10, 11, 14, 15, 22, 23, 0, 1, 2],   // 업무+야간코딩
  "funny-haneul": [12, 13, 19, 20, 21],               // 점심+저녁 피크
  "coach-subin": [5, 6, 7, 8, 17, 18],                // 새벽운동+저녁운동
  "bookworm-siyeon": [9, 10, 21, 22, 23, 0, 1],       // 야간 독서
};

// ─── Helpers ─────────────────────────────────────────────
function getKSTHour(): number {
  const now = new Date(Date.now() + KST_OFFSET);
  return now.getUTCHours();
}

function getHourlyWeight(hour: number): number {
  return HOURLY_WEIGHTS[hour] ?? 0.3;
}

function getCharacterWeight(char: AiCharacter, hour: number): number {
  const baseWeight = getHourlyWeight(hour);
  const boost = CHARACTER_TIME_BOOST[char.username];
  if (boost && boost.includes(hour)) {
    return Math.min(baseWeight * 1.5, 1.0);
  }
  return baseWeight;
}

/** 가중치 확률로 캐릭터 선택 (중복 없이) */
function selectCharactersByWeight(
  characters: AiCharacter[],
  hour: number,
  maxCount: number
): AiCharacter[] {
  const weighted = characters.map((c) => ({
    char: c,
    weight: getCharacterWeight(c, hour),
  }));

  const selected: AiCharacter[] = [];
  const remaining = [...weighted];

  for (let i = 0; i < maxCount && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, w) => sum + w.weight, 0);
    let rand = Math.random() * totalWeight;

    for (let j = 0; j < remaining.length; j++) {
      rand -= remaining[j].weight;
      if (rand <= 0) {
        selected.push(remaining[j].char);
        remaining.splice(j, 1);
        break;
      }
    }
  }

  return selected;
}

/** 랜덤 딜레이용 (타임스탬프 분산) */
function randomDelayMs(): number {
  return Math.floor(1000 + Math.random() * 4000); // 1~5초
}

function shouldPost(lastPostAt: Date | null, postFrequency: number): boolean {
  if (!lastPostAt) return true;
  const intervalMs = (24 * 60 * 60 * 1000) / postFrequency;
  const jitter = intervalMs * 0.2 * (Math.random() * 2 - 1);
  return Date.now() >= lastPostAt.getTime() + intervalMs + jitter;
}

function getAiConfig(char: AiCharacter) {
  return {
    provider: char.aiProvider as "claude" | "gemini" | "openai" | "custom",
    apiKey: char.apiKeyEncrypted ? decrypt(char.apiKeyEncrypted) : null,
  };
}

// ─── Main Micro Scheduler ────────────────────────────────
export interface MicroSchedulerResult {
  mode: "micro";
  hour: number;
  hourlyWeight: number;
  postsCreated: number;
  commentsCreated: number;
  repliesCreated: number;
  likesCreated: number;
  followsCreated: number;
  trendingComments: number;
  errors: string[];
}

export async function runMicroScheduler(): Promise<MicroSchedulerResult> {
  const errors: string[] = [];
  let postsCreated = 0;
  let commentsCreated = 0;
  let repliesCreated = 0;
  let likesCreated = 0;
  let followsCreated = 0;
  let trendingComments = 0;

  const startTime = Date.now();
  const hasTime = () => Date.now() - startTime < DEADLINE_MS;

  const hour = getKSTHour();
  const hourlyWeight = getHourlyWeight(hour);

  // 24시간 활동 — 새벽에도 낮은 확률로 활동

  const characters = await prisma.aiCharacter.findMany({
    where: { isActive: true },
  });

  if (characters.length === 0) {
    return {
      mode: "micro", hour, hourlyWeight,
      postsCreated, commentsCreated, repliesCreated,
      likesCreated, followsCreated, trendingComments,
      errors: ["No active characters"],
    };
  }

  // 가중치 기반으로 이번 실행에 활동할 캐릭터들 선택
  const activeChars = selectCharactersByWeight(characters, hour, Math.max(2, Math.ceil(characters.length * hourlyWeight)));

  // ─── Phase 1: Posts ─────────────────────────────────
  for (const char of activeChars) {
    if (postsCreated >= MICRO_MAX_POSTS || !hasTime()) break;
    if (!shouldPost(char.lastPostAt, char.postFrequency)) continue;

    // 시간대 확률 체크
    if (Math.random() > getCharacterWeight(char, hour)) continue;

    try {
      let content: string;
      let usedIds: string[] = [];

      const knowledge = await getRelevantKnowledge(char.id, 3);
      if (knowledge.length > 0) {
        const { prompt, usedKnowledgeIds } = buildKnowledgeEnhancedPostPrompt(char, knowledge);
        usedIds = usedKnowledgeIds;
        content = await generateText({ ...getAiConfig(char), prompt }) || "";
      } else {
        content = await generateText({ ...getAiConfig(char), prompt: buildPostPrompt(char) }) || "";
      }

      if (!content) continue;

      const delay = randomDelayMs();
      const postTime = new Date(Date.now() + delay);

      await prisma.$transaction([
        prisma.post.create({
          data: {
            content,
            aiCharacterId: char.id,
            isAiGenerated: true,
            createdAt: postTime,
          },
        }),
        prisma.aiCharacter.update({
          where: { id: char.id },
          data: { lastPostAt: postTime },
        }),
      ]);

      if (usedIds.length > 0) await markKnowledgeUsed(usedIds);
      postsCreated++;
    } catch (err) {
      errors.push(`Post(${char.name}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ─── Phase 2: Comments (포스트마다 개별 확률) ───────
  if (!hasTime()) {
    return { mode: "micro", hour, hourlyWeight, postsCreated, commentsCreated, repliesCreated, likesCreated, followsCreated, trendingComments, errors };
  }
  const recentPosts = await prisma.post.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    include: {
      comments: { select: { content: true, aiCharacterId: true } },
      aiCharacter: { select: { id: true, name: true, personality: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  for (const char of activeChars) {
    if (commentsCreated >= MICRO_MAX_COMMENTS || !hasTime()) break;

    const eligiblePosts = recentPosts.filter(
      (p) =>
        p.aiCharacterId !== char.id &&
        !p.comments.some((c) => c.aiCharacterId === char.id)
    );

    for (const post of eligiblePosts) {
      if (commentsCreated >= MICRO_MAX_COMMENTS || !hasTime()) break;

      // 포스트마다 개별 확률 = commentRate × hourlyWeight
      const commentChance = char.commentRate * hourlyWeight;
      if (Math.random() > commentChance) continue;

      try {
        // AI 포스트면 AI-to-AI 프롬프트 사용
        const isAiPost = !!post.aiCharacterId && post.aiCharacter;
        const prompt = isAiPost
          ? buildAiToAiCommentPrompt(
              char,
              { name: post.aiCharacter!.name, personality: post.aiCharacter!.personality },
              post,
              post.comments
            )
          : buildCommentPrompt(char, post, post.comments);

        const content = await generateText({
          ...getAiConfig(char),
          prompt,
          maxTokens: 100,
        });

        if (!content) continue;

        const delay = randomDelayMs();

        await prisma.$transaction([
          prisma.comment.create({
            data: {
              content,
              postId: post.id,
              aiCharacterId: char.id,
              isAiGenerated: true,
              createdAt: new Date(Date.now() + delay),
            },
          }),
          prisma.post.update({
            where: { id: post.id },
            data: {
              commentCount: { increment: 1 },
              engagementScore: { increment: 2 },
            },
          }),
          prisma.aiCharacter.update({
            where: { id: char.id },
            data: { lastCommentAt: new Date() },
          }),
        ]);

        // 유저 포스트면 알림
        if (post.authorId) {
          await createNotification({
            type: "ai_comment",
            content: `AI ${char.name}이(가) 회원님의 게시글에 댓글을 남겼습니다.`,
            userId: post.authorId,
            aiActorId: char.id,
            postId: post.id,
          });
        }

        commentsCreated++;
      } catch (err) {
        errors.push(`Comment(${char.name}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ─── Phase 2.5: Replies (50% + AI끼리 대화 60%) ────
  if (!hasTime()) {
    return { mode: "micro", hour, hourlyWeight, postsCreated, commentsCreated, repliesCreated, likesCreated, followsCreated, trendingComments, errors };
  }
  const recentComments = await prisma.comment.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      parentId: null,
      replies: { none: { isAiGenerated: true } },
    },
    include: {
      post: {
        select: {
          content: true,
          aiCharacterId: true,
          aiCharacter: { select: { id: true, name: true, personality: true } },
        },
      },
      aiCharacter: { select: { id: true, name: true, personality: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  for (const char of activeChars) {
    if (repliesCreated >= MICRO_MAX_REPLIES || !hasTime()) break;

    // 자기 포스트에 달린 다른 AI 댓글에 답글 (60%)
    const aiCommentsOnMyPosts = recentComments.filter(
      (c) =>
        c.post.aiCharacterId === char.id && // 내 포스트에
        c.aiCharacterId && c.aiCharacterId !== char.id && // 다른 AI가 댓글
        c.aiCharacter // AI 정보 존재
    );

    for (const comment of aiCommentsOnMyPosts) {
      if (repliesCreated >= MICRO_MAX_REPLIES || !hasTime()) break;
      if (Math.random() > 0.6) continue;

      try {
        const prompt = buildAiToAiReplyPrompt(
          char,
          { name: comment.aiCharacter!.name, personality: comment.aiCharacter!.personality },
          comment.post,
          comment
        );

        const content = await generateText({
          ...getAiConfig(char),
          prompt,
          maxTokens: 80,
        });

        if (!content) continue;

        await prisma.$transaction([
          prisma.comment.create({
            data: {
              content,
              postId: comment.postId,
              parentId: comment.id,
              aiCharacterId: char.id,
              isAiGenerated: true,
              createdAt: new Date(Date.now() + randomDelayMs()),
            },
          }),
          prisma.post.update({
            where: { id: comment.postId },
            data: {
              commentCount: { increment: 1 },
              engagementScore: { increment: 1 },
            },
          }),
        ]);

        repliesCreated++;
      } catch (err) {
        errors.push(`AiReply(${char.name}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 내 포스트에 달린 유저 댓글에 답글 (80% — 유저 참여에 적극 응답)
    const userCommentsOnMyPosts = recentComments.filter(
      (c) =>
        c.post.aiCharacterId === char.id && // 내 포스트에
        !c.aiCharacterId && // AI가 아닌 유저가 단 댓글
        c.authorId // 유저 확인
    );

    for (const comment of userCommentsOnMyPosts) {
      if (repliesCreated >= MICRO_MAX_REPLIES || !hasTime()) break;
      if (Math.random() > 0.8) continue;

      try {
        const prompt = buildReplyPrompt(char, comment.post, comment);
        const content = await generateText({
          ...getAiConfig(char),
          prompt,
          maxTokens: 80,
        });

        if (!content) continue;

        await prisma.$transaction([
          prisma.comment.create({
            data: {
              content,
              postId: comment.postId,
              parentId: comment.id,
              aiCharacterId: char.id,
              isAiGenerated: true,
              createdAt: new Date(Date.now() + randomDelayMs()),
            },
          }),
          prisma.post.update({
            where: { id: comment.postId },
            data: {
              commentCount: { increment: 1 },
              engagementScore: { increment: 1 },
            },
          }),
        ]);

        // 유저에게 답글 알림
        if (comment.authorId) {
          await createNotification({
            type: "ai_comment",
            content: `AI ${char.name}이(가) 회원님의 댓글에 답글을 남겼습니다.`,
            userId: comment.authorId,
            aiActorId: char.id,
            postId: comment.postId,
          });
        }

        repliesCreated++;
      } catch (err) {
        errors.push(`UserReply(${char.name}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 일반 답글 (50%)
    const eligibleComments = recentComments.filter(
      (c) => c.aiCharacterId !== char.id && c.post.aiCharacterId !== char.id
    );

    for (const comment of eligibleComments) {
      if (repliesCreated >= MICRO_MAX_REPLIES || !hasTime()) break;
      if (Math.random() > 0.5) continue;

      try {
        const prompt = buildReplyPrompt(char, comment.post, comment);
        const content = await generateText({
          ...getAiConfig(char),
          prompt,
          maxTokens: 80,
        });

        if (!content) continue;

        await prisma.$transaction([
          prisma.comment.create({
            data: {
              content,
              postId: comment.postId,
              parentId: comment.id,
              aiCharacterId: char.id,
              isAiGenerated: true,
              createdAt: new Date(Date.now() + randomDelayMs()),
            },
          }),
          prisma.post.update({
            where: { id: comment.postId },
            data: {
              commentCount: { increment: 1 },
              engagementScore: { increment: 1 },
            },
          }),
        ]);

        repliesCreated++;
      } catch (err) {
        errors.push(`Reply(${char.name}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ─── Phase 3: Likes (85%, 캐릭터당 2~5개) ──────────
  for (const char of activeChars) {
    if (likesCreated >= MICRO_MAX_LIKES || !hasTime()) break;

    const likeCount = 2 + Math.floor(Math.random() * 4); // 2~5개
    const eligiblePosts = recentPosts.filter((p) => p.aiCharacterId !== char.id);
    const shuffled = eligiblePosts.sort(() => Math.random() - 0.5);

    for (const post of shuffled.slice(0, likeCount)) {
      if (likesCreated >= MICRO_MAX_LIKES) break;
      if (Math.random() > 0.85) continue;

      try {
        const existing = await prisma.like.findUnique({
          where: { aiCharacterId_postId: { aiCharacterId: char.id, postId: post.id } },
        });
        if (existing) continue;

        await prisma.$transaction([
          prisma.like.create({
            data: { aiCharacterId: char.id, postId: post.id },
          }),
          prisma.post.update({
            where: { id: post.id },
            data: {
              likeCount: { increment: 1 },
              engagementScore: { increment: 1 },
            },
          }),
        ]);

        likesCreated++;
      } catch {
        // Skip duplicate likes
      }
    }
  }

  // ─── Phase 4: Trending Response ────────────────────
  if (!hasTime()) {
    return { mode: "micro", hour, hourlyWeight, postsCreated, commentsCreated, repliesCreated, likesCreated, followsCreated, trendingComments, errors };
  }
  const trendingPosts = await prisma.post.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      engagementScore: { gt: 10 },
    },
    include: {
      comments: { select: { content: true, aiCharacterId: true } },
      aiCharacter: { select: { id: true, name: true, personality: true } },
    },
    orderBy: { engagementScore: "desc" },
    take: 5,
  });

  for (const post of trendingPosts) {
    if (trendingComments >= MICRO_MAX_TRENDING_COMMENTS || !hasTime()) break;

    // 아직 댓글 안 단 AI 찾기
    const commentedAiIds = new Set(
      post.comments.map((c) => c.aiCharacterId).filter(Boolean)
    );
    const uncommentedChars = activeChars.filter(
      (c) => !commentedAiIds.has(c.id) && c.id !== post.aiCharacterId
    );

    if (uncommentedChars.length === 0) continue;

    const char = uncommentedChars[Math.floor(Math.random() * uncommentedChars.length)];

    try {
      const isAiPost = !!post.aiCharacterId && post.aiCharacter;
      const prompt = isAiPost
        ? buildAiToAiCommentPrompt(
            char,
            { name: post.aiCharacter!.name, personality: post.aiCharacter!.personality },
            post,
            post.comments
          )
        : buildCommentPrompt(char, post, post.comments);

      const content = await generateText({
        ...getAiConfig(char),
        prompt,
        maxTokens: 100,
      });

      if (!content) continue;

      // 댓글 + 좋아요 동시
      await prisma.$transaction([
        prisma.comment.create({
          data: {
            content,
            postId: post.id,
            aiCharacterId: char.id,
            isAiGenerated: true,
            createdAt: new Date(Date.now() + randomDelayMs()),
          },
        }),
        prisma.post.update({
          where: { id: post.id },
          data: {
            commentCount: { increment: 1 },
            likeCount: { increment: 1 },
            engagementScore: { increment: 3 },
          },
        }),
      ]);

      // 좋아요도 생성 (중복 무시)
      try {
        await prisma.like.create({
          data: { aiCharacterId: char.id, postId: post.id },
        });
      } catch {
        // duplicate like, OK
      }

      if (post.authorId) {
        await createNotification({
          type: "ai_comment",
          content: `AI ${char.name}이(가) 인기 게시글에 댓글을 남겼습니다.`,
          userId: post.authorId,
          aiActorId: char.id,
          postId: post.id,
        });
      }

      trendingComments++;
    } catch (err) {
      errors.push(`Trending(${char.name}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ─── Phase 5: AI-to-AI Follow (15% 확률) ──────────
  if (Math.random() < 0.15) {
    for (const char of activeChars) {
      if (followsCreated >= MICRO_MAX_FOLLOWS) break;

      const strategy = Math.random();

      if (strategy < 0.6) {
        // 전략1: 자기 포스트에 댓글 단 유저 팔로우
        const commentersOnMyPosts = await prisma.comment.findMany({
          where: {
            post: { aiCharacterId: char.id },
            authorId: { not: null },
          },
          select: { authorId: true },
          distinct: ["authorId"],
          take: 5,
        });

        for (const c of commentersOnMyPosts) {
          if (followsCreated >= MICRO_MAX_FOLLOWS) break;
          if (!c.authorId) continue;

          try {
            const existing = await prisma.follow.findFirst({
              where: { followerAiId: char.id, followingId: c.authorId },
            });
            if (existing) continue;

            await prisma.follow.create({
              data: { followerAiId: char.id, followingId: c.authorId },
            });

            await createNotification({
              type: "follow",
              content: `AI ${char.name}이(가) 회원님을 팔로우합니다.`,
              userId: c.authorId,
              aiActorId: char.id,
            });

            followsCreated++;
          } catch {
            // duplicate follow
          }
        }
      } else {
        // 전략2: 다른 AI 캐릭터 팔로우
        const otherAis = characters.filter((c) => c.id !== char.id);
        const target = otherAis[Math.floor(Math.random() * otherAis.length)];
        if (!target) continue;

        try {
          const existing = await prisma.follow.findFirst({
            where: { followerAiId: char.id, followingAiId: target.id },
          });
          if (existing) continue;

          await prisma.follow.create({
            data: { followerAiId: char.id, followingAiId: target.id },
          });

          followsCreated++;
        } catch {
          // duplicate follow
        }
      }
    }
  }

  return {
    mode: "micro",
    hour,
    hourlyWeight,
    postsCreated,
    commentsCreated,
    repliesCreated,
    likesCreated,
    followsCreated,
    trendingComments,
    errors,
  };
}
