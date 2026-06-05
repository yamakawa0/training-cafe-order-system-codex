SELECT
    oi.menu_item_id,
    oi.item_name,
    SUM(oi.quantity)::INTEGER AS quantity,
    SUM((oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity)::INTEGER AS sales_total
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN table_sessions ts ON ts.id = o.session_id
JOIN payments p ON p.session_id = ts.id
LEFT JOIN (
    SELECT order_item_id, SUM(price_delta)::INTEGER AS option_total
    FROM order_item_options
    GROUP BY order_item_id
) opt ON opt.order_item_id = oi.id
WHERE p.status = 'paid'
  AND p.paid_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date
  AND oi.status <> 'cancelled'
GROUP BY oi.menu_item_id, oi.item_name
ORDER BY sales_total DESC, quantity DESC
LIMIT COALESCE(/*limit*/10, 10);
