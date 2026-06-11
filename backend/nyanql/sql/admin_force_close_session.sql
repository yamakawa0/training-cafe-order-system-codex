WITH target_session AS (
    SELECT ts.*
    FROM table_sessions ts
    WHERE ts.id = /*session_id*/'sess-dev'
      AND ts.status <> 'closed'
),
blocked_orders AS (
    SELECT COUNT(*)::INTEGER AS count
    FROM orders o
    JOIN target_session ts ON ts.id = o.session_id
    WHERE ts.status <> 'paid'
      AND o.status NOT IN ('closed', 'cancelled')
),
closed_session AS (
    UPDATE table_sessions ts
    SET status = 'closed',
        closed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE ts.id IN (SELECT id FROM target_session)
      AND (SELECT count FROM blocked_orders) = 0
    RETURNING ts.id, ts.table_id, ts.status, ts.closed_at
),
closed_tasks AS (
    UPDATE hall_tasks ht
    SET status = CASE WHEN ht.task_type = 'clean_table' THEN 'done' ELSE 'cancelled' END,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE ht.session_id IN (SELECT id FROM closed_session)
      AND ht.status IN ('todo', 'doing')
    RETURNING ht.id
),
available_table AS (
    UPDATE cafe_tables ct
    SET status = 'available',
        updated_at = CURRENT_TIMESTAMP
    WHERE ct.id IN (SELECT table_id FROM closed_session)
    RETURNING ct.id, ct.table_code, ct.status
)
SELECT
    cs.id AS session_id,
    at.id AS table_id,
    at.table_code,
    cs.status AS session_status,
    at.status AS table_status,
    cs.closed_at,
    (SELECT COUNT(*)::INTEGER FROM closed_tasks) AS closed_task_count
FROM closed_session cs
JOIN available_table at ON at.id = cs.table_id;
