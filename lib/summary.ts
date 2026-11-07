import { calendarDay, previousCalendarDay } from "./digest";

export const SUMMARY_CAPABILITY = "cencori.v1.chat.completions";
export const BRIEF_QUESTION = "O que a página postou e como o público reagiu?";

export type DatedPost = {
  id: string | null;
  caption: string;
  imageUrl: string | null;
  publishedAt: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
};

const POST_ID_KEYS = ["code", "shortcode", "tweet_id", "id_str", "video_id", "videoId"];
const POST_TIME_KEYS = ["taken_at_ts", "taken_at", "created_utc", "create_time", "published_at", "publishedAt", "posted_at", "postedAt", "created_at", "createdAt", "timestamp", "taken_at_date", "date"];

const TEXT_KEYS = new Set([
  "text",
  "caption",
  "title",
  "body",
  "message",
  "content",
  "comment",
  "full_text",
  "selftext",
  "desc",
  "description",
]);

const COUNT_KEYS = ["like_count", "likes", "digg_count", "comment_count", "view_count", "play_count", "score", "ups", "upvote_count"];

const MAX_LINES = 30;
const MAX_CHARS = 6000;

export function briefRequest(
  source: string,
  profile: string,
  payload: { caption: string; comments: string[]; spoken?: string },
) {
  const brief: Record<string, unknown> = {
    caption: payload.caption,
    comments: payload.comments,
    question: BRIEF_QUESTION,
  };
  if (payload.spoken !== undefined) brief.spoken = payload.spoken;
  return {
    model: "maximo-atlas-1.3",
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: "Responda em português, só com o que está no objeto. Frases curtas. Sem preâmbulo.",
      },
      {
        role: "user",
        content: `Source: ${source}\nSubject: ${profile}\n\n${JSON.stringify(brief)}`,
      },
    ],
  };
}

export function commentLines(body: unknown): string[] {
  const lines: string[] = [];
  for (const item of findCommentItems(body)) {
    const text = typeof item.text === "string" ? item.text.replace(/\s+/g, " ").trim() : "";
    if (!text) continue;
    const likes = countOf(item, ["comment_like_count", "like_count", "favorite_count"]);
    const head = [authorOf(item, 0), likes === null ? "" : String(likes)].filter(Boolean).join(" · ");
    lines.push(head ? `${head} — ${text.slice(0, 400)}` : text.slice(0, 400));
    if (lines.length >= MAX_LINES) break;
  }
  return lines;
}

export function spokenText(body: unknown): string {
  const lines: string[] = [];
  collectSpoken(body, lines, 0);
  return lines.join(" ").replace(/\s+/g, " ").trim().slice(0, 4000);
}

export function extractSource(value: unknown, kind = "comments"): string {
  if (kind === "posts") return extractCaptions(value);
  const lines: string[] = [];
  collectPosts(value, lines, 0);
  if (lines.length === 0) collectLongStrings(value, lines, 0);
  return lines.join("\n").slice(0, MAX_CHARS);
}

export function completionText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const choices = record.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const choice = choices[0] as Record<string, unknown>;
    const message = choice.message;
    if (message && typeof message === "object") {
      const text = contentToString((message as Record<string, unknown>).content);
      if (text) return text;
    }
    if (typeof choice.text === "string" && choice.text.trim()) return choice.text.trim();
  }
  for (const key of ["output", "content", "summary", "text"]) {
    const text = contentToString(record[key]);
    if (text) return text;
  }
  return null;
}

function contentToString(content: unknown): string | null {
  if (typeof content === "string" && content.trim()) return content.trim();
  if (!Array.isArray(content)) return null;
  const joined = content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
  return joined || null;
}

export function selectYesterdayPosts(body: unknown, limit: number, now = new Date()): DatedPost[] {
  if (limit <= 0) return [];
  const day = previousCalendarDay(now);
  const selected: DatedPost[] = [];
  for (const item of findPostItems(body, 100)) {
    const instant = instantOf(item);
    if (!instant || calendarDay(instant) !== day) continue;
    selected.push({
      id: idOf(item),
      caption: captionOf(item) ?? "",
      imageUrl: imageOf(item),
      publishedAt: instant.toISOString(),
      likes: countOf(item, ["like_count", "favorite_count", "digg_count"]),
      comments: countOf(item, ["comment_count", "reply_count"]),
      views: countOf(item, ["play_count", "ig_play_count", "view_count", "viewCount"]),
    });
    if (selected.length >= limit) break;
  }
  return selected;
}

