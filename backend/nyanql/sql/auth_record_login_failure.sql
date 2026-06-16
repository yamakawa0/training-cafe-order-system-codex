UPDATE users
SET failed_login_count = failed_login_count + 1,
    locked_until = CASE
        WHEN failed_login_count + 1 >= /*lock_threshold*/5
            THEN CURRENT_TIMESTAMP + (/*lock_seconds*/300 || ' seconds')::interval
        ELSE locked_until
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE login_id = /*login_id*/'manager'
RETURNING id, login_id, failed_login_count, locked_until;
