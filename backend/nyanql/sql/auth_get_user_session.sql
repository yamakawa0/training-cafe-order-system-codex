UPDATE user_sessions s
SET last_seen_at = CURRENT_TIMESTAMP
FROM users u
WHERE s.user_id = u.id
  AND s.session_token = /*session_token*/'token-dev'
  AND s.expires_at > CURRENT_TIMESTAMP
  AND s.revoked_at IS NULL
  AND u.active = TRUE
RETURNING
    s.id,
    s.session_token,
    s.terminal_code,
    s.expires_at,
    s.revoked_at,
    s.user_agent,
    s.created_at,
    s.last_seen_at,
    u.id AS user_id,
    u.login_id,
    u.display_name,
    u.role,
    u.active;
