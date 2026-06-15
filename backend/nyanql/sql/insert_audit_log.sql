INSERT INTO audit_logs (
    id,
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
    error_message
)
VALUES (
    /*id*/'audit-dev',
    NULLIF(/*actor_terminal_code*/'', ''),
    NULLIF(/*actor_terminal_type*/'', ''),
    NULLIF(/*actor_user_id*/'', ''),
    NULLIF(/*actor_user_display_name*/'', ''),
    NULLIF(/*actor_user_role*/'', ''),
    /*action*/'dev.audit',
    /*target_type*/'dev',
    NULLIF(/*target_id*/'', ''),
    NULLIF(/*target_label*/'', ''),
    /*status*/'success',
    CAST(NULLIF(/*before_data*/'', '') AS jsonb),
    CAST(NULLIF(/*after_data*/'', '') AS jsonb),
    CAST(NULLIF(/*request_data*/'', '') AS jsonb),
    NULLIF(/*error_message*/'', '')
)
RETURNING id, occurred_at, status;
