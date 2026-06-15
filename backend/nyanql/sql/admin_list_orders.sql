WITH item_counts AS (
    SELECT
        oi.order_id,
        COUNT(*)::INTEGER AS item_count,
        COUNT(*) FILTER (WHERE oi.status = 'cancelled')::INTEGER AS cancelled_item_count,
        COUNT(*) FILTER (WHERE oi.status NOT IN ('served', 'cancelled'))::INTEGER AS unserved_item_count
    FROM order_items oi
    GROUP BY oi.order_id
),
latest_payment AS (
    SELECT DISTINCT ON (p.session_id)
        p.session_id,
        p.status AS payment_status,
        p.method AS payment_method,
        p.paid_at
    FROM payments p
    ORDER BY p.session_id, p.paid_at DESC
)
SELECT
    o.id AS order_id,
    o.order_no,
    o.session_id,
    ct.table_code,
    ct.display_name AS table_name,
    o.status AS order_status,
    COALESCE(ic.item_count, 0) AS item_count,
    COALESCE(ic.cancelled_item_count, 0) AS cancelled_item_count,
    COALESCE(ic.unserved_item_count, 0) AS unserved_item_count,
    o.subtotal,
    o.tax_amount,
    o.total_amount,
    lp.payment_status,
    lp.payment_method,
    o.submitted_at,
    lp.paid_at
FROM orders o
JOIN table_sessions ts ON ts.id = o.session_id
JOIN cafe_tables ct ON ct.id = ts.table_id
LEFT JOIN item_counts ic ON ic.order_id = o.id
LEFT JOIN latest_payment lp ON lp.session_id = ts.id
WHERE o.submitted_at::date BETWEEN COALESCE(NULLIF(/*from_date*/'', '')::date, CURRENT_DATE - INTERVAL '30 days')::date
      AND COALESCE(NULLIF(/*to_date*/'', '')::date, CURRENT_DATE)::date
  AND (NULLIF(/*table_code*/'', '') IS NULL OR ct.table_code ILIKE '%' || NULLIF(/*table_code*/'', '') || '%')
  AND (NULLIF(/*order_no*/'', '') IS NULL OR o.order_no ILIKE '%' || NULLIF(/*order_no*/'', '') || '%')
  AND (NULLIF(/*order_status*/'', '') IS NULL OR o.status = NULLIF(/*order_status*/'', ''))
  AND (NULLIF(/*payment_status*/'', '') IS NULL OR COALESCE(lp.payment_status, 'unpaid') = NULLIF(/*payment_status*/'', ''))
ORDER BY o.submitted_at DESC, o.order_no DESC;
