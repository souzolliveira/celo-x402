export type LocalAssetId = "wars" | "wbrl";

export type LocalAsset = {
  id: LocalAssetId;
  symbol: "wARS" | "wBRL";
  fiat: "ARS" | "BRL";
  address: `0x${string}`;
  decimals: 18;
};

export const localAssets: LocalAsset[] = [
  {
    id: "wars",
    symbol: "wARS",
    fiat: "ARS",
    address: "0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D",
    decimals: 18,
  },
  {
    id: "wbrl",
    symbol: "wBRL",
    fiat: "BRL",
    address: "0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0",
    decimals: 18,
  },
];

export function localAsset(id: string): LocalAsset | null {
  return localAssets.find((asset) => asset.id === id) ?? null;
}
