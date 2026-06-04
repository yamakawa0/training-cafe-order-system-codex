WITH closed_session AS (
    UPDATE table_sessions
    SET status = 'closed', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = :session_id
      AND status = 'paid'
    RETURNING id, table_id, status, closed_at
),
available_table AS (
    UPDATE cafe_tables
    SET status = 'available', updated_at = CURRENT_TIMESTAMP
    WHERE id IN (SELECT table_id FROM closed_session)
    RETURNING id, table_code, status
)
SELECT
    closed_session.id AS session_id,
    closed_session.status AS session_status,
    closed_session.closed_at,
    available_table.id AS table_id,
    available_table.table_code,
    available_table.status AS table_status
FROM closed_session
JOIN available_table ON available_table.id = closed_session.table_id;
