import { DIGEST_TIME_ZONE, previousCalendarDay, type DigestSource } from "./digest";
import { selectYesterdayPosts, type DatedPost } from "./summary";

export type EditionCall = {
  capabilityId: string;
  request: unknown;
  response?: unknown;
  httpStatus: number;
  summary?: string | null;
  at: Date | string;
};

export type EditionPlanItem = {
  source: string;
  value: string;
  comments?: boolean;
  captions?: boolean;
  summarize?: boolean;
  postLimit?: number;
};

export type EditionStory = DatedPost & {
  summary: string | null;
  note: string | null;
};

export type EditionSection = {
  source: DigestSource;
  profile: string;
  day: string;
  stories: EditionStory[];
  summary: string | null;
  note: string | null;
};

const POSTS: Record<DigestSource, string> = {
  instagram: "monid.instagram.tikhub.api-v1-instagram-v2-fetch-user-posts",
  x: "monid.x.tikhub.api-v1-twitter-web-fetch-user-post-tweet",
  "linkedin-person": "linkedin.profile.posts",
  "linkedin-company": "linkedin.company.posts",
  youtube: "monid.youtube.tikhub.api-v1-youtube-web-v2-get-channel-videos",
};

const COMMENTS: Partial<Record<DigestSource, string>> = {
  instagram: "monid.instagram.tikhub.api-v1-instagram-v2-fetch-post-comments",
  x: "monid.x.tikhub.api-v1-twitter-web-fetch-post-comments",
  "linkedin-person": "monid.linkedin.ploid.linkedin-comments",
  youtube: "monid.youtube.tikhub.api-v1-youtube-web-v2-get-video-comments",
};

const SOURCES = new Set<string>(Object.keys(POSTS));

export function editionFromCalls(plan: EditionPlanItem[], calls: EditionCall[], when: Date): EditionSection[] {
  const used = new Set<number>();
  const sections: EditionSection[] = [];
  for (const item of plan) {
    if (!SOURCES.has(item.source)) continue;
    const source = item.source as DigestSource;
    const posts = takePostsCall(source, item.value, calls, used);
    const day = previousCalendarDay(posts ? asDate(posts.at) : when);
    if (!posts) {
      sections.push({ source, profile: item.value, day, stories: [], summary: null, note: "The profile page did not load." });
      continue;
    }
    if (posts.httpStatus >= 400) {
      sections.push({ source, profile: item.value, day, stories: [], summary: null, note: "The profile page did not load." });
      continue;
    }
    const limit = typeof item.postLimit === "number" ? item.postLimit : 3;
    const selected = selectYesterdayPosts(posts.response, limit, asDate(posts.at));
    if (selected.length === 0) {
      sections.push({
        source,
        profile: item.value,
        day,
        stories: [],
        summary: null,
        note: "Nothing from the previous day in Brasília.",
      });
      continue;
    }
    if (source === "linkedin-person") {
      sections.push(linkedinSection(item, source, day, selected, calls));
      continue;
    }
    const stories = selected.map((post) => storyFromPost(item, source, post, calls));
    sections.push({ source, profile: item.value, day, stories, summary: null, note: null });
  }
  return sections;
}

function linkedinSection(
  item: EditionPlanItem,
  source: DigestSource,
  day: string,
  selected: DatedPost[],
  calls: EditionCall[],
): EditionSection {
  const stories = selected.map((post) => ({ ...post, summary: null, note: null }));
  if (!item.comments) return { source, profile: item.value, day, stories, summary: null, note: null };
  const comments = calls.find((call) => call.capabilityId === COMMENTS["linkedin-person"] && requestHas(call.request, item.value));
  if (!comments || comments.httpStatus >= 400) {
    return { source, profile: item.value, day, stories, summary: null, note: "Comments did not load, so there is no brief." };
  }
  const summary = comments.summary?.trim() || null;
  const note = item.summarize && !summary ? "The brief did not arrive." : null;
  return { source, profile: item.value, day, stories, summary, note };
}

