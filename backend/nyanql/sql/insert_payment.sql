INSERT INTO payments (
    id, session_id, payment_no, method, status, subtotal, tax_amount, total_amount
)
VALUES (
    :id, :session_id, :payment_no, :method, 'paid', :subtotal, :tax_amount, :total_amount
)
RETURNING id, payment_no, method, subtotal, tax_amount, total_amount, paid_at;
