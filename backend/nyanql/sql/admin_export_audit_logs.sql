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
WHERE occurred_at::date BETWEEN COALESCE(NULLIF(/*from_date*/'', '')::date, CURRENT_DATE - INTERVAL '30 days')::date
      AND COALESCE(NULLIF(/*to_date*/'', '')::date, CURRENT_DATE)::date
  AND (NULLIF(/*action*/'', '') IS NULL OR action = NULLIF(/*action*/'', ''))
  AND (NULLIF(/*target_type*/'', '') IS NULL OR target_type = NULLIF(/*target_type*/'', ''))
  AND (NULLIF(/*target_label*/'', '') IS NULL OR target_label ILIKE '%' || NULLIF(/*target_label*/'', '') || '%')
  AND (NULLIF(/*actor_terminal_code*/'', '') IS NULL OR actor_terminal_code ILIKE '%' || NULLIF(/*actor_terminal_code*/'', '') || '%')
  AND (NULLIF(/*actor_user_id*/'', '') IS NULL OR actor_user_id = NULLIF(/*actor_user_id*/'', ''))
  AND (NULLIF(/*actor_user_role*/'', '') IS NULL OR actor_user_role = NULLIF(/*actor_user_role*/'', ''))
  AND (NULLIF(/*status*/'', '') IS NULL OR status = NULLIF(/*status*/'', ''))
  AND (
      NULLIF(/*keyword*/'', '') IS NULL
      OR action ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
      OR target_type ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
      OR target_id ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
      OR target_label ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
      OR actor_terminal_code ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
      OR actor_user_display_name ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
      OR actor_user_role ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
      OR error_message ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
  )
ORDER BY occurred_at DESC, id DESC
LIMIT 5000;
