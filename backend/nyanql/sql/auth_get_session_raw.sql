SELECT
    s.id,
    s.user_id,
    s.session_token,
    s.terminal_code,
    s.expires_at,
    s.revoked_at,
    s.user_agent,
    s.created_at,
    s.last_seen_at,
    u.login_id,
    u.display_name,
    u.role,
    u.active
FROM user_sessions s
JOIN users u ON u.id = s.user_id
WHERE s.session_token = /*session_token*/'token-dev';
