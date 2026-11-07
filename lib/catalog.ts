import { SUMMARY_CAPABILITY } from "@/lib/summary";

const CATALOG_URL = "https://gateway.usebuy.ai/v1/catalog";
const ORIGIN = "https://gateway.usebuy.ai";
const TTL_MS = 5 * 60 * 1000;

export const SOCIAL_PLATFORMS = ["instagram", "tiktok", "youtube", "linkedin", "reddit", "x"] as const;

const social = new Set<string>(SOCIAL_PLATFORMS);

export type CatalogItem = {
  id: string;
  title: string;
  description: string;
  platform: string;
  method: string;
  url: string;
  allowed: boolean;
  minUsd: string | null;
  example: Record<string, unknown>;
};

type Cache = { at: number; items: CatalogItem[] };
const globalCache = globalThis as typeof globalThis & { buyCatalog?: Cache };

export async function loadCatalog(): Promise<CatalogItem[]> {
  const cached = globalCache.buyCatalog;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.items;

  const response = await fetch(CATALOG_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("The buy catalog did not respond.");
  const payload: unknown = await response.json();
  const capabilities = payload && typeof payload === "object" ? (payload as { capabilities?: unknown }).capabilities : null;
  if (!Array.isArray(capabilities)) throw new Error("The buy catalog has no capabilities.");

  const items = capabilities.flatMap((entry) => {
    const item = normalize(entry);
    return item ? [item] : [];
  });
  globalCache.buyCatalog = { at: Date.now(), items };
  return items;
}

export async function findCapability(id: string): Promise<CatalogItem | null> {
  const items = await loadCatalog();
  return items.find((item) => item.id === id) ?? null;
}

export function isBuyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === ORIGIN && parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalize(entry: unknown): CatalogItem | null {
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.platform !== "string") return null;
  const url = typeof record.url === "string" ? record.url : "";
  if (!isBuyUrl(url)) return null;
  return {
    id: record.id,
    title: typeof record.title === "string" ? record.title : record.id,
    description: typeof record.description === "string" ? record.description : "",
    platform: record.platform,
    method: typeof record.method === "string" ? record.method.toUpperCase() : "POST",
    url,
    allowed: social.has(record.platform) || record.id === SUMMARY_CAPABILITY,
    minUsd: minUsd(record),
    example: exampleBody(record.inputSchema),
  };
}

function minUsd(record: Record<string, unknown>): string | null {
  const price = record.price;
  if (price && typeof price === "object" && typeof (price as { usd?: unknown }).usd === "string") {
    return (price as { usd: string }).usd;
  }
  const options = record.priceOptions;
  if (!Array.isArray(options)) return null;
  let min: number | null = null;
  for (const option of options) {
    if (!option || typeof option !== "object") continue;
    const usd = (option as { usd?: unknown }).usd;
    if (typeof usd !== "string") continue;
    const value = Number(usd);
    if (!Number.isFinite(value)) continue;
    min = min === null ? value : Math.min(min, value);
  }
  return min === null ? null : String(min);
}

function exampleBody(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return {};
  const record = schema as { required?: unknown; properties?: unknown };
  const required = Array.isArray(record.required) ? record.required.filter((key): key is string => typeof key === "string") : [];
  const properties = record.properties && typeof record.properties === "object" ? (record.properties as Record<string, unknown>) : {};
  const body: Record<string, unknown> = {};
  for (const key of required) {
    body[key] = exampleValue(properties[key]);
  }
  return body;
}

function exampleValue(property: unknown): unknown {
  if (!property || typeof property !== "object") return "";
  const record = property as { enum?: unknown; type?: unknown };
  if (Array.isArray(record.enum) && record.enum.length > 0) return record.enum[0];
  if (record.type === "integer" || record.type === "number") return 1;
  if (record.type === "boolean") return false;
  if (record.type === "array") return [];
  if (record.type === "object") return {};
  return "";
}
