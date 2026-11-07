"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { clampPostLimit, POST_LIMIT_DEFAULT, POST_LIMIT_MAX } from "@/lib/digest";

type Kind = "posts" | "search";

type Source = {
  id: string;
  label: string;
  field: string;
  placeholder: string;
  unitUsd: number;
  kind: Kind;
  defaultOn: boolean;
  note: string;
  comment?: { usd: number; per: "post" | "profile"; note: string };
  captionUsd?: number;
  resolveUsd?: number;
};

const sources: Source[] = [
  {
    id: "instagram",
    label: "Instagram posts",
    field: "Username",
    placeholder: "nike",
    unitUsd: 0.007,
    kind: "posts",
    defaultOn: true,
    note: "Sent as username to fetch user posts. Comments then use the post shortcode from that response.",
    comment: {
      usd: 0.007,
      per: "post",
      note: "Comments for each selected post from yesterday, using code_or_url.",
    },
  },
  {
    id: "x",
    label: "X posts",
    field: "Handle",
    placeholder: "nike",
    unitUsd: 0.005,
    kind: "posts",
    defaultOn: true,
    note: "Sent as screen_name. Comments then use tweet_id from that response.",
    comment: { usd: 0.005, per: "post", note: "Comments for each selected post from yesterday, using tweet_id." },
  },
  {
    id: "linkedin-person",
    label: "LinkedIn person",
    field: "Profile",
    placeholder: "satyanadella",
    unitUsd: 0.023,
    kind: "posts",
    defaultOn: false,
    note: "Sent as profile: a URL, slug, or @handle.",
    comment: {
      usd: 0.023,
      per: "profile",
      note: "This comments call takes the profile, not a post id. One call per profile.",
    },
  },
  {
    id: "linkedin-company",
    label: "LinkedIn company",
    field: "Company",
    placeholder: "microsoft",
    unitUsd: 0.023,
    kind: "posts",
    defaultOn: false,
    note: "Sent as company, the universal name. The comments call we have is for a person, so it is not offered here.",
  },
  {
    id: "youtube",
    label: "YouTube",
    field: "Channel URL or ID",
    placeholder: "https://www.youtube.com/@nike",
    unitUsd: 0.005,
    resolveUsd: 0.005,
    kind: "posts",
    defaultOn: false,
    note: "Videos need a channel_id. A URL costs one extra call to resolve it. A UC… id is sent straight through. Comments and spoken captions then use video_id for the posts selected from yesterday.",
    comment: { usd: 0.005, per: "post", note: "Comments for each selected video from yesterday, using video_id." },
    captionUsd: 0.019,
  },
];

const summaryUsd = 0.01;

type Draft = { values: string[]; comments: boolean; captions: boolean; summarize: boolean; postLimit: number };

function blank(source: Source): Draft {
  return { values: source.defaultOn ? [""] : [], comments: false, captions: false, summarize: false, postLimit: POST_LIMIT_DEFAULT };
}

function filled(values: string[]): string[] {
  return values.map((value) => value.trim().replace(/^@/, "")).filter(Boolean);
}

function isChannelId(value: string): boolean {
  return /^UC[\w-]{22}$/.test(value.trim());
}

type SavedItem = { source: string; value: string; comments: boolean; captions: boolean; summarize?: boolean; postLimit?: number };

