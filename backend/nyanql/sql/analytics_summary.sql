WITH paid_payments AS (
    SELECT p.*
    FROM payments p
    WHERE p.status = 'paid'
      AND p.paid_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date
),
profit_summary AS (
    SELECT
        COALESCE(SUM(oi.unit_cost_price * oi.quantity), 0)::INTEGER AS cost_total
    FROM paid_payments p
    JOIN table_sessions ts ON ts.id = p.session_id
    JOIN orders o ON o.session_id = ts.id
    JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.status <> 'cancelled'
)
SELECT
    COALESCE(SUM(p.total_amount), 0)::INTEGER AS sales_total,
    COALESCE(MAX(ps.cost_total), 0)::INTEGER AS cost_total,
    (COALESCE(SUM(p.total_amount), 0) - COALESCE(MAX(ps.cost_total), 0))::INTEGER AS gross_profit,
    CASE
        WHEN COALESCE(SUM(p.total_amount), 0) = 0 THEN 0
        ELSE ROUND(((COALESCE(SUM(p.total_amount), 0) - COALESCE(MAX(ps.cost_total), 0))::numeric / COALESCE(SUM(p.total_amount), 0)) * 100, 1)
    END AS gross_margin_rate,
    COUNT(p.id)::INTEGER AS payment_count,
    CASE WHEN COUNT(p.id) = 0 THEN 0 ELSE ROUND(AVG(p.total_amount))::INTEGER END AS average_spend,
    COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.total_amount ELSE 0 END), 0)::INTEGER AS cash_total,
    COALESCE(SUM(CASE WHEN p.method = 'card' THEN p.total_amount ELSE 0 END), 0)::INTEGER AS card_total,
    COALESCE(SUM(CASE WHEN p.method = 'qr' THEN p.total_amount ELSE 0 END), 0)::INTEGER AS qr_total,
    COUNT(CASE WHEN p.method = 'cash' THEN 1 END)::INTEGER AS cash_count,
    COUNT(CASE WHEN p.method = 'card' THEN 1 END)::INTEGER AS card_count,
    COUNT(CASE WHEN p.method = 'qr' THEN 1 END)::INTEGER AS qr_count,
    COALESCE((
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (ready_at - cooking_started_at))))::INTEGER
        FROM order_items
        WHERE ready_at IS NOT NULL
          AND cooking_started_at IS NOT NULL
          AND created_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date
    ), 0)::INTEGER AS average_cooking_seconds,
    COUNT(DISTINCT p.session_id)::INTEGER AS table_turns
FROM paid_payments p
CROSS JOIN profit_summary ps;
