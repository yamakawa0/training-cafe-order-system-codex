SELECT
    id,
    login_id,
    display_name,
    password_hash,
    password_hash_version,
    password_updated_at,
    failed_login_count,
    locked_until,
    role,
    active,
    created_at,
    updated_at
FROM users
WHERE login_id = /*login_id*/'manager';
