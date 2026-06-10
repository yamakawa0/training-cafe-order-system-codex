SELECT
    p.paid_at::date AS paid_date,
    p.payment_no,
    p.method,
    ct.table_code,
    oi.menu_item_id,
    oi.item_name,
    oi.quantity,
    (oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity AS sales_total
FROM payments p
JOIN table_sessions ts ON ts.id = p.session_id
JOIN cafe_tables ct ON ct.id = ts.table_id
JOIN orders o ON o.session_id = ts.id
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN (
    SELECT order_item_id, SUM(price_delta)::INTEGER AS option_total
    FROM order_item_options
    GROUP BY order_item_id
) opt ON opt.order_item_id = oi.id
WHERE p.status = 'paid'
  AND p.paid_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date
  AND oi.status <> 'cancelled'
ORDER BY p.paid_at ASC, p.payment_no ASC, oi.created_at ASC;
