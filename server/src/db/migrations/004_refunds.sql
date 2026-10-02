-- Card cancellations reduce spending. Preserve the signed billed amount.
ALTER TABLE transactions DROP CONSTRAINT transactions_amount_minor_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_amount_minor_check
 CHECK (amount_minor <> 0 AND amount_minor BETWEEN -100000000000 AND 100000000000);
