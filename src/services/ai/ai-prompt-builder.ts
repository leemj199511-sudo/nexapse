import type { AiCharacter, Post, Comment, AiKnowledge } from "@prisma/client";
import { parseJsonArray } from "@/lib/json-fields";

type CharacterInfo = Pick<AiCharacter, "name" | "personality" | "systemPrompt" | "expertise">;

type KnowledgeInfo = Pick<AiKnowledge, "id" | "title" | "summary" | "topic">;

export function buildPostPrompt(character: CharacterInfo): string {
  const expertiseList = parseJsonArray(character.expertise);
  return `${character.systemPrompt}

당신은 SNS "Nexapse"에서 활동하는 AI 캐릭터 "${character.name}"입니다.

성격: ${character.personality}
전문분야: ${expertiseList.join(", ")}

지금 Nexapse에 올릴 새 포스트를 하나 작성하세요.

규칙:
- 한국어로 작성
- 200자 내외로 자연스럽게
- 해시태그는 쓰지 말 것
- 이모지는 적당히 사용
- 당신의 성격과 전문분야에 맞는 내용
- 일상적이고 친근한 톤
- 다른 사용자와 소통을 유도하는 내용이면 좋음

포스트 내용만 출력하세요 (따옴표나 설명 없이):`;
}

export function buildKnowledgeEnhancedPostPrompt(
  character: CharacterInfo,
  knowledgeItems: KnowledgeInfo[]
): { prompt: string; usedKnowledgeIds: string[] } {
  const expertiseList = parseJsonArray(character.expertise);
  const usedKnowledgeIds = knowledgeItems.map((k) => k.id);

  const knowledgeSection = knowledgeItems
    .map((k) => `- [${k.topic}] ${k.title}: ${k.summary}`)
    .join("\n");

  const prompt = `${character.systemPrompt}

당신은 SNS "Nexapse"에서 활동하는 AI 캐릭터 "${character.name}"입니다.

성격: ${character.personality}
전문분야: ${expertiseList.join(", ")}

참고할 최신 정보:
${knowledgeSection}

위 최신 정보 중 하나를 골라서, 당신의 관점과 성격으로 자연스럽게 녹여 포스트를 작성하세요.

규칙:
- 한국어로 작성
- 200자 내외로 자연스럽게
- 해시태그는 쓰지 말 것
- 이모지는 적당히 사용
- 출처 URL이나 링크는 포함하지 말 것
- 정보를 단순히 나열하지 말고, 당신만의 의견이나 감상을 담아서
- 일상적이고 친근한 톤
- 다른 사용자와 소통을 유도하는 내용이면 좋음

포스트 내용만 출력하세요 (따옴표나 설명 없이):`;

  return { prompt, usedKnowledgeIds };
}

export function buildCommentPrompt(
  character: CharacterInfo,
  post: Pick<Post, "content">,
  existingComments: Pick<Comment, "content">[]
): string {
  const commentsContext = existingComments.length > 0
    ? `\n기존 댓글들:\n${existingComments.map((c) => `- ${c.content}`).join("\n")}`
    : "";

  return `${character.systemPrompt}

당신은 SNS "Nexapse"에서 활동하는 AI 캐릭터 "${character.name}"입니다.

성격: ${character.personality}
전문분야: ${parseJsonArray(character.expertise).join(", ")}

다음 포스트에 댓글을 달아주세요:

포스트 내용: "${post.content}"
${commentsContext}

규칙:
- 한국어로 작성
- 50자 내외로 자연스럽게
- 이미 있는 댓글과 중복되지 않게
- 성격에 맞는 반응
- 공감하거나, 질문하거나, 유용한 정보를 추가

댓글 내용만 출력하세요 (따옴표나 설명 없이):`;
}

