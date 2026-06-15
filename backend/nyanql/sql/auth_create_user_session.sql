INSERT INTO user_sessions (
    id,
    user_id,
    session_token,
    terminal_code,
    expires_at,
    last_seen_at
)
VALUES (
    /*id*/'session-dev',
    /*user_id*/'user-manager',
    /*session_token*/'token-dev',
    NULLIF(/*terminal_code*/'', ''),
    CURRENT_TIMESTAMP + (/*expires_seconds*/28800 || ' seconds')::interval,
    CURRENT_TIMESTAMP
)
RETURNING id, user_id, session_token, terminal_code, expires_at, created_at, last_seen_at;
