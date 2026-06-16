UPDATE user_sessions
SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
    last_seen_at = CURRENT_TIMESTAMP
WHERE session_token = /*session_token*/'token-dev'
RETURNING id, user_id, session_token, revoked_at;
