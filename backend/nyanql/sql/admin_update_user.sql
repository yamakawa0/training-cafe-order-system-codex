UPDATE users
SET display_name = /*display_name*/'スタッフ',
    password_hash = COALESCE(NULLIF(/*password_hash*/'', ''), password_hash),
    password_hash_version = CASE
        WHEN NULLIF(/*password_hash*/'', '') IS NULL THEN password_hash_version
        ELSE /*password_hash_version*/'salted_sha256_v1'
    END,
    password_updated_at = CASE
        WHEN NULLIF(/*password_hash*/'', '') IS NULL THEN password_updated_at
        ELSE CURRENT_TIMESTAMP
    END,
    role = /*role*/'viewer',
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*id*/'user-dev'
RETURNING id, login_id, display_name, role, active, created_at, updated_at;
