export function parseDecimalToAtomic(input: string, decimals: number): bigint | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) return null;

  const padded = fraction.padEnd(decimals, "0");
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(padded);
}

export function formatAtomic(amount: string, decimals: number, digits = 2): string {
  const negative = amount.startsWith("-");
  const digitsOnly = negative ? amount.slice(1) : amount;
  if (!/^\d+$/.test(digitsOnly)) return amount;

  const padded = digitsOnly.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals, -decimals + digits);
  const value = Number(`${whole}.${fraction}`);
  if (!Number.isFinite(value)) return amount;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(negative ? -value : value);
}
