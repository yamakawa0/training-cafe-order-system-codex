SELECT
    t.id,
    t.terminal_code,
    t.terminal_type,
    t.display_name,
    t.active,
    ct.table_code,
    ct.display_name AS table_name
FROM terminals t
LEFT JOIN cafe_tables ct ON ct.id = t.table_id
WHERE t.terminal_code = /*terminal_code*/'customer-T01';