function extractCaptions(value: unknown): string {
  const lines: string[] = [];
  for (const item of findPostItems(value)) {
    const caption = captionOf(item);
    if (!caption || lines.includes(caption)) continue;
    lines.push(caption);
    if (lines.length >= MAX_LINES) break;
  }
  return lines.join("\n").slice(0, MAX_CHARS);
}

function findPostItems(value: unknown, max = MAX_LINES): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  walkPostItems(value, found, 0, max);
  return found;
}

function walkPostItems(value: unknown, found: Record<string, unknown>[], depth: number, max: number) {
  if (depth > 8 || found.length >= max) return;
  if (Array.isArray(value)) {
    const posts = value.filter(isPostItem);
    if (posts.length > 0) {
      found.push(...posts);
      return;
    }
    for (const entry of value) walkPostItems(entry, found, depth + 1, max);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value as Record<string, unknown>)) walkPostItems(child, found, depth + 1, max);
}

function idOf(record: Record<string, unknown>): string | null {
  for (const key of POST_ID_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function instantOf(record: Record<string, unknown>): Date | null {
  for (const key of POST_TIME_KEYS) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      const millis = value < 1e12 ? value * 1000 : value;
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) return date;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return new Date(parsed);
    }
  }
  return null;
}

function isPostItem(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if ("caption" in record || "full_text" in record || "selftext" in record) return true;
  return "title" in record && ("video_id" in record || "videoId" in record || "description" in record);
}

function captionOf(record: Record<string, unknown>): string | null {
  const caption = record.caption;
  if (typeof caption === "string") return cleanCaption(caption);
  if (caption && typeof caption === "object" && !Array.isArray(caption)) {
    const text = (caption as Record<string, unknown>).text;
    if (typeof text === "string") return cleanCaption(text);
  }
  for (const key of ["full_text", "text", "selftext"]) {
    const value = record[key];
    if (typeof value !== "string") continue;
    const text = cleanCaption(value);
    if (text) return text;
  }
  const title = typeof record.title === "string" ? cleanCaption(record.title) : null;
  const description = typeof record.description === "string" ? cleanCaption(record.description) : null;
  if (title && description && description !== title) return `${title} — ${description}`.slice(0, 1200);
  return title ?? description;
}

function cleanCaption(value: string): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.startsWith("http")) return null;
  return text.slice(0, 1200);
}

function countOf(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function imageOf(record: Record<string, unknown>): string | null {
  const direct = httpsUrl(record.thumbnail_url) ?? httpsUrl(record.media_url_https);
  if (direct) return direct;
  const versions = record.image_versions;
  if (versions && typeof versions === "object" && !Array.isArray(versions)) {
    const items = (versions as Record<string, unknown>).items;
    const best = widest(items);
    if (best) return best;
  }
  const thumbnails = record.thumbnails;
  if (Array.isArray(thumbnails)) {
    const best = widest(thumbnails);
    if (best) return best;
  }
  if (thumbnails && typeof thumbnails === "object") {
    for (const key of ["maxres", "standard", "high", "medium", "default"]) {
      const entry = (thumbnails as Record<string, unknown>)[key];
      const url = entry && typeof entry === "object" ? httpsUrl((entry as Record<string, unknown>).url) : null;
      if (url) return url;
    }
  }
  const media = record.media;
  if (Array.isArray(media)) {
    for (const entry of media) {
      if (!entry || typeof entry !== "object") continue;
      const url = httpsUrl((entry as Record<string, unknown>).media_url_https) ?? httpsUrl((entry as Record<string, unknown>).url);
      if (url) return url;
    }
  }
  return null;
}

function widest(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  let best: string | null = null;
  let width = -1;
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const url = httpsUrl(record.url);
    if (!url) continue;
    const next = typeof record.width === "number" ? record.width : 0;
    if (next >= width) {
      width = next;
      best = url;
    }
  }
  return best;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text.startsWith("https://")) return null;
  return text;
}

