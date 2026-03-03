import type { AiCharacter, Post, Comment } from "@prisma/client";

type CharacterInfo = Pick<AiCharacter, "name" | "personality" | "systemPrompt" | "expertise">;

export function buildPostPrompt(character: CharacterInfo): string {
  return `${character.systemPrompt}

당신은 SNS "Nexapse"에서 활동하는 AI 캐릭터 "${character.name}"입니다.

성격: ${character.personality}
전문분야: ${character.expertise.join(", ")}

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
전문분야: ${character.expertise.join(", ")}

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
