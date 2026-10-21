import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPostalCode, isValidPostalCode } from "./address.ts";

test("accepts 3 and 5 digit postal codes", () => {
  assert.equal(isValidPostalCode("100"), true);
  assert.equal(isValidPostalCode("10048"), true);
});

test("accepts 6 digit postal codes", () => {
  assert.equal(isValidPostalCode("100001"), true);
});

test("rejects malformed postal codes", () => {
  assert.equal(isValidPostalCode("12"), false);
  assert.equal(isValidPostalCode("abcde"), false);
});

test("formatPostalCode trims surrounding spaces", () => {
  assert.equal(formatPostalCode("  10048 "), "10048");
});

test("formatPostalCode removes inner hyphens and spaces", () => {
  assert.equal(formatPostalCode("100-01"), "10001");
  assert.equal(formatPostalCode("100 01"), "10001");
  assert.equal(formatPostalCode(" 100 - 001 "), "100001");
});
