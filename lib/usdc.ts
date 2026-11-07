const USDC_DECIMALS = 6;

export function parseUsdc(input: string): bigint | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const atomic = BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(fraction.padEnd(USDC_DECIMALS, "0"));
  if (atomic <= 0n) return null;
  return atomic;
}

export function formatUsdc(atomic: bigint): string {
  const scale = 10n ** BigInt(USDC_DECIMALS);
  const whole = atomic / scale;
  const fraction = (atomic % scale).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
