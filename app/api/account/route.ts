import { requireUser } from "@/lib/privy-auth";
import { profileFieldErrors, saveProfile, type ProfileField } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const body: unknown = await request.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const input = {
    fullName: typeof record.fullName === "string" ? record.fullName : "",
    email: typeof record.email === "string" ? record.email : "",
    document: typeof record.document === "string" ? record.document : "",
    phone: typeof record.phone === "string" ? record.phone : "",
  };
  const fieldErrors = profileFieldErrors(input);
  const errors = (Object.entries(fieldErrors) as [ProfileField, string][]).map(([field, message]) => ({
    field,
    message,
  }));
  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  return Response.json(saveProfile(input));
}