function findCommentItems(value: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  walkComments(value, found, 0);
  return found;
}

function walkComments(value: unknown, found: Record<string, unknown>[], depth: number) {
  if (depth > 8 || found.length >= MAX_LINES) return;
  if (Array.isArray(value)) {
    const comments = value.filter(isCommentItem);
    if (comments.length > 0) {
      found.push(...comments);
      return;
    }
    for (const entry of value) walkComments(entry, found, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value as Record<string, unknown>)) walkComments(child, found, depth + 1);
}

function isCommentItem(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.text !== "string" || !record.text.trim()) return false;
  if (record.caption && typeof record.caption === "object") return false;
  return "user" in record || "comment_like_count" in record || "comment_index" in record || "author" in record;
}

function collectSpoken(value: unknown, lines: string[], depth: number) {
  if (depth > 8 || lines.length >= 80) return;
  if (Array.isArray(value)) {
    const cues = value.filter(isCue);
    if (cues.length > 0) {
      for (const cue of cues) {
        const text = cueText(cue);
        if (text) lines.push(text);
        if (lines.length >= 80) return;
      }
      return;
    }
    for (const entry of value) collectSpoken(entry, lines, depth + 1);
    return;
  }
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    if (text.length >= 40 && !text.startsWith("http")) lines.push(text.slice(0, 500));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value as Record<string, unknown>)) collectSpoken(child, lines, depth + 1);
}

function isCue(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const timed = "start" in record || "offset" in record || "tOffsetMs" in record || "startMs" in record;
  return timed && cueText(record) !== "";
}

function cueText(record: Record<string, unknown>): string {
  for (const key of ["utf8", "text", "content", "subtitle"]) {
    const value = record[key];
    if (typeof value !== "string") continue;
    const text = value.replace(/\s+/g, " ").trim();
    if (text && !text.startsWith("http")) return text.slice(0, 300);
  }
  return "";
}

function collectPosts(value: unknown, lines: string[], depth: number) {
  if (depth > 8 || lines.length >= MAX_LINES) return;
  if (Array.isArray(value)) {
    for (const entry of value) collectPosts(entry, lines, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const line = lineFrom(record);
  if (line) {
    lines.push(line);
    return;
  }
  for (const child of Object.values(record)) collectPosts(child, lines, depth + 1);
}

function collectLongStrings(value: unknown, lines: string[], depth: number) {
  if (depth > 8 || lines.length >= MAX_LINES) return;
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    if (text.length >= 40 && !text.startsWith("http")) lines.push(text.slice(0, 400));
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectLongStrings(entry, lines, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value as Record<string, unknown>)) collectLongStrings(child, lines, depth + 1);
}

function lineFrom(record: Record<string, unknown>): string | null {
  const text = firstText(record);
  if (!text) return null;
  const head = [authorOf(record, 0), dateOf(record), countsOf(record)].filter(Boolean).join(" · ");
  return head ? `${head} — ${text}` : text;
}

function firstText(record: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(record)) {
    if (!TEXT_KEYS.has(key)) continue;
    if (typeof value === "string") {
      const text = value.replace(/\s+/g, " ").trim();
      if (text.length >= 8 && !text.startsWith("http")) return text.slice(0, 400);
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = firstText(value as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return null;
}

function authorOf(record: Record<string, unknown>, depth: number): string {
  for (const key of ["username", "screen_name", "unique_id"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (depth >= 2) return "";
  for (const key of ["user", "author", "owner"]) {
    const child = record[key];
    if (child && typeof child === "object" && !Array.isArray(child)) {
      const name = authorOf(child as Record<string, unknown>, depth + 1);
      if (name) return name;
    }
  }
  return "";
}

function dateOf(record: Record<string, unknown>): string {
  for (const key of ["taken_at", "created_at", "create_time", "published_at", "timestamp", "date"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      const millis = value < 1e12 ? value * 1000 : value;
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
  }
  return "";
}

function countsOf(record: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of COUNT_KEYS) {
    const value = record[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    parts.push(`${key.replace(/_count$/, "").replaceAll("_", " ")} ${value}`);
  }
  return parts.join(", ");
}
