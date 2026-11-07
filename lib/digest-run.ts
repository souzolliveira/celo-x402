import { AsyncLocalStorage } from "node:async_hooks";
import { runBuyCall } from "@/lib/buy-call";
import { creditBalance, formatBalance } from "@/lib/credit-balance";
import { parseUsdc } from "@/lib/usdc";
import { clampPostLimit } from "@/lib/digest";
import { editionFromCalls, renderEdition } from "@/lib/edition";
import { Digest } from "@/models/digest";
import { Research } from "@/models/research";
import { briefRequest, commentLines, completionText, selectYesterdayPosts, spokenText, SUMMARY_CAPABILITY } from "@/lib/summary";

const activeResearch = new AsyncLocalStorage<string>();

const usd = (value: string) => parseUsdc(value) ?? 0n;

const price = {
  instagramPost: usd("0.007"),
  instagramComment: usd("0.007"),
  xPost: usd("0.005"),
  xComment: usd("0.005"),
  linkedin: usd("0.023"),
  youtube: usd("0.005"),
  youtubeCaption: usd("0.019"),
  summary: usd("0.01"),
};

export type DigestCall = {
  source: string;
  value: string;
  status: number;
  amount: string | null;
  searchId: string;
  note?: string;
};

type Item = { source: string; value: string; comments?: boolean; captions?: boolean; summarize?: boolean; postLimit?: number };

export async function enqueueDigest(ownerWallet: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const wallet = ownerWallet.toLowerCase();
  const digest = await Digest.findOne({ ownerWallet: wallet }).lean();
  const items = (digest?.items ?? []) as Item[];
  if (items.length === 0) {
    return { status: 400, body: { message: "Add a profile before running a digest." } };
  }

  const required = knownCost(items);
  const balance = await creditBalance(wallet);
  if (balance < required) {
    return {
      status: 402,
      body: {
        message: "Not enough credits for this digest.",
        balance: formatBalance(balance),
        required: formatBalance(required),
      },
    };
  }

  const research = await Research.create({
    ownerWallet: wallet,
    status: "pending",
    reserved: formatBalance(required),
    plan: items,
    calls: [],
  });
  void pumpResearches();
  return { status: 202, body: { id: String(research._id), required: formatBalance(required) } };
}

const pumping = globalThis as typeof globalThis & { researchPump?: Promise<void> };

export function pumpResearches(): Promise<void> {
  pumping.researchPump ??= runPump().finally(() => {
    pumping.researchPump = undefined;
  });
  return pumping.researchPump;
}

async function runPump() {
  for (;;) {
    const next = await Research.findOneAndUpdate(
      { status: "pending" },
      { $set: { status: "running", startedAt: new Date(), updatedAt: new Date() } },
      { sort: { createdAt: 1 }, new: true },
    );
    if (!next) return;
    try {
      const items = (next.plan ?? []) as Item[];
      await activeResearch.run(String(next._id), async () => {
        for (const item of items) await runItem(next.ownerWallet, item, []);
      });
      await finishResearch(String(next._id), "done");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The digest failed.";
      await finishResearch(String(next._id), "failed", message);
    }
  }
}

const ACTIVE_SOURCES = new Set<string>(["instagram", "x", "linkedin-person", "linkedin-company", "youtube"]);

function knownCost(items: Item[]): bigint {
  let total = 0n;
  for (const item of items) {
    if (!ACTIVE_SOURCES.has(item.source)) continue;
    if (item.source === "instagram") total += price.instagramPost;
    if (item.source === "x") total += price.xPost;
    if (item.source === "linkedin-person") {
      total += price.linkedin;
      if (item.comments) total += price.linkedin;
    }
    if (item.source === "linkedin-company") total += price.linkedin;
    if (item.source === "youtube") {
      total += price.youtube;
      if (!isChannelId(item.value)) total += price.youtube;
    }
    const reads = postLimitOf(item);
    if (item.comments && perPostComment(item.source)) total += commentPrice(item.source) * BigInt(reads);
    if (item.source === "youtube" && item.captions) total += price.youtubeCaption * BigInt(reads);
    if (item.summarize && item.comments) {
      if (item.source === "linkedin-person") total += price.summary;
      if (perPostComment(item.source)) total += price.summary * BigInt(reads);
    }
  }
  return total;
}