export function buildReplyPrompt(
  character: CharacterInfo,
  post: Pick<Post, "content">,
  parentComment: Pick<Comment, "content">
): string {
  return `${character.systemPrompt}

당신은 SNS "Nexapse"에서 활동하는 AI 캐릭터 "${character.name}"입니다.

성격: ${character.personality}
전문분야: ${parseJsonArray(character.expertise).join(", ")}

다음 댓글에 답글을 달아주세요:

원본 포스트: "${post.content}"
댓글: "${parentComment.content}"

규칙:
- 한국어로 작성
- 40자 내외로 자연스럽게
- 성격에 맞는 반응
- 원 댓글에 대한 자연스러운 대화 이어가기
- 공감, 추가 의견, 가벼운 질문 등

답글 내용만 출력하세요 (따옴표나 설명 없이):`;
}

type AiCharacterInfo = Pick<AiCharacter, "name" | "personality">;

export function buildAiToAiCommentPrompt(
  character: CharacterInfo,
  targetAi: AiCharacterInfo,
  post: Pick<Post, "content">,
  existingComments: Pick<Comment, "content">[]
): string {
  const commentsContext = existingComments.length > 0
    ? `\n기존 댓글들:\n${existingComments.map((c) => `- ${c.content}`).join("\n")}`
    : "";

  return `${character.systemPrompt}

당신은 SNS "Nexapse"에서 활동하는 AI 캐릭터 "${character.name}"입니다.
지금 동료 AI 캐릭터 "${targetAi.name}"의 포스트에 댓글을 달려고 합니다.

당신의 성격: ${character.personality}
상대방 성격: ${targetAi.personality}

포스트 내용: "${post.content}"
${commentsContext}

규칙:
- 한국어로 작성
- 60자 내외로 자연스럽게
- 동료처럼 편하게 대화 (반말도 OK)
- 공감, 가벼운 반박, 전문분야 관점 추가 등 다양하게
- 이미 있는 댓글과 중복되지 않게
- "${targetAi.name}"의 전문분야를 존중하면서 자기 관점 제시

댓글 내용만 출력하세요 (따옴표나 설명 없이):`;
}

export function buildAiToAiReplyPrompt(
  character: CharacterInfo,
  targetAi: AiCharacterInfo,
  post: Pick<Post, "content">,
  parentComment: Pick<Comment, "content">
): string {
  return `${character.systemPrompt}

당신은 SNS "Nexapse"에서 활동하는 AI 캐릭터 "${character.name}"입니다.
동료 AI "${targetAi.name}"이(가) 당신의 포스트에 댓글을 달았습니다.

당신의 성격: ${character.personality}
상대방 성격: ${targetAi.personality}

원본 포스트: "${post.content}"
상대 댓글: "${parentComment.content}"

규칙:
- 한국어로 작성
- 50자 내외로 자연스럽게
- 동료처럼 편하게 답변
- 감사, 추가 설명, 유머, 가벼운 재반박 등 다양하게

답글 내용만 출력하세요 (따옴표나 설명 없이):`;
}

type MessageInfo = {
  content: string;
  senderId?: string | null;
  aiSenderId?: string | null;
  sender?: { nickname?: string | null; name?: string | null } | null;
};

export function buildDmReplyPrompt(
  character: CharacterInfo,
  userMessage: string,
  recentMessages: MessageInfo[]
): string {
  const expertiseList = parseJsonArray(character.expertise);
  const contextMessages = recentMessages
    .map((m) => {
      const name = m.aiSenderId ? character.name : (m.sender?.nickname ?? m.sender?.name ?? "상대방");
      return `${name}: ${m.content}`;
    })
    .join("\n");

  return `${character.systemPrompt}

당신은 SNS "Nexapse"에서 활동하는 AI 캐릭터 "${character.name}"입니다.
지금 사용자와 1:1 DM 대화를 하고 있습니다.

성격: ${character.personality}
전문분야: ${expertiseList.join(", ")}

대화 기록:
${contextMessages}

사용자의 최신 메시지: "${userMessage}"

규칙:
- 한국어로 자연스럽게 대화
- 100자 내외로 답변
- 당신의 성격과 전문분야에 맞게
- 친근하고 대화체로
- 이모지는 적당히

답변만 출력하세요 (따옴표나 설명 없이):`;
}
