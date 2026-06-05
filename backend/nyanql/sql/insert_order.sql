WITH updated_session AS (
    UPDATE table_sessions
    SET status = 'ordering', updated_at = CURRENT_TIMESTAMP
    WHERE id = /*session_id*/'sess-dev'
      AND status = 'seated'
),
inserted_order AS (
    INSERT INTO orders (id, session_id, order_no, status, subtotal, tax_amount, total_amount)
    VALUES (/*id*/'ord-dev', /*session_id*/'sess-dev', /*order_no*/'ORD-DEV', 'submitted', /*subtotal*/0, /*tax_amount*/0, /*total_amount*/0)
    RETURNING id, order_no, subtotal, tax_amount, total_amount, submitted_at
)
SELECT id, order_no, subtotal, tax_amount, total_amount, submitted_at
FROM inserted_order;
