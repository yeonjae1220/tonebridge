-- Preserve historical balances and transactions. New accounts start without currency.
ALTER TABLE users ALTER COLUMN credits SET DEFAULT 0;

-- Free community requests must also be valid on the production PostgreSQL schema.
ALTER TABLE correction_requests DROP CONSTRAINT correction_requests_credit_cost_check;
ALTER TABLE correction_requests ADD CONSTRAINT correction_requests_credit_cost_check
    CHECK (credit_cost >= 0);
