INSERT INTO users (
    id,
    login_id,
    display_name,
    password_hash,
    password_hash_version,
    password_updated_at,
    role,
    active
)
VALUES (
    /*id*/'user-dev',
    /*login_id*/'staff',
    /*display_name*/'スタッフ',
    /*password_hash*/'hash',
    /*password_hash_version*/'salted_sha256_v1',
    CURRENT_TIMESTAMP,
    /*role*/'viewer',
    /*active*/TRUE
)
RETURNING id, login_id, display_name, role, active, created_at, updated_at;
