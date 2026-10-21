import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidPostalCode } from "./address.ts";

test("accepts 3 and 5 digit postal codes", () => {
  assert.equal(isValidPostalCode("100"), true);
  assert.equal(isValidPostalCode("10048"), true);
});

test("rejects malformed postal codes", () => {
  assert.equal(isValidPostalCode("12"), false);
  assert.equal(isValidPostalCode("abcde"), false);
});
