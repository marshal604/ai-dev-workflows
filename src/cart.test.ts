import assert from "node:assert/strict";
import { test } from "node:test";
import { orderTotalCents, subtotalCents, UnknownSkuError } from "./cart.ts";

test("sums catalog prices by quantity", () => {
  assert.equal(subtotalCents([{ sku: "MANGO-1KG", quantity: 2 }, { sku: "LYCHEE-1KG", quantity: 1 }]), 128000);
});

test("throws UnknownSkuError for a SKU that is not in the catalog", () => {
  assert.throws(() => subtotalCents([{ sku: "MANGO-5KG", quantity: 1 }]), UnknownSkuError);
});

test("adds shipping to the merchandise total", () => {
  assert.equal(orderTotalCents([{ sku: "MANGO-1KG", quantity: 1 }], 3), 57000);
});

test("ships free when merchandise after discount reaches the threshold, regardless of weight", () => {
  assert.equal(orderTotalCents([{ sku: "MANGO-3KG", quantity: 1 }], 30), 120000);
  assert.equal(
    orderTotalCents([{ sku: "MANGO-3KG", quantity: 1 }], 3, { code: "SUMMER10", percentOff: 10 }),
    108000,
  );
});
