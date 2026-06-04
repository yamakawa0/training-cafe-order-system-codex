INSERT INTO orders (id, session_id, order_no, status, subtotal, tax_amount, total_amount)
VALUES (:id, :session_id, :order_no, 'submitted', :subtotal, :tax_amount, :total_amount)
RETURNING id, order_no, subtotal, tax_amount, total_amount, submitted_at;
