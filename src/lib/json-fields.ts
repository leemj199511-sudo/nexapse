// Helper to handle JSON fields (PostgreSQL Json type returns parsed values)

export function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function toJsonString(arr: string[] | undefined | null): string[] {
  return arr ?? [];
}
