INSERT INTO hall_tasks (
    id, task_type, session_id, table_id, order_item_id, status, priority, title, note
)
VALUES (
    /*id*/'task-dev', /*task_type*/'serve_item', /*session_id*/'sess-dev', /*table_id*/'tbl-t01', /*order_item_id*/NULL, 'todo', /*priority*/50, /*title*/'dev task', /*note*/''
)
RETURNING id, task_type, status, title, created_at;
