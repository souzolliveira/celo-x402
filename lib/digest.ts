/** Ceiling the form can set for posts read from the previous Brasília day. The known total reserves this many follow-ups. */
export const POST_LIMIT_DEFAULT = 3;
export const POST_LIMIT_MAX = 12;
export const DIGEST_TIME_ZONE = "America/Sao_Paulo";

export function clampPostLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") return POST_LIMIT_DEFAULT;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) return POST_LIMIT_DEFAULT;
  return Math.min(POST_LIMIT_MAX, Math.max(0, parsed));
}

export function previousCalendarDay(now = new Date()): string {
  const today = calendarDay(now);
  const [year, month, day] = today.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

export function calendarDay(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DIGEST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export const DIGEST_SOURCES = [
  "instagram",
  "x",
  "linkedin-person",
  "linkedin-company",
  "youtube",
] as const;

export type DigestSource = (typeof DIGEST_SOURCES)[number];

const sourceSet = new Set<string>(DIGEST_SOURCES);

export type DigestItemInput = {
  source: DigestSource;
  value: string;
  comments: boolean;
  captions: boolean;
  summarize: boolean;
  postLimit: number;
};

export function parseDigestItem(input: unknown): DigestItemInput | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (typeof record.source !== "string" || !sourceSet.has(record.source)) return null;
  if (typeof record.value !== "string") return null;
  const value = normalizeDigestValue(record.value);
  if (!value || value.length > 512) return null;
  return {
    source: record.source as DigestSource,
    value,
    comments: record.comments === true,
    captions: record.captions === true,
    summarize: record.comments === true && record.summarize === true,
    postLimit: clampPostLimit(record.postLimit),
  };
}

export function normalizeDigestValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("@") && !trimmed.includes("/")) return trimmed.slice(1);
  return trimmed;
}
