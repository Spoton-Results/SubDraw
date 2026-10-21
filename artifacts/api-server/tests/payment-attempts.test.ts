import test from "node:test";
import assert from "node:assert/strict";
import { paymentAmounts, canRetryUnresolvedAttempt, attemptMatches } from "../src/lib/paymentAttemptPolicy.ts";
test("invoice plus one-percent platform fee is calculated in cents", () => assert.deepEqual(paymentAmounts(100, 0), { base: 10000, fee: 100, total: 10100 }));
test("invalid and sub-cent amounts fail closed", () => {
  for (const amount of [0, -1, NaN, Infinity, 1.001, Number.MAX_SAFE_INTEGER]) assert.throws(() => paymentAmounts(amount, 0));
});
test("positive or invalid retention is not charged as gross", () => {
  for (const retention of [10, -1, NaN, Infinity]) assert.throws(() => paymentAmounts(100, retention));
});
const start = new Date("2026-10-21T00:00:00Z");
test("unresolved creation can retry before the conservative cutoff", () => assert.equal(canRetryUnresolvedAttempt(start, new Date(start.getTime() + 22 * 3600000)), true));
test("unknown creation is not retried after the cutoff", () => assert.equal(canRetryUnresolvedAttempt(start, new Date(start.getTime() + 23 * 3600000)), false));
test("invalid timestamps and reversed clocks fail closed", () => {
  assert.equal(canRetryUnresolvedAttempt(new Date("invalid"), start), false);
  assert.equal(canRetryUnresolvedAttempt(start, new Date(start.getTime() - 1)), false);
});
const attempt = { invoiceId: "inv1", subcontractId: "sc1", subId: "sub1", initiatorId: "gc1", idempotencyKey: "key1", baseCents: 10000, feeCents: 100, stripePaymentIntentId: null as string | null };
const pi = { id: "pi_1", amount: 10100, currency: "usd", application_fee_amount: 100, metadata: { invoiceId: "inv1", subcontractId: "sc1", subId: "sub1", gcId: "gc1", attemptKey: "key1" } };
test("only the reserved attempt matches its Stripe payment", () => assert.equal(attemptMatches(attempt, pi), true));
test("wrong metadata cannot substitute another attempt", () => {
  for (const field of ["invoiceId", "subcontractId", "subId", "gcId", "attemptKey"]) assert.equal(attemptMatches(attempt, { ...pi, metadata: { ...pi.metadata, [field]: "wrong" } }), false);
});
test("bound payment amount currency and fee cannot change", () => {
  assert.equal(attemptMatches({ ...attempt, stripePaymentIntentId: "pi_other" }, pi), false);
  for (const patch of [{ amount: 10000 }, { currency: "eur" }, { application_fee_amount: 0 }]) assert.equal(attemptMatches(attempt, { ...pi, ...patch }), false);
});
