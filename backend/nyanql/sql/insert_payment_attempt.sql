INSERT INTO payment_attempts (
    id, session_id, payment_id, attempt_no, method, status, amount, failure_reason,
    provider, external_attempt_id, idempotency_key, provider_status, provider_payload,
    terminal_code, actor_user_id, actor_user_display_name, actor_user_role
) VALUES (
    /*id*/'attempt-dev',
    /*session_id*/'sess-dev',
    NULLIF(/*payment_id*/'', ''),
    /*attempt_no*/'ATT-DEV',
    /*method*/'card',
    /*status*/'failed',
    /*amount*/0,
    COALESCE(NULLIF(/*failure_reason*/'', ''), ''),
    COALESCE(NULLIF(/*provider*/'internal', ''), 'internal'),
    NULLIF(/*external_attempt_id*/'', ''),
    NULLIF(/*idempotency_key*/'', ''),
    NULLIF(/*provider_status*/'', ''),
    CAST(NULLIF(/*provider_payload*/'', '') AS jsonb),
    NULLIF(/*terminal_code*/'', ''),
    NULLIF(/*actor_user_id*/'', ''),
    NULLIF(/*actor_user_display_name*/'', ''),
    NULLIF(/*actor_user_role*/'', '')
)
RETURNING
    id, session_id, payment_id, attempt_no, method, status, amount, failure_reason,
    cancel_reason, provider, external_attempt_id, idempotency_key, provider_status,
    provider_payload, terminal_code, actor_user_id, actor_user_display_name,
    actor_user_role, attempted_at, cancelled_at, created_at, updated_at;
