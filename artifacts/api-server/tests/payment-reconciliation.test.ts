import test from "node:test";
import assert from "node:assert/strict";
import { paymentMatches, reconciledInvoiceStatus, type PaymentSnapshot } from "../src/lib/paymentReconciliation.js";
const expected = { invoiceId: "inv1", subcontractId: "sc1", subId: "sub1", accountId: "acct1", amount: 100, intentId: null };
const payment: PaymentSnapshot = { id: "pi_1", status: "succeeded", currency: "usd", amount: 10100, amount_received: 10100, application_fee_amount: 100, metadata: { invoiceId: "inv1", subcontractId: "sc1", subId: "sub1" } };
test("matching successful payment is accepted", () => assert.equal(paymentMatches(expected, payment, "acct1"), true));
test("cross-account payment is rejected", () => assert.equal(paymentMatches(expected, payment, "acct2"), false));
test("wrong invoice and subcontract are rejected", () => {
  for (const field of ["invoiceId", "subcontractId", "subId"]) assert.equal(paymentMatches(expected, { ...payment, metadata: { ...payment.metadata, [field]: "wrong" } }, "acct1"), false);
});
test("amount, currency, receipt amount and fee mismatches are rejected", () => {
  for (const patch of [{ amount: 10000 }, { currency: "eur" }, { amount_received: 0 }, { application_fee_amount: 0 }]) assert.equal(paymentMatches(expected, { ...payment, ...patch }, "acct1"), false);
});
test("another bound payment cannot be substituted", () => assert.equal(paymentMatches({ ...expected, intentId: "pi_other" }, payment, "acct1"), false));
test("invalid invoice amounts are rejected", () => {
  for (const amount of [NaN, Infinity, -1, 0]) assert.equal(paymentMatches({ ...expected, amount }, payment, "acct1"), false);
});
test("Stripe success still requires subcontractor receipt confirmation", () => assert.equal(reconciledInvoiceStatus("APPROVED", "succeeded"), "PAYMENT_UNCONFIRMED"));
test("processing and failed payments are not marked paid", () => {
  for (const status of ["processing", "requires_payment_method", "canceled"]) assert.equal(reconciledInvoiceStatus("APPROVED", status), "APPROVED");
});
test("late events cannot downgrade confirmed or disputed invoices", () => {
  for (const status of ["PAYMENT_CONFIRMED", "PAYMENT_DISPUTED", "REJECTED"]) assert.equal(reconciledInvoiceStatus(status, "succeeded"), status);
});