async function finishResearch(id: string, status: "done" | "failed", error?: string) {
  const finishedAt = new Date();
  const saved = await Research.findById(id).lean();
  const editionHtml = saved
    ? renderEdition(editionFromCalls((saved.plan ?? []) as Item[], saved.calls ?? [], saved.startedAt ?? finishedAt), saved.startedAt ?? finishedAt)
    : "";
  await Research.updateOne(
    { _id: id },
    { $set: { status, finishedAt, updatedAt: finishedAt, editionHtml, ...(error ? { error } : {}) } },
  );
}

function postLimitOf(item: Item): number {
  return clampPostLimit(item.postLimit);
}

function perPostComment(source: string): boolean {
  return source === "instagram" || source === "x" || source === "youtube";
}

function commentPrice(source: string): bigint {
  if (source === "x") return price.xComment;
  if (source === "youtube") return price.youtube;
  return price.instagramComment;
}

async function runItem(wallet: string, item: Item, calls: DigestCall[]) {
  if (!ACTIVE_SOURCES.has(item.source)) return;
  if (item.source === "instagram") {
    await coverPosts(wallet, item, calls, "monid.instagram.tikhub.api-v1-instagram-v2-fetch-user-posts", {
      queryParams: { username: item.value },
    }, {
      cost: price.instagramComment,
      request: (id) => ({
        capabilityId: "monid.instagram.tikhub.api-v1-instagram-v2-fetch-post-comments",
        body: { queryParams: { code_or_url: id } },
      }),
    });
    return;
  }
  if (item.source === "x") {
    await coverPosts(wallet, item, calls, "monid.x.tikhub.api-v1-twitter-web-fetch-user-post-tweet", {
      queryParams: { screen_name: item.value },
    }, {
      cost: price.xComment,
      request: (id) => ({
        capabilityId: "monid.x.tikhub.api-v1-twitter-web-fetch-post-comments",
        body: { queryParams: { tweet_id: id } },
      }),
    });
    return;
  }
  if (item.source === "linkedin-person") {
    await coverProfile(wallet, item, calls);
    return;
  }
  if (item.source === "linkedin-company") {
    const posts = await call(wallet, item, "linkedin.company.posts", { company: item.value });
    calls.push(posts.report);
    return;
  }
  if (item.source === "youtube") {
    const channelId = isChannelId(item.value) ? item.value.trim() : await resolveChannel(wallet, item, calls);
    if (!channelId) return;
    await coverPosts(wallet, item, calls, "monid.youtube.tikhub.api-v1-youtube-web-v2-get-channel-videos", {
      queryParams: { channel_id: channelId },
    }, {
      cost: price.youtube,
      request: (id) => ({
        capabilityId: "monid.youtube.tikhub.api-v1-youtube-web-v2-get-video-comments",
        body: { queryParams: { video_id: id } },
      }),
    }, {
      cost: price.youtubeCaption,
      request: (id) => ({
        capabilityId: "monid.youtube.tikhub.api-v1-youtube-web-v2-get-video-captions",
        body: { queryParams: { video_id: id } },
      }),
    });
  }
}

type FollowRequest = { capabilityId: string; body: Record<string, unknown> };

async function coverPosts(
  wallet: string,
  item: Item,
  calls: DigestCall[],
  postsCapability: string,
  postsBody: Record<string, unknown>,
  comment?: { cost: bigint; request: (id: string) => FollowRequest },
  captions?: { cost: bigint; request: (id: string) => FollowRequest },
) {
  const posts = await call(wallet, item, postsCapability, postsBody);
  calls.push(posts.report);
  if (posts.report.status >= 400) return;
  const selected = selectYesterdayPosts(posts.body, postLimitOf(item), posts.at);
  for (const post of selected) {
    if (!post.id) continue;
    let commentCall: PaidCall | null = null;
    if (comment && item.comments) {
      const next = comment.request(post.id);
      const paid = await payIfCovered(wallet, item, comment.cost, calls, next.capabilityId, next.body);
      if (!paid.paid) return;
      commentCall = paid;
    }
    let spoken: string | undefined;
    if (captions && item.captions) {
      const next = captions.request(post.id);
      const paid = await payIfCovered(wallet, item, captions.cost, calls, next.capabilityId, next.body);
      if (!paid.paid) return;
      if (paid.status < 400) spoken = spokenText(paid.body);
    }
    if (!item.summarize || !item.comments || !commentCall || commentCall.status >= 400) continue;
    const payload: { caption: string; comments: string[]; spoken?: string } = {
      caption: post.caption,
      comments: commentLines(commentCall.body),
    };
    if (spoken !== undefined) payload.spoken = spoken;
    const wrote = await writeBrief(wallet, item, commentCall.at, payload);
    if (!wrote) return;
  }
}

