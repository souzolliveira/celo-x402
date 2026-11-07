const freshForMs = 5 * 60 * 1000;

type CachedUsdc = { address: string; usdc: string | null; at: number };

let cached: CachedUsdc | null = null;
const listeners = new Set<() => void>();

export function rememberWalletUsdc(address: string, usdc: string | null) {
  cached = { address, usdc, at: Date.now() };
  listeners.forEach((listener) => listener());
}

export function freshWalletUsdc(address: string): string | null | undefined {
  if (!cached || cached.address !== address) return undefined;
  if (Date.now() - cached.at > freshForMs) return undefined;
  return cached.usdc;
}

export function subscribeWalletUsdc(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
