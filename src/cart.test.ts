import assert from "node:assert/strict";
import { test } from "node:test";
import { orderTotalCents, subtotalCents } from "./cart.ts";

test("sums catalog prices by quantity", () => {
  assert.equal(subtotalCents([{ sku: "MANGO-1KG", quantity: 2 }, { sku: "LYCHEE-1KG", quantity: 1 }]), 128000);
});

test("adds shipping to the merchandise total", () => {
  assert.equal(orderTotalCents([{ sku: "MANGO-1KG", quantity: 1 }], 3), 57000);
});

test("ships free when merchandise is at least 100000 cents, regardless of weight", () => {
  assert.equal(orderTotalCents([{ sku: "MANGO-3KG", quantity: 1 }], 3), 120000);
  assert.equal(orderTotalCents([{ sku: "MANGO-3KG", quantity: 1 }], 30), 120000);
});

test("free shipping threshold uses merchandise after discount", () => {
  const lines = [{ sku: "MANGO-3KG", quantity: 1 }];
  assert.equal(orderTotalCents(lines, 3, { code: "TEN", percentOff: 10 }), 108000);
});
