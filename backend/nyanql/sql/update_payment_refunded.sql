UPDATE payments
SET status = 'refunded',
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*payment_id*/'pay-dev'
  AND status = 'paid'
RETURNING id, payment_no, session_id, method, status, subtotal, tax_amount, total_amount, paid_at;
