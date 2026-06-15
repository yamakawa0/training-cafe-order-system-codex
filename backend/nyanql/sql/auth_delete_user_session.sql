DELETE FROM user_sessions
WHERE session_token = /*session_token*/'token-dev'
RETURNING id, user_id, session_token;
