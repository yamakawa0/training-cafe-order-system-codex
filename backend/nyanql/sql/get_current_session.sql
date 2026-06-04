SELECT
    ts.id,
    ts.table_id,
    ct.table_code,
    ct.display_name AS table_name,
    ts.status,
    ts.guest_count,
    ts.opened_at,
    ts.payment_requested_at,
    ts.closed_at
FROM table_sessions ts
JOIN cafe_tables ct ON ct.id = ts.table_id
WHERE ct.table_code = :table_code
  AND ts.status IN ('seated', 'ordering', 'payment_requested', 'paid')
ORDER BY ts.opened_at DESC
LIMIT 1;