async function coverProfile(wallet: string, item: Item, calls: DigestCall[]) {
  const posts = await call(wallet, item, "linkedin.profile.posts", { profile: item.value, limit: 10 });
  calls.push(posts.report);
  if (posts.report.status >= 400 || !item.comments) return;
  const selected = selectYesterdayPosts(posts.body, postLimitOf(item), posts.at);
  if (selected.length === 0) return;
  const comments = await payIfCovered(wallet, item, price.linkedin, calls, "monid.linkedin.ploid.linkedin-comments", {
    queryParams: { profile: item.value },
  });
  if (!comments.paid || comments.status >= 400 || !item.summarize) return;
  await writeBrief(wallet, item, comments.at, {
    caption: selected.map((post) => post.caption).filter(Boolean).join("\n\n"),
    comments: commentLines(comments.body),
  });
}

async function resolveChannel(wallet: string, item: Item, calls: DigestCall[]): Promise<string | null> {
  const resolved = await call(wallet, item, "monid.youtube.tikhub.api-v1-youtube-web-v2-get-channel-id", {
    queryParams: { channel_url: item.value },
  });
  calls.push(resolved.report);
  if (resolved.report.status >= 400) return null;
  return collect(resolved.body, ["channel_id", "channelId"]).find((id) => isChannelId(id)) ?? null;
}

type PaidCall = { paid: true; status: number; body: unknown; at: Date } | { paid: false };

async function writeBrief(
  wallet: string,
  item: Item,
  at: Date,
  payload: { caption: string; comments: string[]; spoken?: string },
): Promise<boolean> {
  const paid = await payIfCovered(wallet, item, price.summary, [], SUMMARY_CAPABILITY, briefRequest(item.source, item.value, payload));
  if (!paid.paid) return false;
  const text = paid.status < 400 ? completionText(paid.body) : null;
  if (text) await attachSummary(at, text);
  return true;
}

async function attachSummary(at: Date, text: string) {
  const researchId = activeResearch.getStore();
  if (!researchId) return;
  await Research.updateOne(
    { _id: researchId, "calls.at": at },
    { $set: { "calls.$.summary": text.slice(0, 8000), updatedAt: new Date() } },
  );
}

async function payIfCovered(
  wallet: string,
  item: Item,
  cost: bigint,
  calls: DigestCall[],
  capabilityId: string,
  body: Record<string, unknown>,
): Promise<PaidCall> {
  const available = await creditBalance(wallet);
  if (available < cost) {
    calls.push({
      source: item.source,
      value: item.value,
      status: 402,
      amount: null,
      searchId: "",
      note: "Stopped. Not enough credits for the next call.",
    });
    return { paid: false };
  }
  const result = await call(wallet, item, capabilityId, body);
  calls.push(result.report);
  return { paid: true, status: result.report.status, body: result.body, at: result.at };
}

async function call(
  wallet: string,
  item: Item,
  capabilityId: string,
  body: Record<string, unknown>,
): Promise<{ report: DigestCall; body: unknown; at: Date }> {
  const result = await runBuyCall({ capabilityId, ownerWallet: wallet, body, record: false });
  const researchId = activeResearch.getStore();
  const at = new Date();
  if (researchId) {
    await Research.updateOne(
      { _id: researchId },
      {
        $push: {
          calls: {
            capabilityId,
            request: body,
            response: result.body,
            httpStatus: result.status,
            amount: result.amount ?? undefined,
            at,
          },
        },
        $set: { updatedAt: new Date() },
      },
    );
  }
  return {
    report: {
      source: item.source,
      value: item.value,
      status: result.status,
      amount: result.amount,
      searchId: result.searchId,
    },
    body: result.body,
    at,
  };
}

function collect(value: unknown, keys: string[]): string[] {
  const found: string[] = [];
  const wanted = new Set(keys);
  walk(value, wanted, found, 0);
  return [...new Set(found)];
}

function walk(value: unknown, keys: Set<string>, found: string[], depth: number) {
  if (depth > 8 || found.length >= 100) return;
  if (Array.isArray(value)) {
    for (const entry of value) walk(entry, keys, found, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key) && (typeof child === "string" || typeof child === "number")) {
      const text = String(child).trim();
      if (text) found.push(text);
    } else {
      walk(child, keys, found, depth + 1);
    }
  }
}

function isChannelId(value: string): boolean {
  return /^UC[\w-]{22}$/.test(value.trim());
}
