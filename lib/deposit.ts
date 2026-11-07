import QRCode from "qrcode";

export async function depositPix(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const raw =
    body && typeof body === "object" && "amount" in body && typeof body.amount === "string"
      ? body.amount
      : "";
  const amount = parseBrl(raw);
  if (!amount) {
    return Response.json({ message: "Enter an amount greater than zero." }, { status: 400 });
  }

  const payload = JSON.stringify({ type: "deposit", channel: "pix", amount, ping: "pong" });
  const qrDataUrl = await QRCode.toDataURL(payload, {
    margin: 1,
    width: 280,
    errorCorrectionLevel: "M",
  });

  return Response.json({
    ping: "pong" as const,
    channel: "pix" as const,
    amount,
    label: formatBrl(amount),
    qrDataUrl,
  });
}

function parseBrl(input: string): string | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value.toFixed(2);
}

function formatBrl(amount: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "BRL" }).format(Number(amount));
}
