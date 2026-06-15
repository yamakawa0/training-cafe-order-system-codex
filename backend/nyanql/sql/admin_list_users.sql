SELECT
    id,
    login_id,
    display_name,
    role,
    active,
    created_at,
    updated_at
FROM users
WHERE (
    NULLIF(/*keyword*/'', '') IS NULL
    OR login_id ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
    OR display_name ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
    OR role ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
)
ORDER BY created_at, login_id;
