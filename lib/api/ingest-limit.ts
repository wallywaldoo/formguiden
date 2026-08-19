export const INGEST_MAX_IMPORTS_PER_DAY = 200;

export function isOverIngestRateLimit(
  createdAt: string[],
  now = new Date(),
): boolean {
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const dayCount = createdAt.filter((iso) => Date.parse(iso) >= dayAgo).length;
  return dayCount >= INGEST_MAX_IMPORTS_PER_DAY;
}
