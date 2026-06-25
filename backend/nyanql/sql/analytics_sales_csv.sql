WITH paid_rows AS (
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
        COALESCE(ref.refund_reason, '') AS refund_reason,
        p.total_amount::INTEGER AS gross_amount,
        COALESCE(ref.refund_amount, 0)::INTEGER AS refund_total,
        GREATEST(p.total_amount - COALESCE(ref.refund_amount, 0), 0)::INTEGER AS refund_remaining,
        GREATEST(p.total_amount - COALESCE(ref.refund_amount, 0), 0)::INTEGER AS net_amount,
        COALESCE(ref.refund_count, 0)::INTEGER AS refund_count,
        ref.refunded_at AS last_refunded_at,
        COALESCE(pa.status, '') AS attempt_status,
        COALESCE(pa.failure_reason, '') AS failure_reason,
        COALESCE(pa.cancel_reason, '') AS cancelled_reason,
        p.paid_at AS sort_time
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
            COUNT(*)::INTEGER AS refund_count,
            STRING_AGG(reason, ' / ' ORDER BY refunded_at DESC) AS refund_reason
        FROM payment_refunds
        WHERE status = 'refunded'
        GROUP BY payment_id
    ) ref ON ref.payment_id = p.id
    LEFT JOIN LATERAL (
        SELECT pa.*
        FROM payment_attempts pa
        WHERE pa.payment_id = p.id
        ORDER BY pa.attempted_at DESC
        LIMIT 1
    ) pa ON TRUE
    WHERE p.status IN ('paid', 'partial_refunded', 'refunded')
      AND (p.paid_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date
           OR ref.refunded_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date)
      AND oi.status <> 'cancelled'
),
attempt_rows AS (
    SELECT
        pa.attempted_at::date AS paid_date,
        COALESCE(p.payment_no, '') AS payment_no,
        pa.method,
        ct.table_code,
        '' AS menu_item_id,
        '' AS item_name,
        0::INTEGER AS quantity,
        0::INTEGER AS sales_total,
        0::INTEGER AS unit_cost_price,
        0::INTEGER AS cost_total,
        0::INTEGER AS gross_profit,
        0::NUMERIC AS gross_margin_rate,
        COALESCE(p.status, '') AS payment_status,
        0::INTEGER AS refund_amount,
        NULL::TIMESTAMP AS refunded_at,
        '' AS refund_reason,
        0::INTEGER AS gross_amount,
        0::INTEGER AS refund_total,
        0::INTEGER AS refund_remaining,
        0::INTEGER AS net_amount,
        0::INTEGER AS refund_count,
        NULL::TIMESTAMP AS last_refunded_at,
        pa.status AS attempt_status,
        pa.failure_reason,
        pa.cancel_reason AS cancelled_reason,
        pa.attempted_at AS sort_time
    FROM payment_attempts pa
    JOIN table_sessions ts ON ts.id = pa.session_id
    JOIN cafe_tables ct ON ct.id = ts.table_id
    LEFT JOIN payments p ON p.id = pa.payment_id
    WHERE pa.status IN ('failed', 'cancelled')
      AND pa.attempted_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date
)
SELECT
    paid_date, payment_no, method, table_code, menu_item_id, item_name, quantity,
    sales_total, unit_cost_price, cost_total, gross_profit, gross_margin_rate,
    payment_status, refund_amount, refunded_at, refund_reason,
    gross_amount, refund_total, refund_remaining, net_amount, refund_count, last_refunded_at,
    attempt_status, failure_reason, cancelled_reason, sort_time
FROM paid_rows
UNION ALL
SELECT
    paid_date, payment_no, method, table_code, menu_item_id, item_name, quantity,
    sales_total, unit_cost_price, cost_total, gross_profit, gross_margin_rate,
    payment_status, refund_amount, refunded_at, refund_reason,
    gross_amount, refund_total, refund_remaining, net_amount, refund_count, last_refunded_at,
    attempt_status, failure_reason, cancelled_reason, sort_time
FROM attempt_rows
ORDER BY paid_date ASC, payment_no ASC, sort_time ASC;
