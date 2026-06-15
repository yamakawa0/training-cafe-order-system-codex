UPDATE users
SET display_name = /*display_name*/'スタッフ',
    password_hash = COALESCE(NULLIF(/*password_hash*/'', ''), password_hash),
    role = /*role*/'viewer',
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*id*/'user-dev'
RETURNING id, login_id, display_name, role, active, created_at, updated_at;
