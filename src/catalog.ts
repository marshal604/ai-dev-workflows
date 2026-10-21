export interface Product {
  sku: string;
  name: string;
  priceCents: number;
}

export class UnknownSkuError extends Error {
  constructor(sku: string) {
    super(`Unknown SKU: ${sku}`);
    this.name = "UnknownSkuError";
  }
}

const PRODUCTS: readonly Product[] = [
  { sku: "MANGO-1KG", name: "Irwin mango 1 kg", priceCents: 45000 },
  { sku: "MANGO-3KG", name: "Irwin mango 3 kg", priceCents: 120000 },
  { sku: "LYCHEE-1KG", name: "Lychee 1 kg", priceCents: 38000 },
];

export const CATALOG: ReadonlyMap<string, Product> = new Map(PRODUCTS.map((p) => [p.sku, p]));
