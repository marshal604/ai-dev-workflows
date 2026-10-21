import { CATALOG, UnknownSkuError, type Product } from "./catalog.ts";
import { shippingFeeCents } from "./shipping.ts";

export interface CartLine {
  sku: string;
  quantity: number;
}

export interface Discount {
  code: string;
  /** 0-100 */
  percentOff: number;
}

/** Merchandise subtotal. Throws UnknownSkuError for SKUs that are not in the catalog. */
export function subtotalCents(
  lines: readonly CartLine[],
  catalog: ReadonlyMap<string, Product> = CATALOG,
): number {
  return lines.reduce((sum, line) => sum + catalog.get(line.sku)!.priceCents * line.quantity, 0);
}

/**
 * Order total: merchandise minus discount, plus shipping.
 * Discounts apply to merchandise only, never to shipping.
 */
export function orderTotalCents(
  lines: readonly CartLine[],
  weightKg: number,
  discount?: Discount,
): number {
  const merchandise = subtotalCents(lines);
  const shipping = shippingFeeCents(weightKg);
  const off = discount ? Math.round((merchandise * discount.percentOff) / 100) : 0;
  return merchandise - off + shipping;
}

export { UnknownSkuError };
