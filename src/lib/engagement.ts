export function calculateEngagementScore(
  likeCount: number,
  commentCount: number,
  createdAt: Date
): number {
  const now = Date.now();
  const elapsed = now - createdAt.getTime();
  const hoursElapsed = elapsed / (1000 * 60 * 60);
  const timeDecay = 100 * Math.pow(0.5, hoursElapsed / 24);
  return likeCount * 2 + commentCount * 3 + timeDecay;
}
