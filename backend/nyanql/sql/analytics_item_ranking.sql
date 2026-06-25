SELECT
    oi.menu_item_id,
    oi.item_name,
    SUM(oi.quantity)::INTEGER AS quantity,
    SUM(ROUND(((oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity) * payment_net.net_ratio))::INTEGER AS sales_total,
    SUM(oi.unit_cost_price * oi.quantity)::INTEGER AS cost_total,
    (SUM(ROUND(((oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity) * payment_net.net_ratio)) - SUM(oi.unit_cost_price * oi.quantity))::INTEGER AS gross_profit,
    CASE
        WHEN SUM(ROUND(((oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity) * payment_net.net_ratio)) = 0 THEN 0
        ELSE ROUND(((SUM(ROUND(((oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity) * payment_net.net_ratio)) - SUM(oi.unit_cost_price * oi.quantity))::numeric / SUM(ROUND(((oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity) * payment_net.net_ratio))) * 100, 1)
    END AS gross_margin_rate
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN table_sessions ts ON ts.id = o.session_id
JOIN payments p ON p.session_id = ts.id
LEFT JOIN (
    SELECT payment_id, SUM(amount)::INTEGER AS refund_total
    FROM payment_refunds
    WHERE status = 'refunded'
    GROUP BY payment_id
) ref ON ref.payment_id = p.id
JOIN LATERAL (
    SELECT CASE
        WHEN p.total_amount <= 0 THEN 0::numeric
        ELSE (GREATEST(p.total_amount - COALESCE(ref.refund_total, 0), 0)::numeric / p.total_amount)
    END AS net_ratio
) payment_net ON TRUE
LEFT JOIN (
    SELECT order_item_id, SUM(price_delta)::INTEGER AS option_total
    FROM order_item_options
    GROUP BY order_item_id
) opt ON opt.order_item_id = oi.id
WHERE p.status IN ('paid', 'partial_refunded', 'refunded')
  AND p.paid_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date
  AND oi.status <> 'cancelled'
GROUP BY oi.menu_item_id, oi.item_name
ORDER BY sales_total DESC, quantity DESC
LIMIT COALESCE(/*limit*/10, 10);
