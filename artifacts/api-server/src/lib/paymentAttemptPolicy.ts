export function paymentAmounts(amount: number, retention: number) {
  const base = Math.round(amount * 100);
  const fee = Math.round(base / 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(base) || base <= 0 || Math.abs(amount * 100 - base) > 0.000001 || !Number.isSafeInteger(base + fee)) throw new Error("Invalid invoice amount");
  if (!Number.isFinite(retention) || retention !== 0) throw new Error("Retention-aware charging is required");
  return { base, fee, total: base + fee };
}
export function canRetryUnresolvedAttempt(createdAt: Date, now = new Date()): boolean {
  const age = now.getTime() - createdAt.getTime();
  return Number.isFinite(age) && age >= 0 && age < 23 * 60 * 60 * 1000;
}
export function attemptMatches(attempt: { invoiceId: string; subcontractId: string; subId: string; initiatorId: string; idempotencyKey: string; baseCents: number; feeCents: number; stripePaymentIntentId: string | null }, pi: { id: string; amount: number; currency: string; application_fee_amount: number | null; metadata: Record<string, string> }): boolean {
  return (!attempt.stripePaymentIntentId || attempt.stripePaymentIntentId === pi.id)
    && pi.amount === attempt.baseCents + attempt.feeCents && pi.currency === "usd"
    && pi.application_fee_amount === attempt.feeCents
    && pi.metadata.invoiceId === attempt.invoiceId && pi.metadata.subcontractId === attempt.subcontractId
    && pi.metadata.subId === attempt.subId && pi.metadata.gcId === attempt.initiatorId
    && pi.metadata.attemptKey === attempt.idempotencyKey;
}
