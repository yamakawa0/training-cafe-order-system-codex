SELECT
    p.paid_at::date AS paid_date,
    p.payment_no,
    p.method,
    ct.table_code,
    oi.menu_item_id,
    oi.item_name,
    oi.quantity,
    (oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity AS sales_total,
    oi.unit_cost_price,
    (oi.unit_cost_price * oi.quantity)::INTEGER AS cost_total,
    ((oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity - (oi.unit_cost_price * oi.quantity))::INTEGER AS gross_profit,
    CASE
        WHEN ((oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity) = 0 THEN 0
        ELSE ROUND(((((oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity) - (oi.unit_cost_price * oi.quantity))::numeric / ((oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity)) * 100, 1)
    END AS gross_margin_rate,
    p.status AS payment_status,
    COALESCE(ref.refund_amount, 0)::INTEGER AS refund_amount,
    ref.refunded_at,
    COALESCE(ref.refund_reason, '') AS refund_reason
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
LEFT JOIN (
    SELECT
        payment_id,
        SUM(amount)::INTEGER AS refund_amount,
        MAX(refunded_at) AS refunded_at,
        STRING_AGG(reason, ' / ' ORDER BY refunded_at DESC) AS refund_reason
    FROM payment_refunds
    WHERE status = 'refunded'
    GROUP BY payment_id
) ref ON ref.payment_id = p.id
WHERE p.status IN ('paid', 'refunded')
  AND (p.paid_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date
       OR ref.refunded_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date)
  AND oi.status <> 'cancelled'
ORDER BY p.paid_at ASC, p.payment_no ASC, oi.created_at ASC;
