SELECT
    oi.id AS order_item_id,
    o.id AS order_id,
    o.order_no,
    ct.table_code,
    ct.display_name AS table_name,
    oi.item_name,
    oi.quantity,
    oi.status,
    oi.kitchen_station,
    oi.allergy_note,
    oi.customer_note,
    COALESCE(
        STRING_AGG(oio.option_name || ': ' || oio.choice_name, ', ' ORDER BY oio.option_name),
        ''
    ) AS options_text,
    o.submitted_at,
    oi.created_at,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - oi.created_at))::INTEGER AS elapsed_seconds
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN table_sessions ts ON ts.id = o.session_id
JOIN cafe_tables ct ON ct.id = ts.table_id
LEFT JOIN order_item_options oio ON oio.order_item_id = oi.id
WHERE oi.status IN ('ordered', 'accepted', 'cooking', 'ready')
GROUP BY oi.id, o.id, ct.id
ORDER BY oi.created_at ASC;
