import assert from "node:assert/strict";
import { test } from "node:test";
import { DOMESTIC_TIERS, OVERWEIGHT_FEE_CENTS_PER_KG, shippingFeeCents } from "./shipping.ts";

test("charges the first tier for light parcels", () => {
  assert.equal(shippingFeeCents(0.5), 6000);
});

test("charges the matching tier for mid-weight parcels", () => {
  assert.equal(shippingFeeCents(3), 12000);
  assert.equal(shippingFeeCents(20), 25000);
});

test("fees never decrease as weight increases", () => {
  for (let i = 1; i < DOMESTIC_TIERS.length; i += 1) {
    assert.ok(DOMESTIC_TIERS[i].feeCents >= DOMESTIC_TIERS[i - 1].feeCents);
  }
});

test("adds the overweight fee per started kilogram above the last tier", () => {
  assert.equal(shippingFeeCents(20.5), 25000 + OVERWEIGHT_FEE_CENTS_PER_KG);
  assert.equal(shippingFeeCents(22), 25000 + 2 * OVERWEIGHT_FEE_CENTS_PER_KG);
});

test("rejects invalid weights", () => {
  assert.throws(() => shippingFeeCents(0), RangeError);
  assert.throws(() => shippingFeeCents(Number.NaN), RangeError);
});
