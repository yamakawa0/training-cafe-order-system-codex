SELECT
    ts.id AS session_id,
    ct.table_code,
    ct.display_name AS table_name,
    ts.status AS session_status,
    oi.id AS order_item_id,
    oi.item_name,
    oi.unit_price,
    oi.quantity,
    oi.status AS item_status,
    COALESCE(SUM(oio.price_delta), 0) AS option_total,
    (oi.unit_price + COALESCE(SUM(oio.price_delta), 0)) * oi.quantity AS line_subtotal,
    ROUND(((oi.unit_price + COALESCE(SUM(oio.price_delta), 0)) * oi.quantity) * 0.10)::INTEGER AS line_tax
FROM table_sessions ts
JOIN cafe_tables ct ON ct.id = ts.table_id
JOIN orders o ON o.session_id = ts.id
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN order_item_options oio ON oio.order_item_id = oi.id
WHERE ct.table_code = :table_code
  AND ts.status IN ('seated', 'ordering', 'payment_requested')
  AND oi.status <> 'cancelled'
GROUP BY ts.id, ct.id, oi.id
ORDER BY oi.created_at ASC;
