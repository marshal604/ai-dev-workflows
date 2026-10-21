import assert from "node:assert/strict";
import { test } from "node:test";
import { orderTotalCents, subtotalCents, validateCart } from "./cart.ts";

test("sums catalog prices by quantity", () => {
  assert.equal(subtotalCents([{ sku: "MANGO-1KG", quantity: 2 }, { sku: "LYCHEE-1KG", quantity: 1 }]), 128000);
});

test("adds shipping to the merchandise total", () => {
  assert.equal(orderTotalCents([{ sku: "MANGO-3KG", quantity: 1 }], 3), 132000);
});

test("validateCart accepts positive integer quantities without mutating or aliasing the input", () => {
  const lines = [
    { sku: "MANGO-3KG", quantity: 1 },
    { sku: "LYCHEE-1KG", quantity: 2 },
  ];
  const result = validateCart(lines);
  assert.deepEqual(result, lines);
  assert.notEqual(result, lines);
  assert.deepEqual(lines.map((l) => l.sku), ["MANGO-3KG", "LYCHEE-1KG"]);
});

test("validateCart rejects zero, negative, fractional and non-finite quantities", () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => validateCart([{ sku: "MANGO-1KG", quantity }]), RangeError);
  }
});
