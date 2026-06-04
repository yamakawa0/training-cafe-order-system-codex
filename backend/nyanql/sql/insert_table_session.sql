WITH target_table AS (
    SELECT id
    FROM cafe_tables
    WHERE table_code = :table_code
      AND status = 'available'
),
inserted_session AS (
    INSERT INTO table_sessions (id, table_id, status, guest_count)
    SELECT :id, id, 'seated', :guest_count
    FROM target_table
    RETURNING id, table_id, status, guest_count, opened_at
),
updated_table AS (
    UPDATE cafe_tables
    SET status = 'occupied', updated_at = CURRENT_TIMESTAMP
    WHERE id IN (SELECT table_id FROM inserted_session)
    RETURNING id
)
SELECT id, table_id, status, guest_count, opened_at
FROM inserted_session;
