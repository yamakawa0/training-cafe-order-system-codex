UPDATE users
SET failed_login_count = 0,
    locked_until = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*user_id*/'user-manager'
RETURNING id, login_id, failed_login_count, locked_until;
