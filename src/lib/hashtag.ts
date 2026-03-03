// Extract hashtags from post content
// Matches #한글, #영문, #숫자 (최소 1자)
export function extractHashtags(content: string): string[] {
  const regex = /#([a-zA-Z0-9가-힣_]+)/g;
  const tags = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase());
  }
  return Array.from(tags);
}
