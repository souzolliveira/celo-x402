import { publicCapability } from "@/lib/buy-call";
import { loadCatalog } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await loadCatalog();
    return Response.json({ capabilities: items.map((item) => publicCapability(item)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The catalog is unavailable.";
    return Response.json({ message }, { status: 502 });
  }
}
