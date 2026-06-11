WITH current_sessions AS (
    SELECT DISTINCT ON (ts.table_id)
        ts.id,
        ts.table_id,
        ts.status,
        ts.opened_at,
        ts.payment_requested_at,
        ts.closed_at,
        ts.updated_at
    FROM table_sessions ts
    WHERE ts.status <> 'closed'
    ORDER BY ts.table_id, ts.opened_at DESC
),
order_counts AS (
    SELECT
        cs.id AS session_id,
        COUNT(DISTINCT o.id)::INTEGER AS order_count,
        COUNT(DISTINCT o.id) FILTER (WHERE o.status NOT IN ('closed', 'cancelled'))::INTEGER AS unpaid_order_count,
        COUNT(oi.id) FILTER (WHERE oi.status NOT IN ('served', 'cancelled'))::INTEGER AS unserved_item_count
    FROM current_sessions cs
    LEFT JOIN orders o ON o.session_id = cs.id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY cs.id
),
task_counts AS (
    SELECT
        ct.id AS table_id,
        COUNT(ht.id) FILTER (WHERE ht.status IN ('todo', 'doing'))::INTEGER AS open_task_count,
        COUNT(ht.id) FILTER (WHERE ht.task_type = 'clean_table' AND ht.status IN ('todo', 'doing'))::INTEGER AS cleanup_task_count
    FROM cafe_tables ct
    LEFT JOIN hall_tasks ht ON ht.table_id = ct.id
    GROUP BY ct.id
)
SELECT
    ct.id AS table_id,
    ct.table_code,
    ct.display_name AS table_name,
    CASE
        WHEN ct.status = 'disabled' THEN 'disabled'
        WHEN COALESCE(tc.cleanup_task_count, 0) > 0 THEN 'cleaning'
        WHEN cs.status = 'payment_requested' THEN 'payment_requested'
        WHEN cs.status = 'paid' THEN 'paid'
        WHEN cs.id IS NOT NULL THEN 'occupied'
        ELSE ct.status
    END AS status,
    term.terminal_code AS customer_terminal_code,
    cs.id AS current_session_id,
    cs.status AS session_status,
    COALESCE(oc.order_count, 0) AS order_count,
    COALESCE(oc.unpaid_order_count, 0) AS unpaid_order_count,
    COALESCE(oc.unserved_item_count, 0) AS unserved_item_count,
    COALESCE(tc.open_task_count, 0) AS open_task_count,
    ct.updated_at
FROM cafe_tables ct
LEFT JOIN terminals term ON term.table_id = ct.id AND term.terminal_type = 'customer'
LEFT JOIN current_sessions cs ON cs.table_id = ct.id
LEFT JOIN order_counts oc ON oc.session_id = cs.id
LEFT JOIN task_counts tc ON tc.table_id = ct.id
WHERE (
    NULLIF(/*status*/'', '') IS NULL
    OR CASE
        WHEN ct.status = 'disabled' THEN 'disabled'
        WHEN COALESCE(tc.cleanup_task_count, 0) > 0 THEN 'cleaning'
        WHEN cs.status = 'payment_requested' THEN 'payment_requested'
        WHEN cs.status = 'paid' THEN 'paid'
        WHEN cs.id IS NOT NULL THEN 'occupied'
        ELSE ct.status
    END = NULLIF(/*status*/'', '')
)
AND (
    NULLIF(/*keyword*/'', '') IS NULL
    OR ct.table_code ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
    OR ct.display_name ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
    OR term.terminal_code ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
)
ORDER BY ct.table_code;
