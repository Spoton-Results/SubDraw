BEGIN;
CREATE TABLE stripe_payment_attempts (
  invoice_id text PRIMARY KEY REFERENCES invoices(id),
  idempotency_key text NOT NULL CONSTRAINT stripe_payment_attempt_key_unique UNIQUE,
  subcontract_id text NOT NULL REFERENCES subcontracts(id),
  sub_id text NOT NULL REFERENCES users(id),
  owner_id text NOT NULL REFERENCES users(id),
  initiator_id text NOT NULL REFERENCES users(id),
  stripe_account_id text NOT NULL,
  base_cents bigint NOT NULL,
  fee_cents bigint NOT NULL,
  stripe_payment_intent_id text CONSTRAINT stripe_payment_attempt_intent_unique UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_payment_attempt_amounts_check CHECK (base_cents > 0 AND fee_cents >= 0 AND base_cents + fee_cents <= 9007199254740991)
);
COMMIT;
