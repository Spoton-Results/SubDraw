export type PaymentSnapshot = {
  id: string; status: string; currency: string; amount: number;
  amount_received: number; application_fee_amount: number | null;
  metadata: Record<string, string>;
};
export type ExpectedPayment = {
  invoiceId: string; subcontractId: string; subId: string;
  accountId: string; amount: number; intentId: string | null;
};
export function paymentMatches(expected: ExpectedPayment, pi: PaymentSnapshot, accountId: string): boolean {
  const base = Math.round(expected.amount * 100);
  const fee = Math.round(expected.amount * 0.01 * 100);
  return Number.isSafeInteger(base) && base > 0 && Number.isSafeInteger(base + fee)
    && accountId === expected.accountId
    && (!expected.intentId || expected.intentId === pi.id)
    && pi.currency === "usd" && pi.amount === base + fee
    && pi.application_fee_amount === fee
    && (pi.status !== "succeeded" || pi.amount_received === base + fee)
    && pi.metadata.invoiceId === expected.invoiceId
    && pi.metadata.subcontractId === expected.subcontractId
    && pi.metadata.subId === expected.subId;
}
export function reconciledInvoiceStatus(current: string, stripeStatus: string): string {
  return current === "APPROVED" && stripeStatus === "succeeded" ? "PAYMENT_UNCONFIRMED" : current;
}
