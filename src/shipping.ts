export interface ShippingTier {
  maxKg: number;
  feeCents: number;
}

export const DOMESTIC_TIERS: readonly ShippingTier[] = [
  { maxKg: 1, feeCents: 6000 },
  { maxKg: 5, feeCents: 1200 },
  { maxKg: 20, feeCents: 25000 },
];

/** Extra charge per started kilogram above the heaviest tier. */
export const OVERWEIGHT_FEE_CENTS_PER_KG = 1000;

function tierIndex(weightKg: number, tiers: readonly ShippingTier[]): number {
  let index = 0;
  while (index < tiers.length && weightKg > tiers[index].maxKg) {
    index += 1;
  }
  return index;
}

/**
 * Shipping fee for a parcel. Parcels heavier than the last tier pay the last tier's fee plus
 * OVERWEIGHT_FEE_CENTS_PER_KG for every started kilogram above it.
 */
export function shippingFeeCents(
  weightKg: number,
  tiers: readonly ShippingTier[] = DOMESTIC_TIERS,
): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new RangeError(`Invalid parcel weight: ${weightKg}`);
  }
  const tier = tiers[tierIndex(weightKg, tiers)];
  return tier.feeCents;
}
