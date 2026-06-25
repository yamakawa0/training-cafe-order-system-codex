WITH target_payment AS (
    SELECT p.*
    FROM payments p
    WHERE ((NULLIF(/*payment_id*/'', '') IS NOT NULL AND p.id = NULLIF(/*payment_id*/'', ''))
       OR (NULLIF(/*payment_no*/'', '') IS NOT NULL AND p.payment_no = NULLIF(/*payment_no*/'', '')))
      AND p.status IN ('paid', 'refunded')
    ORDER BY p.paid_at DESC
    LIMIT 1
),
item_options AS (
    SELECT
        oio.order_item_id,
        SUM(oio.price_delta)::INTEGER AS option_total,
        jsonb_agg(jsonb_build_object(
            'optionName', oio.option_name,
            'choiceName', oio.choice_name,
            'priceDelta', oio.price_delta
        ) ORDER BY oio.option_name, oio.choice_name) AS options,
        STRING_AGG(oio.option_name || ': ' || oio.choice_name, ', ' ORDER BY oio.option_name, oio.choice_name) AS options_text
    FROM order_item_options oio
    GROUP BY oio.order_item_id
)
SELECT
    p.id AS payment_id,
    p.payment_no,
    p.session_id,
    ct.table_code,
    ct.display_name AS table_name,
    p.paid_at,
    p.method,
    p.status,
    p.subtotal,
    p.tax_amount,
    p.total_amount,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'refundId', pr.id,
            'refundNo', pr.refund_no,
            'amount', pr.amount,
            'reason', pr.reason,
            'status', pr.status,
            'refundedAt', pr.refunded_at,
            'actorUserId', pr.actor_user_id,
            'actorUserDisplayName', pr.actor_user_display_name,
            'actorUserRole', pr.actor_user_role,
            'actorTerminalCode', pr.actor_terminal_code
        ) ORDER BY pr.refunded_at DESC)
        FROM payment_refunds pr
        WHERE pr.payment_id = p.id
    ), '[]'::jsonb) AS refunds,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'orderId', o.id,
            'orderNo', o.order_no,
            'status', o.status,
            'subtotal', o.subtotal,
            'taxAmount', o.tax_amount,
            'totalAmount', o.total_amount,
            'submittedAt', o.submitted_at
        ) ORDER BY o.submitted_at)
        FROM orders o
        WHERE o.session_id = p.session_id
    ), '[]'::jsonb) AS orders,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'orderItemId', oi.id,
            'orderId', oi.order_id,
            'itemName', oi.item_name,
            'unitPrice', oi.unit_price,
            'quantity', oi.quantity,
            'status', oi.status,
            'optionTotal', COALESCE(io.option_total, 0),
            'optionsText', COALESCE(io.options_text, ''),
            'options', COALESCE(io.options, '[]'::jsonb),
            'lineSubtotal', (oi.unit_price + COALESCE(io.option_total, 0)) * oi.quantity,
            'lineTax', ROUND(((oi.unit_price + COALESCE(io.option_total, 0)) * oi.quantity) * 0.10)::INTEGER,
            'lineTotal', ((oi.unit_price + COALESCE(io.option_total, 0)) * oi.quantity) + ROUND(((oi.unit_price + COALESCE(io.option_total, 0)) * oi.quantity) * 0.10)::INTEGER
        ) ORDER BY oi.created_at)
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN item_options io ON io.order_item_id = oi.id
        WHERE o.session_id = p.session_id
          AND oi.status <> 'cancelled'
    ), '[]'::jsonb) AS order_items
FROM target_payment p
JOIN table_sessions ts ON ts.id = p.session_id
JOIN cafe_tables ct ON ct.id = ts.table_id;
