INSERT INTO payments (
    id, session_id, payment_no, method, status, subtotal, tax_amount, total_amount
)
VALUES (
    /*id*/'pay-dev', /*session_id*/'sess-dev', /*payment_no*/'PAY-DEV', /*method*/'card', 'paid', /*subtotal*/0, /*tax_amount*/0, /*total_amount*/0
)
RETURNING id, payment_no, method, subtotal, tax_amount, total_amount, paid_at;
