import { getAddress, isAddress } from "viem";

const PREFIX_HEX = 4;
const SUFFIX_HEX = 4;

export function shortAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function highlightAddress(address: string): { prefix: string; middle: string; suffix: string } | null {
  if (!isAddress(address)) return null;
  const checksummed = getAddress(address);
  const prefixLength = 2 + PREFIX_HEX;
  return {
    prefix: checksummed.slice(0, prefixLength),
    middle: checksummed.slice(prefixLength, -SUFFIX_HEX),
    suffix: checksummed.slice(-SUFFIX_HEX),
  };
}
