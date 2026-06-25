UPDATE daily_cash_closures
SET
    status = 'reopened',
    reopened_by_user_id = NULLIF(/*reopened_by_user_id*/'', ''),
    reopened_by_user_display_name = NULLIF(/*reopened_by_user_display_name*/'', ''),
    reopened_by_user_role = NULLIF(/*reopened_by_user_role*/'', ''),
    reopened_by_terminal_code = NULLIF(/*reopened_by_terminal_code*/'', ''),
    reopened_at = CURRENT_TIMESTAMP,
    reopen_reason = COALESCE(NULLIF(/*reopen_reason*/'', ''), ''),
    updated_at = CURRENT_TIMESTAMP
WHERE business_date = /*business_date*/'2026-06-25'::date
  AND status = 'closed'
RETURNING *;
