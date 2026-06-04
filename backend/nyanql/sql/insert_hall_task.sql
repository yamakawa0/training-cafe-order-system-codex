INSERT INTO hall_tasks (
    id, task_type, session_id, table_id, order_item_id, status, priority, title, note
)
VALUES (
    :id, :task_type, :session_id, :table_id, :order_item_id, 'todo', :priority, :title, :note
)
RETURNING id, task_type, status, title, created_at;
