SELECT
    id,
    login_id,
    display_name,
    password_hash,
    role,
    active,
    created_at,
    updated_at
FROM users
WHERE login_id = /*login_id*/'manager';
