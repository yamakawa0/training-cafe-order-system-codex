WITH updated_item AS (
    UPDATE order_items
    SET
        status = :status,
        accepted_at = CASE WHEN :status = 'accepted' THEN CURRENT_TIMESTAMP ELSE accepted_at END,
        cooking_started_at = CASE WHEN :status = 'cooking' THEN CURRENT_TIMESTAMP ELSE cooking_started_at END,
        ready_at = CASE WHEN :status = 'ready' THEN CURRENT_TIMESTAMP ELSE ready_at END,
        served_at = CASE WHEN :status = 'served' THEN CURRENT_TIMESTAMP ELSE served_at END,
        cancelled_at = CASE WHEN :status = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :order_item_id
    RETURNING id, order_id, status, ready_at, served_at, cancelled_at
),
order_rollup AS (
    SELECT
        o.id AS order_id,
        CASE
            WHEN COUNT(*) FILTER (WHERE COALESCE(ui.status, oi.status) <> 'cancelled') = 0 THEN 'cancelled'
            WHEN COUNT(*) FILTER (WHERE COALESCE(ui.status, oi.status) NOT IN ('served', 'cancelled')) = 0 THEN 'served'
            WHEN COUNT(*) FILTER (WHERE COALESCE(ui.status, oi.status) NOT IN ('ready', 'served', 'cancelled')) = 0 THEN 'ready'
            WHEN COUNT(*) FILTER (WHERE COALESCE(ui.status, oi.status) IN ('accepted', 'cooking')) > 0 THEN 'in_progress'
            ELSE o.status
        END AS next_status
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN updated_item ui ON ui.id = oi.id
    WHERE o.id IN (SELECT order_id FROM updated_item)
    GROUP BY o.id, o.status
),
updated_order AS (
    UPDATE orders o
    SET status = order_rollup.next_status, updated_at = CURRENT_TIMESTAMP
    FROM order_rollup
    WHERE o.id = order_rollup.order_id
    RETURNING o.id
)
SELECT id, order_id, status, ready_at, served_at, cancelled_at
FROM updated_item;
