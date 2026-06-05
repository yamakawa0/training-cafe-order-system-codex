WITH updated_session AS (
    UPDATE table_sessions
    SET status = 'paid', updated_at = CURRENT_TIMESTAMP
    WHERE id = /*session_id*/'sess-dev'
      AND status = 'payment_requested'
    RETURNING id, table_id
),
updated_orders AS (
    UPDATE orders
    SET status = 'closed', updated_at = CURRENT_TIMESTAMP
    WHERE session_id = /*session_id*/'sess-dev'
    RETURNING id
)
SELECT updated_session.id, updated_session.table_id FROM updated_session;
