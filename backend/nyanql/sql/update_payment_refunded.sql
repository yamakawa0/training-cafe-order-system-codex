UPDATE payments
SET status = /*status*/'refunded',
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*payment_id*/'pay-dev'
  AND status IN ('paid', 'partial_refunded')
RETURNING id, payment_no, session_id, method, status, subtotal, tax_amount, total_amount, paid_at;
