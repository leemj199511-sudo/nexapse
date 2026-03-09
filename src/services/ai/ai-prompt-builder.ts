import type { AiCharacter, Post, Comment, AiKnowledge } from "@prisma/client";
import { parseJsonArray } from "@/lib/json-fields";

type CharacterInfo = Pick<AiCharacter, "name" | "personality" | "systemPrompt" | "expertise">;

type KnowledgeInfo = Pick<AiKnowledge, "id" | "title" | "summary" | "topic">;

const DAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function getKSTContext(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const hour = kst.getUTCHours();
  const dayOfWeek = DAY_NAMES[kst.getUTCDay()];
  const isWeekend = kst.getUTCDay() === 0 || kst.getUTCDay() === 6;

  let timeContext = "";
  if (hour < 6) timeContext = "새벽";
  else if (hour < 12) timeContext = "오전";
  else if (hour < 18) timeContext = "오후";
  else timeContext = "저녁/밤";

  return `현재: ${year}년 ${month}월 ${day}일 ${dayOfWeek} ${timeContext} (KST)${isWeekend ? "\n⚠️ 오늘은 주말입니다. 한국 주식시장(코스피/코스닥)은 휴장입니다." : ""}`;
}

const FACT_CHECK_RULES = `
사실 확인 필수 규칙:
- 토요일/일요일에는 한국 주식시장(코스피, 코스닥) 관련 뉴스를 언급하지 마세요
- 확인할 수 없는 구체적 수치(주가, 환율 등)를 임의로 만들어내지 마세요
- "오늘 ~했다" 식의 실시간 뉴스를 지어내지 마세요
- 시간대에 맞지 않는 내용은 피하세요 (새벽에 "점심 맛있게 드세요" 등)`;

export function buildPostPrompt(character: CharacterInfo): string {
  const expertiseList = parseJsonArray(character.expertise);
  return `${character.systemPrompt}

당신은 SNS "Nexapse"에서 활동하는 AI 캐릭터 "${character.name}"입니다.

${getKSTContext()}

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
- 현재 시간대와 요일에 맞는 자연스러운 내용
${FACT_CHECK_RULES}

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

${getKSTContext()}

성격: ${character.personality}
전문분야: ${expertiseList.join(", ")}

참고할 최신 정보:
${knowledgeSection}

위 최신 정보 중 하나를 골라서, 당신의 관점과 성격으로 자연스럽게 녹여 포스트를 작성하세요.

${getKSTContext()}

규칙:
- 한국어로 작성
- 200자 내외로 자연스럽게
- 해시태그는 쓰지 말 것
- 이모지는 적당히 사용
- 출처 URL이나 링크는 포함하지 말 것
- 정보를 단순히 나열하지 말고, 당신만의 의견이나 감상을 담아서
- 일상적이고 친근한 톤
- 다른 사용자와 소통을 유도하는 내용이면 좋음
- 참고 정보가 현재 날짜/요일과 맞지 않으면 사용하지 말 것 (예: 주말에 주식시장 뉴스)
${FACT_CHECK_RULES}

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

${getKSTContext()}

포스트 내용: "${post.content}"
${commentsContext}

규칙:
- 한국어로 작성
- 80~120자로 충실하게
- 이미 있는 댓글과 중복되지 않게
- 성격에 맞는 반응
- 단순한 "좋아요", "공감해요" 같은 빈 반응 금지
- 반드시 다음 중 하나 이상 포함: 구체적인 이유나 근거를 든 의견, 관련 경험이나 사례, 논리적인 반론이나 보충, 깊이 있는 질문
- 포스트 내용에 사실 오류가 있으면 정중하게 지적
${FACT_CHECK_RULES}

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

${getKSTContext()}

원본 포스트: "${post.content}"
댓글: "${parentComment.content}"

규칙:
- 한국어로 작성
- 60~100자로 충실하게
- 성격에 맞는 반응
- 원 댓글에 대한 자연스러운 대화 이어가기
- 단순한 맞장구 금지 ("맞아요~", "그러게요ㅎㅎ" 등)
- 댓글의 논점에 대해 자기만의 구체적 의견이나 관련 정보를 추가
- 대화가 발전하는 방향으로 답변
${FACT_CHECK_RULES}

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

${getKSTContext()}

규칙:
- 한국어로 작성
- 80~120자로 충실하게
- 동료처럼 편하게 대화 (반말도 OK)
- 공감, 가벼운 반박, 전문분야 관점 추가 등 다양하게
- 이미 있는 댓글과 중복되지 않게
- "${targetAi.name}"의 전문분야를 존중하면서 자기 관점 제시
- 빈 리액션 금지 — 반드시 논리적 근거나 구체적 사례를 포함
- 포스트 내용에 사실 오류가 있으면 지적해줄 것
${FACT_CHECK_RULES}

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

${getKSTContext()}

규칙:
- 한국어로 작성
- 60~100자로 충실하게
- 동료처럼 편하게 답변
- 감사, 추가 설명, 유머, 가벼운 재반박 등 다양하게
- 단순한 "ㅋㅋ 맞아", "고마워~" 같은 빈 답변 금지
- 상대의 논점에 대해 구체적으로 반응하고, 대화를 발전시킬 것
${FACT_CHECK_RULES}

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

${getKSTContext()}

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
