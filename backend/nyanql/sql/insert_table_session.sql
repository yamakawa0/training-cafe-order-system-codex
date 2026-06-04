INSERT INTO table_sessions (id, table_id, status, guest_count)
SELECT :id, ct.id, 'seated', :guest_count
FROM cafe_tables ct
WHERE ct.table_code = :table_code
RETURNING id, table_id, status, guest_count, opened_at;
