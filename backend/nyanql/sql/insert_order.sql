WITH updated_session AS (
    UPDATE table_sessions
    SET status = 'ordering', updated_at = CURRENT_TIMESTAMP
    WHERE id = :session_id
      AND status = 'seated'
),
inserted_order AS (
    INSERT INTO orders (id, session_id, order_no, status, subtotal, tax_amount, total_amount)
    VALUES (:id, :session_id, :order_no, 'submitted', :subtotal, :tax_amount, :total_amount)
    RETURNING id, order_no, subtotal, tax_amount, total_amount, submitted_at
)
SELECT id, order_no, subtotal, tax_amount, total_amount, submitted_at
FROM inserted_order;
