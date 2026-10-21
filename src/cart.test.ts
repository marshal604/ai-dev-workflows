import assert from "node:assert/strict";
import { test } from "node:test";
import { orderTotalCents, subtotalCents } from "./cart.ts";

test("sums catalog prices by quantity", () => {
  assert.equal(subtotalCents([{ sku: "MANGO-1KG", quantity: 2 }, { sku: "LYCHEE-1KG", quantity: 1 }]), 128000);
});

test("adds shipping to the merchandise total", () => {
  assert.equal(orderTotalCents([{ sku: "MANGO-3KG", quantity: 1 }], 3), 132000);
});
