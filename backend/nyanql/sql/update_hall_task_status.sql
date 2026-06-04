UPDATE hall_tasks
SET
    status = :status,
    note = COALESCE(:note, note),
    assigned_to = COALESCE(:assigned_to, assigned_to),
    started_at = CASE WHEN :status = 'doing' THEN CURRENT_TIMESTAMP ELSE started_at END,
    completed_at = CASE WHEN :status IN ('done', 'cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,
    updated_at = CURRENT_TIMESTAMP
WHERE id = :task_id
RETURNING id, task_type, order_item_id, status, note;
