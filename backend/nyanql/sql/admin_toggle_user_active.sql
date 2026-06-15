UPDATE users
SET active = /*active*/TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*id*/'user-dev'
RETURNING id, login_id, display_name, role, active, created_at, updated_at;
