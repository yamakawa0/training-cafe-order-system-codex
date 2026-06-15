WITH updated_item AS (
    UPDATE order_items
    SET
        status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = /*order_item_id*/'oi-dev'
      AND status IN ('ordered', 'accepted', 'cooking')
    RETURNING id, order_id, status
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
SELECT id AS order_item_id, order_id, status
FROM updated_item;
