SELECT
    oi.id AS order_item_id,
    oi.status,
    oi.item_name,
    oi.quantity,
    oi.order_id,
    o.session_id,
    ts.table_id,
    ct.table_code,
    ct.display_name AS table_name
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN table_sessions ts ON ts.id = o.session_id
JOIN cafe_tables ct ON ct.id = ts.table_id
WHERE oi.id = /*order_item_id*/'oi-dev';
