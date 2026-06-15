INSERT INTO users (
    id,
    login_id,
    display_name,
    password_hash,
    role,
    active
)
VALUES (
    /*id*/'user-dev',
    /*login_id*/'staff',
    /*display_name*/'スタッフ',
    /*password_hash*/'hash',
    /*role*/'viewer',
    /*active*/TRUE
)
RETURNING id, login_id, display_name, role, active, created_at, updated_at;
