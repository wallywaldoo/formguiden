import {
  AI_ESTIMATE_MAX_PER_DAY,
  AI_ESTIMATE_MAX_PER_HOUR,
} from "@/lib/ai/nutrition/types";

export function isOverAiRateLimit(
  createdAt: string[],
  now = new Date(),
): boolean {
  const hourAgo = now.getTime() - 60 * 60 * 1000;
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const hourCount = createdAt.filter(
    (iso) => Date.parse(iso) >= hourAgo,
  ).length;
  const dayCount = createdAt.filter((iso) => Date.parse(iso) >= dayAgo).length;
  return (
    hourCount >= AI_ESTIMATE_MAX_PER_HOUR || dayCount >= AI_ESTIMATE_MAX_PER_DAY
  );
}
