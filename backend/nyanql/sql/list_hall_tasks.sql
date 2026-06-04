SELECT
    ht.id,
    ht.task_type,
    ht.session_id,
    ht.order_item_id,
    ht.status,
    ht.priority,
    ht.title,
    ht.note,
    ht.assigned_to,
    ht.created_at,
    ht.started_at,
    ht.completed_at,
    ct.table_code,
    ct.display_name AS table_name,
    oi.item_name,
    oi.quantity,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ht.created_at))::INTEGER AS elapsed_seconds
FROM hall_tasks ht
JOIN cafe_tables ct ON ct.id = ht.table_id
LEFT JOIN order_items oi ON oi.id = ht.order_item_id
WHERE ht.status IN ('todo', 'doing')
ORDER BY ht.priority ASC, ht.created_at ASC;
