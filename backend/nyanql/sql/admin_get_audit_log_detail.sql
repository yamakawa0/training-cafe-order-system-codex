SELECT
    id,
    occurred_at,
    actor_terminal_code,
    actor_terminal_type,
    actor_user_id,
    actor_user_display_name,
    actor_user_role,
    action,
    target_type,
    target_id,
    target_label,
    status,
    before_data,
    after_data,
    request_data,
    error_message,
    created_at
FROM audit_logs
WHERE id = /*id*/'audit-dev';
