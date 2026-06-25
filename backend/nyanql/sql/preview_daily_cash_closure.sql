WITH input AS (
    SELECT
        /*business_date*/'2026-06-25'::date AS business_date,
        /*business_date*/'2026-06-25'::date::timestamp AS period_started_at,
        (/*business_date*/'2026-06-25'::date + INTERVAL '1 day' - INTERVAL '1 second')::timestamp AS period_ended_at
),
refunds_by_payment AS (
    SELECT
        payment_id,
        SUM(amount)::INTEGER AS refund_total,
        COUNT(*)::INTEGER AS refund_count
    FROM payment_refunds
    WHERE status = 'refunded'
    GROUP BY payment_id
),
settled_payments AS (
    SELECT
        p.*,
        COALESCE(r.refund_total, 0)::INTEGER AS refund_total,
        COALESCE(r.refund_count, 0)::INTEGER AS refund_count,
        GREATEST(p.total_amount - COALESCE(r.refund_total, 0), 0)::INTEGER AS net_amount
    FROM payments p
    LEFT JOIN refunds_by_payment r ON r.payment_id = p.id
    JOIN input i ON p.paid_at::date = i.business_date
    WHERE p.status IN ('paid', 'partial_refunded', 'refunded')
),
profit_summary AS (
    SELECT
        COALESCE(SUM(oi.unit_cost_price * oi.quantity), 0)::INTEGER AS cost_total
    FROM settled_payments p
    JOIN table_sessions ts ON ts.id = p.session_id
    JOIN orders o ON o.session_id = ts.id
    JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.status <> 'cancelled'
),
attempt_summary AS (
    SELECT
        COUNT(CASE WHEN pa.status = 'failed' THEN 1 END)::INTEGER AS failed_count,
        COUNT(CASE WHEN pa.status = 'cancelled' THEN 1 END)::INTEGER AS cancelled_count
    FROM payment_attempts pa
    JOIN input i ON pa.attempted_at::date = i.business_date
    WHERE pa.status IN ('failed', 'cancelled')
),
closure AS (
    SELECT dcc.*
    FROM daily_cash_closures dcc
    JOIN input i ON i.business_date = dcc.business_date
)
SELECT
    i.business_date,
    i.period_started_at,
    i.period_ended_at,
    COALESCE(SUM(p.total_amount), 0)::INTEGER AS gross_sales_total,
    COALESCE(SUM(p.refund_total), 0)::INTEGER AS refund_total,
    COALESCE(SUM(p.net_amount), 0)::INTEGER AS net_sales_total,
    COALESCE(SUM(CASE WHEN p.status IN ('paid', 'partial_refunded') THEN p.tax_amount ELSE 0 END), 0)::INTEGER AS tax_total,
    COALESCE(MAX(ps.cost_total), 0)::INTEGER AS cost_total,
    (COALESCE(SUM(p.net_amount), 0) - COALESCE(MAX(ps.cost_total), 0))::INTEGER AS gross_profit,
    COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.net_amount ELSE 0 END), 0)::INTEGER AS cash_total,
    COALESCE(SUM(CASE WHEN p.method = 'card' THEN p.net_amount ELSE 0 END), 0)::INTEGER AS card_total,
    COALESCE(SUM(CASE WHEN p.method = 'qr' THEN p.net_amount ELSE 0 END), 0)::INTEGER AS qr_total,
    COALESCE(SUM(CASE WHEN p.provider = 'internal' THEN p.net_amount ELSE 0 END), 0)::INTEGER AS internal_provider_total,
    COALESCE(SUM(CASE WHEN p.provider = 'mock' THEN p.net_amount ELSE 0 END), 0)::INTEGER AS mock_provider_total,
    COUNT(CASE WHEN p.status = 'paid' THEN 1 END)::INTEGER AS paid_count,
    COUNT(CASE WHEN p.status = 'partial_refunded' THEN 1 END)::INTEGER AS partial_refunded_count,
    COUNT(CASE WHEN p.status = 'refunded' THEN 1 END)::INTEGER AS refunded_count,
    COALESCE(MAX(a.failed_count), 0)::INTEGER AS failed_count,
    COALESCE(MAX(a.cancelled_count), 0)::INTEGER AS cancelled_count,
    COALESCE(SUM(p.refund_count), 0)::INTEGER AS refund_count,
    CASE WHEN MAX(c.id) IS NULL THEN FALSE ELSE TRUE END AS already_closed,
    MAX(c.status) AS closure_status,
    MAX(c.id) AS closure_id,
    MAX(c.closed_at) AS closed_at,
    MAX(c.reopened_at) AS reopened_at,
    COALESCE(MAX(c.note), '') AS note,
    COALESCE(MAX(c.reopen_reason), '') AS reopen_reason
FROM input i
LEFT JOIN settled_payments p ON TRUE
CROSS JOIN profit_summary ps
CROSS JOIN attempt_summary a
LEFT JOIN closure c ON TRUE
GROUP BY i.business_date, i.period_started_at, i.period_ended_at;
