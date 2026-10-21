import assert from "node:assert/strict";
import { test } from "node:test";
import { shippingFeeCents } from "./shipping.ts";

test("charges the first tier for light parcels", () => {
  assert.equal(shippingFeeCents(0.5), 6000);
});

test("charges the matching tier for mid-weight parcels", () => {
  assert.equal(shippingFeeCents(3), 12000);
  assert.equal(shippingFeeCents(20), 25000);
});

test("adds the overweight fee per started kilogram above the heaviest tier", () => {
  assert.equal(shippingFeeCents(20.5), 26000);
  assert.equal(shippingFeeCents(23.5), 29000);
  assert.equal(shippingFeeCents(25), 30000);
});

test("rejects invalid weights", () => {
  assert.throws(() => shippingFeeCents(0), RangeError);
  assert.throws(() => shippingFeeCents(Number.NaN), RangeError);
});
