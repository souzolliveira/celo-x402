import { depositPix } from "@/lib/deposit";
import { requireUser } from "@/lib/privy-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return depositPix(request);
}