export function CatalogBrowser() {
  const { client } = useSmartWallets();
  const wallet = client?.account?.address ?? "";
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(sources.map((source) => [source.id, blank(source)])),
  );
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading your list…");
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");

  function patch(id: string, next: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...next } }));
  }

  useEffect(() => {
    if (!wallet) return;
    const controller = new AbortController();
    setReady(false);
    void apiFetch(`/api/digest?wallet=${wallet}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("digest");
        return (await response.json()) as { items?: SavedItem[] };
      })
      .then((payload) => {
        const items = payload.items ?? [];
        if (items.length > 0) setDrafts(draftsFromItems(items));
        setStatus(items.length > 0 ? "Saved" : "Nothing saved yet");
        setReady(true);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setStatus("Could not load your list");
      });
    return () => controller.abort();
  }, [wallet]);

  useEffect(() => {
    if (!ready || !wallet) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus("Saving…");
      void apiFetch("/api/digest", {
        method: "PUT",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, items: itemsFromDrafts(drafts) }),
      })
        .then((response) => {
          if (controller.signal.aborted) return;
          setStatus(response.ok ? "Saved" : "Could not save");
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setStatus("Could not save");
        });
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [drafts, ready, wallet]);

  async function runNow() {
    if (!wallet) return;
    setRunning(true);
    setRunMessage("");
    try {
      const response = await apiFetch("/api/digest/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const payload = (await response.json()) as { message?: string; balance?: string; required?: string };
      if (!response.ok) {
        const need = payload.required && payload.balance ? ` Need ${payload.required} USDC, you have ${payload.balance}.` : "";
        setRunMessage((payload.message ?? "The digest did not run.") + need);
        return;
      }
      setRunMessage("Queued. It keeps running if you leave this page. Open Searches and refresh to see it.");
    } catch {
      setRunMessage("The digest did not run.");
    } finally {
      setRunning(false);
    }
  }

  const totals = useMemo(() => {
    let posts = 0;
    let profileComments = 0;
    let summaries = 0;
    let followUps = 0;
    for (const source of sources) {
      const part = costOf(source, drafts[source.id]);
      posts += part.posts;
      profileComments += part.profileComments;
      summaries += part.summaries;
      followUps += part.followUps;
    }
    return { posts, profileComments, summaries, followUps, known: posts + profileComments + summaries + followUps };
  }, [drafts]);

  return (
    <div className="grid gap-4">
      {sources.map((source) => {
        const draft = drafts[source.id];
        const part = costOf(source, draft);
        const block = part.posts + part.profileComments + part.summaries + part.followUps;
        return (
          <Card key={source.id} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-sans text-lg font-semibold text-foreground">
                {source.label}
              </h2>
              <p className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
                {money(source.unitUsd)} each
              </p>
            </div>
            <p id={`${source.id}-note`} className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {source.note}
            </p>
            <ul className="grid gap-4">
              {draft.values.map((value, index) => (
                <li key={`${source.id}-${index}`} className="flex items-end gap-2">
                  <label className="block min-w-0 flex-1 text-sm font-semibold text-foreground" htmlFor={`${source.id}-${index}`}>
                    {source.field} {index + 1}
                    <input
                      id={`${source.id}-${index}`}
                      value={value}
                      placeholder={source.placeholder}
                      aria-describedby={`${source.id}-note`}
                      onChange={(event) => {
                        const values = draft.values.slice();
                        values[index] = event.target.value;
                        patch(source.id, { values });
                      }}
                      className="mt-2 min-h-12 w-full rounded-2xl border border-border bg-background px-4 text-base font-normal text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                  </label>
                  <Button
                    variant="quiet"
                    onClick={() => patch(source.id, { values: draft.values.filter((_, item) => item !== index) })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <Button variant="secondary" onClick={() => patch(source.id, { values: [...draft.values, ""] })}>
              Add {source.field.toLowerCase()}
            </Button>
            {source.kind === "posts" ? (
              <label htmlFor={`${source.id}-limit`} className="grid max-w-prose justify-items-start gap-2 text-sm font-semibold text-foreground">
                <span>Posts from yesterday</span>
                <input
                  id={`${source.id}-limit`}
                  type="number"
                  min={0}
                  max={POST_LIMIT_MAX}
                  step={1}
                  inputMode="numeric"
                  value={draft.postLimit}
                  onChange={(event) => {
                    if (event.target.value === "") {
                      patch(source.id, { postLimit: 0 });
                      return;
                    }
                    const parsed = Number(event.target.value);
                    if (Number.isInteger(parsed)) patch(source.id, { postLimit: clampPostLimit(parsed) });
                  }}
                  className="min-h-12 w-28 rounded-2xl border border-border bg-background px-4 text-base font-normal text-foreground outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
                <span className="font-normal leading-relaxed text-muted-foreground">
                  Up to this many posts from the previous day in Brasília. The page is still fetched once. Comments and spoken captions follow only those posts.
                </span>
              </label>
            ) : null}
            {source.comment ? (
              <label
                htmlFor={`${source.id}-comments`}
                className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-3"
              >
                <input
                  id={`${source.id}-comments`}
                  type="checkbox"
                  checked={draft.comments}
                  onChange={(event) => {
                    const comments = event.target.checked;
                    patch(source.id, comments ? { comments } : { comments, summarize: false });
                  }}
                  className="mt-0.5 size-6 shrink-0 accent-accent"
                />
                <span className="text-sm leading-relaxed text-foreground">
                  <span className="block font-semibold">Comments</span>
                  <span className="mt-1 block text-muted-foreground">{source.comment.note}</span>
                </span>
              </label>
            ) : null}
            {source.captionUsd ? (
              <label
                htmlFor={`${source.id}-captions`}
                className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-3"
              >
                <input
                  id={`${source.id}-captions`}
                  type="checkbox"
                  checked={draft.captions}
                  onChange={(event) => patch(source.id, { captions: event.target.checked })}
                  className="mt-0.5 size-6 shrink-0 accent-accent"
                />
                <span className="text-sm leading-relaxed text-foreground">
                  <span className="block font-semibold">Captions</span>
                  <span className="mt-1 block text-muted-foreground">
                    Spoken text for each selected video from yesterday, using video_id. When Summary is on, that text joins the brief. {money(source.captionUsd)} each.
                  </span>
                </span>
              </label>
            ) : null}
            {source.comment ? (
              <label
                htmlFor={`${source.id}-summary`}
                className={`flex min-h-12 items-start gap-3 rounded-2xl border border-border bg-background p-3 ${draft.comments ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
              >
                <input
                  id={`${source.id}-summary`}
                  type="checkbox"
                  checked={draft.comments && draft.summarize}
                  disabled={!draft.comments}
                  onChange={(event) => patch(source.id, { summarize: event.target.checked })}
                  className="mt-0.5 size-6 shrink-0 accent-accent disabled:cursor-not-allowed"
                />
                <span className="text-sm leading-relaxed text-foreground">
                  <span className="block font-semibold">Summary</span>
                  <span className="mt-1 block text-muted-foreground">
                    {draft.comments ? summaryNote(source) : "Turn Comments on to write a brief after those comments are read."}
                  </span>
                </span>
              </label>
            ) : null}
            <div aria-live="polite" className="rounded-2xl bg-muted px-4 py-3">
              <p className="text-sm font-semibold text-foreground">This block, {money(block)} known</p>
              <dl className="mt-2 grid gap-1 text-sm text-muted-foreground">
                <div className="flex justify-between gap-4">
                  <dt>Posts</dt>
                  <dd className="font-medium text-foreground">{money(part.posts)}</dd>
                </div>
                {source.comment?.per === "profile" ? (
                  <div className="flex justify-between gap-4">
                    <dt>Comments</dt>
                    <dd className="font-medium text-foreground">{money(part.profileComments)}</dd>
                  </div>
                ) : null}
                {draft.summarize ? (
                  <div className="flex justify-between gap-4">
                    <dt>Summaries</dt>
                    <dd className="font-medium text-foreground">{money(part.summaries)}</dd>
                  </div>
                ) : null}
                {part.followUps > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt>Up to {draft.postLimit} from yesterday</dt>
                    <dd className="font-medium text-foreground">{money(part.followUps)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </Card>
        );
      })}
      <Card className="space-y-4">
        <h2 className="font-sans text-lg font-semibold text-foreground">Total per digest</h2>
        <div aria-live="polite" className="rounded-2xl bg-muted px-4 py-3">
          <dl className="grid gap-2 text-sm text-foreground">
            <div className="flex justify-between gap-4">
              <dt>Posts</dt>
              <dd className="font-medium">{money(totals.posts)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Profile comments</dt>
              <dd className="font-medium">{money(totals.profileComments)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Summaries</dt>
              <dd className="font-medium">{money(totals.summaries)}</dd>
            </div>
            {totals.followUps > 0 ? (
              <div className="flex justify-between gap-4">
                <dt>Yesterday's posts</dt>
                <dd className="font-medium">{money(totals.followUps)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold">
              <dt>Known total</dt>
              <dd>{money(totals.known)}</dd>
            </div>
          </dl>
        </div>
        <Button disabled={!ready || !wallet || running} onClick={() => void runNow()}>
          {running ? "Running digest…" : "Run now"}
        </Button>
        {runMessage ? (
          <p className="whitespace-pre-wrap text-sm text-foreground" role="status">
            {runMessage}
          </p>
        ) : null}
        <p className="text-sm font-semibold text-foreground" role="status">
          {status}
        </p>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Known total is the most this run can spend. Each profile page is fetched once. Comments, spoken captions, and briefs then cover at most the number you set, and only posts from the previous day in Brasília. A brief is charged only when comments are on. A quieter day spends less.
        </p>
      </Card>
    </div>
  );
}

function costOf(source: Source, draft: Draft): { posts: number; profileComments: number; summaries: number; followUps: number } {
  const values = filled(draft.values);
  let posts = 0;
  for (const value of values) {
    const resolve = source.resolveUsd && !isChannelId(value) ? source.resolveUsd : 0;
    posts += source.unitUsd + resolve;
  }
  const reads = source.kind === "posts" ? draft.postLimit : 0;
  const profileComments =
    draft.comments && source.comment?.per === "profile" ? values.length * source.comment.usd : 0;
  let followUps = 0;
  if (draft.comments && source.comment?.per === "post") followUps += values.length * reads * source.comment.usd;
  if (draft.captions && source.captionUsd) followUps += values.length * reads * source.captionUsd;
  const profileSummaries = draft.summarize && source.comment?.per === "profile" && draft.comments ? values.length : 0;
  const followSummaries = draft.summarize && draft.comments && source.comment?.per === "post" ? values.length * reads : 0;
  const summaries = (profileSummaries + followSummaries) * summaryUsd;
  return { posts, profileComments, summaries, followUps };
}

function draftsFromItems(items: SavedItem[]): Record<string, Draft> {
  const next: Record<string, Draft> = Object.fromEntries(
    sources.map((source) => [source.id, { values: [] as string[], comments: false, captions: false, summarize: false, postLimit: POST_LIMIT_DEFAULT }]),
  );
  for (const item of items) {
    const draft = next[item.source];
    if (!draft) continue;
    draft.values.push(item.value);
    if (item.comments) draft.comments = true;
    if (item.captions) draft.captions = true;
    if (item.summarize) draft.summarize = true;
    if (item.postLimit !== undefined) draft.postLimit = clampPostLimit(item.postLimit);
  }
  return next;
}

function itemsFromDrafts(drafts: Record<string, Draft>): SavedItem[] {
  const items: SavedItem[] = [];
  for (const source of sources) {
    const draft = drafts[source.id];
    for (const value of filled(draft.values)) {
      items.push({
        source: source.id,
        value,
        comments: draft.comments,
        captions: draft.captions,
        summarize: draft.comments && draft.summarize,
        postLimit: draft.postLimit,
      });
    }
  }
  return items;
}

function summaryNote(source: Source): string {
  if (!source.comment) return "";
  if (source.id === "linkedin-person") {
    return `One brief for this profile after its comments are read. Those comments are not tied to a single post. ${money(summaryUsd)}.`;
  }
  if (source.captionUsd) {
    return `One brief for each selected video after its comments are read. Spoken captions join that brief when Captions is on. ${money(summaryUsd)} each.`;
  }
  return `One brief for each selected post after its comments are read. ${money(summaryUsd)} each.`;
}

function money(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
}
