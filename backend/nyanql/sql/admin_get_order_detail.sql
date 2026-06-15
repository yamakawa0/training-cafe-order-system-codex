WITH target_order AS (
    SELECT o.*
    FROM orders o
    WHERE o.id = /*order_id*/'ord-dev'
),
item_counts AS (
    SELECT
        oi.order_id,
        COUNT(*)::INTEGER AS item_count,
        COUNT(*) FILTER (WHERE oi.status = 'cancelled')::INTEGER AS cancelled_item_count,
        COUNT(*) FILTER (WHERE oi.status NOT IN ('served', 'cancelled'))::INTEGER AS unserved_item_count
    FROM order_items oi
    JOIN target_order o ON o.id = oi.order_id
    GROUP BY oi.order_id
),
payment_summary AS (
    SELECT DISTINCT ON (p.session_id)
        p.session_id,
        p.status AS payment_status,
        p.method AS payment_method,
        p.paid_at
    FROM payments p
    JOIN target_order o ON o.session_id = p.session_id
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
    ps.payment_status,
    ps.payment_method,
    o.submitted_at,
    ps.paid_at,
    ts.status AS session_status,
    ts.opened_at AS session_opened_at,
    ts.payment_requested_at,
    ts.closed_at,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'orderItemId', oi.id,
            'itemName', oi.item_name,
            'quantity', oi.quantity,
            'unitPrice', oi.unit_price,
            'optionTotal', COALESCE(opt.option_total, 0),
            'lineSubtotal', (oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity,
            'lineTax', ROUND(((oi.unit_price + COALESCE(opt.option_total, 0)) * oi.quantity) * 0.10)::INTEGER,
            'status', oi.status,
            'customerNote', oi.customer_note,
            'allergyNote', oi.allergy_note,
            'canCancel', oi.status IN ('ordered', 'accepted', 'cooking')
        ) ORDER BY oi.created_at)
        FROM order_items oi
        LEFT JOIN (
            SELECT order_item_id, SUM(price_delta)::INTEGER AS option_total
            FROM order_item_options
            GROUP BY order_item_id
        ) opt ON opt.order_item_id = oi.id
        WHERE oi.order_id = o.id
    ), '[]'::jsonb) AS items,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'paymentId', p.id,
            'paymentNo', p.payment_no,
            'method', p.method,
            'status', p.status,
            'subtotal', p.subtotal,
            'taxAmount', p.tax_amount,
            'totalAmount', p.total_amount,
            'paidAt', p.paid_at
        ) ORDER BY p.paid_at DESC)
        FROM payments p
        WHERE p.session_id = o.session_id
    ), '[]'::jsonb) AS payments,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'taskId', ht.id,
            'taskType', ht.task_type,
            'title', ht.title,
            'status', ht.status,
            'createdAt', ht.created_at
        ) ORDER BY ht.created_at DESC)
        FROM hall_tasks ht
        LEFT JOIN order_items oi ON oi.id = ht.order_item_id
        WHERE ht.session_id = o.session_id
          AND (ht.order_item_id IS NULL OR oi.order_id = o.id)
    ), '[]'::jsonb) AS hall_tasks
FROM target_order o
JOIN table_sessions ts ON ts.id = o.session_id
JOIN cafe_tables ct ON ct.id = ts.table_id
LEFT JOIN item_counts ic ON ic.order_id = o.id
LEFT JOIN payment_summary ps ON ps.session_id = o.session_id;
