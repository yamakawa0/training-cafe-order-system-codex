SELECT
    ts.id AS session_id,
    ct.table_code,
    ct.display_name AS table_name,
    ts.status AS session_status,
    latest_attempt.id AS latest_attempt_id,
    latest_attempt.attempt_no AS latest_attempt_no,
    latest_attempt.method AS latest_attempt_method,
    latest_attempt.status AS latest_attempt_status,
    latest_attempt.amount AS latest_attempt_amount,
    latest_attempt.failure_reason AS latest_attempt_failure_reason,
    latest_attempt.cancel_reason AS latest_attempt_cancel_reason,
    latest_attempt.attempted_at AS latest_attempted_at,
    latest_attempt.cancelled_at AS latest_attempt_cancelled_at,
    oi.id AS order_item_id,
    oi.item_name,
    oi.unit_price,
    oi.quantity,
    oi.status AS item_status,
    COALESCE(SUM(oio.price_delta), 0) AS option_total,
    COALESCE(
        STRING_AGG(oio.option_name || ': ' || oio.choice_name, ', ' ORDER BY oio.option_name),
        ''
    ) AS options_text,
    (oi.unit_price + COALESCE(SUM(oio.price_delta), 0)) * oi.quantity AS line_subtotal,
    ROUND(((oi.unit_price + COALESCE(SUM(oio.price_delta), 0)) * oi.quantity) * 0.10)::INTEGER AS line_tax
FROM table_sessions ts
JOIN cafe_tables ct ON ct.id = ts.table_id
JOIN orders o ON o.session_id = ts.id
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN order_item_options oio ON oio.order_item_id = oi.id
LEFT JOIN LATERAL (
    SELECT pa.*
    FROM payment_attempts pa
    WHERE pa.session_id = ts.id
    ORDER BY pa.attempted_at DESC, pa.id DESC
    LIMIT 1
) latest_attempt ON TRUE
WHERE ct.table_code = /*table_code*/'T01'
  AND ts.status IN ('seated', 'ordering', 'payment_requested')
  AND oi.status <> 'cancelled'
GROUP BY ts.id, ct.id, latest_attempt.id, latest_attempt.attempt_no, latest_attempt.method,
         latest_attempt.status, latest_attempt.amount, latest_attempt.failure_reason,
         latest_attempt.cancel_reason, latest_attempt.attempted_at, latest_attempt.cancelled_at, oi.id
ORDER BY oi.created_at ASC;
