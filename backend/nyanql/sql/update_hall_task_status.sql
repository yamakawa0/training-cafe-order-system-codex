UPDATE hall_tasks
SET
    status = /*status*/'doing',
    note = COALESCE(/*note*/NULL, note),
    assigned_to = COALESCE(/*assigned_to*/NULL, assigned_to),
    started_at = CASE WHEN /*status*/'doing' = 'doing' THEN CURRENT_TIMESTAMP ELSE started_at END,
    completed_at = CASE WHEN /*status*/'doing' IN ('done', 'cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*task_id*/'task-dev'
RETURNING id, task_type, session_id, table_id, order_item_id, status, note;
