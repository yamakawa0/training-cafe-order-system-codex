WITH target_order AS (
    SELECT o.*
    FROM orders o
    WHERE o.id = /*order_id*/'ord-dev'
),
updated_items AS (
    UPDATE order_items oi
    SET
        status = 'cancelled',
        cancelled_at = CASE WHEN oi.status <> 'cancelled' THEN CURRENT_TIMESTAMP ELSE oi.cancelled_at END,
        updated_at = CURRENT_TIMESTAMP
    FROM target_order o
    WHERE oi.order_id = o.id
      AND oi.status IN ('ordered', 'accepted', 'cooking', 'cancelled')
    RETURNING oi.id, oi.order_id
),
updated_order AS (
    UPDATE orders o
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE o.id IN (SELECT id FROM target_order)
    RETURNING o.id
),
cancelled_tasks AS (
    UPDATE hall_tasks ht
    SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE ht.status IN ('todo', 'doing')
      AND ht.order_item_id IN (SELECT id FROM updated_items)
    RETURNING ht.id
)
SELECT
    uo.id AS order_id,
    COUNT(DISTINCT ui.id)::INTEGER AS cancelled_item_count,
    COUNT(DISTINCT ct.id)::INTEGER AS cancelled_task_count
FROM updated_order uo
LEFT JOIN updated_items ui ON ui.order_id = uo.id
LEFT JOIN cancelled_tasks ct ON TRUE
GROUP BY uo.id;
