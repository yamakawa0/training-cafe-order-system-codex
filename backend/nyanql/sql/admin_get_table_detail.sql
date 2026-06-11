WITH target_table AS (
    SELECT *
    FROM cafe_tables
    WHERE table_code = /*table_code*/'T01'
),
current_session AS (
    SELECT DISTINCT ON (ts.table_id) ts.*
    FROM table_sessions ts
    JOIN target_table tt ON tt.id = ts.table_id
    WHERE ts.status <> 'closed'
    ORDER BY ts.table_id, ts.opened_at DESC
),
order_counts AS (
    SELECT
        cs.id AS session_id,
        COUNT(DISTINCT o.id)::INTEGER AS order_count,
        COUNT(DISTINCT o.id) FILTER (WHERE o.status NOT IN ('closed', 'cancelled'))::INTEGER AS unpaid_order_count,
        COUNT(oi.id) FILTER (WHERE oi.status NOT IN ('served', 'cancelled'))::INTEGER AS unserved_item_count
    FROM current_session cs
    LEFT JOIN orders o ON o.session_id = cs.id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY cs.id
),
task_counts AS (
    SELECT
        tt.id AS table_id,
        COUNT(ht.id) FILTER (WHERE ht.status IN ('todo', 'doing'))::INTEGER AS open_task_count,
        COUNT(ht.id) FILTER (WHERE ht.task_type = 'clean_table' AND ht.status IN ('todo', 'doing'))::INTEGER AS cleanup_task_count
    FROM target_table tt
    LEFT JOIN hall_tasks ht ON ht.table_id = tt.id
    GROUP BY tt.id
)
SELECT
    tt.id AS table_id,
    tt.table_code,
    tt.display_name AS table_name,
    CASE
        WHEN tt.status = 'disabled' THEN 'disabled'
        WHEN COALESCE(tc.cleanup_task_count, 0) > 0 THEN 'cleaning'
        WHEN cs.status = 'payment_requested' THEN 'payment_requested'
        WHEN cs.status = 'paid' THEN 'paid'
        WHEN cs.id IS NOT NULL THEN 'occupied'
        ELSE tt.status
    END AS status,
    term.terminal_code AS customer_terminal_code,
    cs.id AS current_session_id,
    cs.status AS session_status,
    cs.opened_at AS session_opened_at,
    cs.payment_requested_at,
    cs.closed_at,
    COALESCE(oc.order_count, 0) AS order_count,
    COALESCE(oc.unpaid_order_count, 0) AS unpaid_order_count,
    COALESCE(oc.unserved_item_count, 0) AS unserved_item_count,
    COALESCE(tc.open_task_count, 0) AS open_task_count,
    tt.updated_at,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'orderId', o.id,
            'orderNo', o.order_no,
            'status', o.status,
            'subtotal', o.subtotal,
            'taxAmount', o.tax_amount,
            'totalAmount', o.total_amount,
            'submittedAt', o.submitted_at
        ) ORDER BY o.submitted_at DESC)
        FROM orders o
        WHERE o.session_id = cs.id
    ), '[]'::jsonb) AS orders,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'orderItemId', oi.id,
            'orderNo', o.order_no,
            'itemName', oi.item_name,
            'quantity', oi.quantity,
            'status', oi.status,
            'unitPrice', oi.unit_price,
            'customerNote', oi.customer_note,
            'allergyNote', oi.allergy_note
        ) ORDER BY oi.created_at)
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.session_id = cs.id
    ), '[]'::jsonb) AS order_items,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'paymentId', p.id,
            'paymentNo', p.payment_no,
            'method', p.method,
            'status', p.status,
            'totalAmount', p.total_amount,
            'paidAt', p.paid_at
        ) ORDER BY p.paid_at DESC)
        FROM payments p
        WHERE p.session_id = cs.id
    ), '[]'::jsonb) AS payments,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'taskId', ht.id,
            'taskType', ht.task_type,
            'title', ht.title,
            'note', ht.note,
            'status', ht.status,
            'createdAt', ht.created_at
        ) ORDER BY ht.created_at DESC)
        FROM hall_tasks ht
        WHERE ht.table_id = tt.id
          AND (cs.id IS NULL OR ht.session_id = cs.id)
    ), '[]'::jsonb) AS hall_tasks
FROM target_table tt
LEFT JOIN terminals term ON term.table_id = tt.id AND term.terminal_type = 'customer'
LEFT JOIN current_session cs ON cs.table_id = tt.id
LEFT JOIN order_counts oc ON oc.session_id = cs.id
LEFT JOIN task_counts tc ON tc.table_id = tt.id;