function storyFromPost(item: EditionPlanItem, source: DigestSource, post: DatedPost, calls: EditionCall[]): EditionStory {
  const story: EditionStory = { ...post, summary: null, note: null };
  if (!item.comments) return story;
  if (!post.id) return { ...story, note: "This post has no id, so comments were not read." };
  const capability = COMMENTS[source];
  const comments = capability ? calls.find((call) => call.capabilityId === capability && requestHas(call.request, post.id ?? "")) : undefined;
  if (!comments || comments.httpStatus >= 400) return { ...story, note: "Comments did not load, so there is no brief." };
  const summary = comments.summary?.trim() || null;
  if (item.summarize && !summary) return { ...story, note: "The brief did not arrive." };
  return { ...story, summary };
}

function takePostsCall(source: DigestSource, value: string, calls: EditionCall[], used: Set<number>): EditionCall | null {
  for (let index = 0; index < calls.length; index += 1) {
    if (used.has(index)) continue;
    const call = calls[index];
    if (call.capabilityId !== POSTS[source]) continue;
    if (source !== "youtube" && !requestHas(call.request, value)) continue;
    used.add(index);
    return call;
  }
  return null;
}

function requestHas(request: unknown, value: string): boolean {
  if (!value) return false;
  return JSON.stringify(request ?? "").includes(value);
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function renderEdition(sections: EditionSection[], when: Date): string {
  const guides = [...new Set(sections.map((section) => section.source))];
  const fonts = fontLinks(guides);
  const title = formatDay(when);
  const body = sections.map(renderSection).join("\n");
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brief, ${escapeHtml(title)}</title>
${fonts}
<style>
${documentGuide()}
${guides.map(guideFor).join("\n")}
</style>
</head>
<body>
  <header class="masthead">
    <h1>Brief, ${escapeHtml(title)}</h1>
  </header>
  <main>
    ${body || `<p class="empty">This edition has no profiles.</p>`}
  </main>
</body>
</html>`;
}

function fontLinks(sources: DigestSource[]): string {
  const families: string[] = [];
  if (sources.includes("linkedin-person") || sources.includes("linkedin-company")) families.push("family=Source+Sans+3:wght@400;600;700");
  if (sources.includes("youtube")) families.push("family=Roboto:wght@400;500;700");
  if (families.length === 0) return "";
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families.join("&")}&display=swap">`;
}

function documentGuide(): string {
  return `/* Brief edition canvas. Each network below keeps its own style guide. */
:root { color-scheme: light; }
body { margin: 0; background: #f4f2ee; color: #191919; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
.masthead { max-width: 40rem; margin: 0 auto; padding: 2rem 1rem 0.5rem; }
.masthead h1 { margin: 0; font-size: 1.75rem; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; }
main { max-width: 40rem; margin: 0 auto; padding: 1rem 1rem 3rem; }
.empty { color: #536471; }
img { max-width: 100%; height: auto; }
`;
}

function guideFor(source: DigestSource): string {
  if (source === "instagram") return instagramGuide();
  if (source === "x") return xGuide();
  if (source === "youtube") return youtubeGuide();
  return linkedinGuide();
}

function instagramGuide(): string {
  return `/* Instagram style guide — feed column
   canvas #ffffff, ink #000000, secondary #737373, hairline #dbdbdb, mention #00376b
   face: Instagram Sans. Email-safe stand-in is the system UI stack.
   column 470px, caption 14/18, media edge to edge. */
.ig { --ig-canvas: #ffffff; --ig-ink: #000000; --ig-secondary: #737373; --ig-line: #dbdbdb; --ig-mention: #00376b;
  max-width: 470px; margin: 1.5rem 0; background: var(--ig-canvas); color: var(--ig-ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; border: 1px solid var(--ig-line); }
.ig h2 { margin: 0; padding: 0.85rem 1rem; font-size: 0.875rem; line-height: 1.25; font-weight: 700; }
.ig .day, .ig .meta, .ig .note { color: var(--ig-secondary); font-size: 0.75rem; line-height: 1.4; }
.ig .day { margin: -0.4rem 0 0; padding: 0 1rem 0.75rem; }
.ig .frame { display: block; width: 100%; background: #efefef; }
.ig .copy, .ig .brief, .ig .note { margin: 0; padding: 0.75rem 1rem 0; font-size: 0.875rem; line-height: 1.3; }
.ig .brief { padding-bottom: 1rem; }
.ig .note { padding-bottom: 1rem; }
.ig .meta { margin: 0; padding: 0.65rem 1rem 0; font-weight: 600; }
.ig strong { font-weight: 700; }
`;
}

function xGuide(): string {
  return `/* X style guide — timeline post
   canvas #ffffff, ink #0f1419, secondary #536471, hairline #eff3f4, accent #1d9bf0
   face: Chirp. Email-safe stand-in is Segoe UI / system UI.
   column 598px, body 15/20, media radius 16px. */
.x { --x-canvas: #ffffff; --x-ink: #0f1419; --x-secondary: #536471; --x-line: #eff3f4; --x-accent: #1d9bf0;
  max-width: 598px; margin: 1.5rem 0; background: var(--x-canvas); color: var(--x-ink);
  font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; border-bottom: 1px solid var(--x-line); }
.x h2 { margin: 0; font-size: 0.95rem; line-height: 1.25; font-weight: 700; }
.x h2 span { color: var(--x-secondary); font-weight: 400; }
.x .day, .x .meta, .x .note { color: var(--x-secondary); }
.x .story { padding: 0.75rem 1rem 1rem; }
.x .copy, .x .brief { margin: 0.5rem 0 0; font-size: 0.95rem; line-height: 1.35; }
.x .frame { display: block; width: 100%; margin-top: 0.75rem; border-radius: 16px; border: 1px solid var(--x-line); }
.x .meta, .x .note { margin: 0.75rem 0 0; font-size: 0.8rem; }
`;
}

function linkedinGuide(): string {
  return `/* LinkedIn style guide — feed update
   page #f4f2ee, canvas #ffffff, ink #191919, secondary #666666, brand #0a66c2, hairline #e8e8e8
   face: Source Sans 3. Card radius 8px, body 14/1.4, column 552px. */
.li { --li-canvas: #ffffff; --li-ink: #191919; --li-secondary: #666666; --li-brand: #0a66c2; --li-line: #e8e8e8;
  max-width: 552px; margin: 1.5rem 0; background: var(--li-canvas); color: var(--li-ink);
  font-family: "Source Sans 3", "Segoe UI", Helvetica, Arial, sans-serif; border: 1px solid var(--li-line); border-radius: 8px; overflow: hidden; }
.li h2 { margin: 0; padding: 0.9rem 1rem 0; color: var(--li-brand); font-size: 1rem; line-height: 1.25; font-weight: 600; }
.li .day { margin: 0.15rem 0 0; padding: 0 1rem; color: var(--li-secondary); font-size: 0.75rem; }
.li .brief, .li .copy, .li .note { margin: 0; padding: 0.75rem 1rem 0; font-size: 0.875rem; line-height: 1.4; }
.li .note { color: var(--li-secondary); padding-bottom: 1rem; }
.li .story { padding-bottom: 1rem; border-top: 1px solid var(--li-line); margin-top: 0.75rem; }
.li .meta { margin: 0.5rem 0 0; padding: 0 1rem; color: var(--li-secondary); font-size: 0.75rem; }
.li .frame { display: block; width: 100%; margin-top: 0.75rem; }
`;
}

function youtubeGuide(): string {
  return `/* YouTube style guide — video feed
   canvas #ffffff, ink #0f0f0f, secondary #606060, brand #ff0000
   face: Roboto. Thumbnail 16:9, radius 12px, title 16/22, column 480px. */
.yt { --yt-canvas: #ffffff; --yt-ink: #0f0f0f; --yt-secondary: #606060; --yt-brand: #ff0000;
  max-width: 480px; margin: 1.5rem 0; color: var(--yt-ink);
  font-family: Roboto, Arial, Helvetica, sans-serif; }
.yt h2 { margin: 0 0 0.75rem; font-size: 1rem; line-height: 1.25; font-weight: 700; }
.yt h2 span { color: var(--yt-brand); }
.yt .story { margin: 0 0 1.25rem; }
.yt .thumb { position: relative; display: block; aspect-ratio: 16 / 9; background: #0f0f0f; border-radius: 12px; overflow: hidden; }
.yt .frame { display: block; width: 100%; height: 100%; object-fit: cover; }
.yt .play { position: absolute; left: 0.6rem; bottom: 0.6rem; width: 0; height: 0; border-style: solid; border-width: 8px 0 8px 14px; border-color: transparent transparent transparent #ffffff; }
.yt h3 { margin: 0.6rem 0 0; font-size: 1rem; line-height: 1.35; font-weight: 500; }
.yt .meta, .yt .day, .yt .note { margin: 0.25rem 0 0; color: var(--yt-secondary); font-size: 0.875rem; line-height: 1.4; }
.yt .brief { margin: 0.6rem 0 0; font-size: 0.95rem; line-height: 1.45; }
`;
}

function renderSection(section: EditionSection): string {
  const platform = platformClass(section.source);
  const name = escapeHtml(displayName(section));
  const day = escapeHtml(formatDay(new Date(`${section.day}T15:00:00Z`)));
  const summary = section.summary ? `<p class="brief">${escapeHtml(section.summary)}</p>` : "";
  const note = section.note ? `<p class="note">${escapeHtml(section.note)}</p>` : "";
  const stories = section.stories.map((story) => renderStory(section.source, story)).join("\n");
  return `<section class="${platform}">
    <h2>${heading(section.source, name)}</h2>
    <p class="day">${day}</p>
    ${summary}
    ${note}
    ${stories}
  </section>`;
}

function renderStory(source: DigestSource, story: EditionStory): string {
  const caption = escapeHtml(story.caption);
  const summary = story.summary ? `<p class="brief">${escapeHtml(story.summary)}</p>` : "";
  const note = story.note ? `<p class="note">${escapeHtml(story.note)}</p>` : "";
  const meta = engagement(source, story);
  const metaLine = meta ? `<p class="meta">${escapeHtml(meta)}</p>` : "";
  const image = story.imageUrl ? imageTag(source, story.imageUrl, story.caption) : "";
  if (source === "youtube") {
    const title = escapeHtml(story.caption.split(" — ")[0] || story.caption || "Video");
    return `<article class="story">
      ${image}
      <h3>${title}</h3>
      ${metaLine}
      ${summary}
      ${note}
    </article>`;
  }
  if (source === "x") {
    return `<article class="story">
      <p class="copy">${caption}</p>
      ${image}
      ${metaLine}
      ${summary}
      ${note}
    </article>`;
  }
  return `<article class="story">
    ${image}
    ${metaLine}
    ${caption ? `<p class="copy">${caption}</p>` : ""}
    ${summary}
    ${note}
  </article>`;
}

function imageTag(source: DigestSource, url: string, caption: string): string {
  const alt = escapeHtml(caption.slice(0, 180) || "Post image");
  const src = escapeHtml(url);
  if (source === "youtube") {
    return `<div class="thumb"><img class="frame" src="${src}" alt="${alt}" referrerpolicy="no-referrer"><span class="play" aria-hidden="true"></span></div>`;
  }
  return `<img class="frame" src="${src}" alt="${alt}" referrerpolicy="no-referrer">`;
}

function engagement(source: DigestSource, story: EditionStory): string {
  const parts: string[] = [];
  if (story.likes !== null) parts.push(`${formatCount(story.likes)} likes`);
  if (story.comments !== null) parts.push(`${formatCount(story.comments)} comments`);
  if (story.views !== null) parts.push(`${formatCount(story.views)} ${source === "instagram" ? "plays" : "views"}`);
  return parts.join(" · ");
}

function heading(source: DigestSource, name: string): string {
  if (source === "youtube") return `<span>YouTube</span> ${name}`;
  if (source === "x") return `${name} <span>on X</span>`;
  if (source === "linkedin-person" || source === "linkedin-company") return name;
  return name;
}

function displayName(section: EditionSection): string {
  if (section.source === "instagram" || section.source === "x") return `@${section.profile.replace(/^@/, "")}`;
  return section.profile;
}

function platformClass(source: DigestSource): string {
  if (source === "instagram") return "ig";
  if (source === "x") return "x";
  if (source === "youtube") return "yt";
  return "li";
}

function formatDay(instant: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: DIGEST_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(instant);
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
