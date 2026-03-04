import { prisma } from "@/lib/prisma";
import { generateText } from "./ai-engine";
import { cleanupKnowledge } from "./ai-knowledge-service";
import { parseJsonArray } from "@/lib/json-fields";
import { decrypt } from "@/lib/encryption";
import type { AiCharacter } from "@prisma/client";

const GATHER_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6시간
const KNOWLEDGE_EXPIRY_DAYS = 7;
const SEARCH_RESULTS_LIMIT = 3;

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

/**
 * Brave Search API로 웹 검색
 */
async function searchWeb(query: string): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    console.warn("[ai-web-gatherer] BRAVE_SEARCH_API_KEY not set");
    return [];
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${SEARCH_RESULTS_LIMIT}&search_lang=ko`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) {
    console.error(`[ai-web-gatherer] Brave Search error: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const results: BraveSearchResult[] = (data.web?.results ?? [])
    .slice(0, SEARCH_RESULTS_LIMIT)
    .map((r: { title: string; url: string; description: string }) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }));

  return results;
}

/**
 * AI에게 검색어 생성 요청
 */
async function generateSearchQueries(
  character: AiCharacter
): Promise<string[]> {
  const expertise = parseJsonArray(character.expertise);
  const prompt = `당신은 "${character.name}"이며 전문분야는: ${expertise.join(", ")}

당신의 전문분야와 관련된 최신 트렌드나 뉴스를 검색하기 위한 한국어 검색어를 2개 생성하세요.
각 검색어는 구체적이고 최신 정보를 찾을 수 있는 것이어야 합니다.

형식: 한 줄에 하나씩, 검색어만 출력 (번호나 설명 없이)`;

  const result = await generateText({
    provider: character.aiProvider as "claude" | "gemini" | "openai" | "custom",
    apiKey: character.apiKeyEncrypted ? decrypt(character.apiKeyEncrypted) : null,
    prompt,
    maxTokens: 100,
  });

  if (!result) return [];

  return result
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .slice(0, 2);
}

/**
 * 검색 결과를 AI로 요약
 */
async function summarizeResult(
  character: AiCharacter,
  searchResult: BraveSearchResult,
  topic: string
): Promise<string> {
  const prompt = `다음 검색 결과를 200~400자 한국어로 요약하세요. 핵심 정보와 트렌드를 포함해주세요.

제목: ${searchResult.title}
내용: ${searchResult.description}

요약만 출력하세요 (따옴표나 설명 없이):`;

  const summary = await generateText({
    provider: character.aiProvider as "claude" | "gemini" | "openai" | "custom",
    apiKey: character.apiKeyEncrypted ? decrypt(character.apiKeyEncrypted) : null,
    prompt,
    maxTokens: 200,
  });

  return summary || "";
}

/**
 * 캐릭터의 웹 지식 수집 (전체 흐름)
 */
export async function gatherWebKnowledge(
  character: AiCharacter
): Promise<number> {
  // 1. 마지막 수집 후 6시간 경과 체크
  if (character.lastGatherAt) {
    const elapsed = Date.now() - character.lastGatherAt.getTime();
    if (elapsed < GATHER_INTERVAL_MS) return 0;
  }

  let gathered = 0;
  const expertise = parseJsonArray(character.expertise);

  try {
    // 2. AI에게 검색어 생성 요청
    const queries = await generateSearchQueries(character);
    if (queries.length === 0) return 0;

    // 3. 각 검색어로 Brave Search 실행
    for (const query of queries) {
      const results = await searchWeb(query);

      // 4. 각 결과를 AI로 요약 → DB에 저장
      for (const result of results) {
        const topic = expertise[0] || "general";
        const summary = await summarizeResult(character, result, topic);
        if (!summary) continue;

        const expiresAt = new Date(
          Date.now() + KNOWLEDGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
        );

        await prisma.aiKnowledge.create({
          data: {
            aiCharacterId: character.id,
            sourceUrl: result.url,
            title: result.title,
            summary,
            topic,
            relevanceScore: 0.7,
            expiresAt,
          },
        });

        gathered++;
      }
    }

    // 5. lastGatherAt 업데이트
    await prisma.aiCharacter.update({
      where: { id: character.id },
      data: { lastGatherAt: new Date() },
    });

    // 6. 만료/초과 데이터 정리
    await cleanupKnowledge(character.id);
  } catch (err) {
    console.error(
      `[ai-web-gatherer] Error for ${character.name}:`,
      err instanceof Error ? err.message : err
    );
  }

  return gathered;
}
