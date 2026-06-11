SELECT
    t.id AS terminal_id,
    t.terminal_code,
    t.terminal_type,
    ct.table_code,
    t.active,
    t.display_name AS description,
    t.updated_at
FROM terminals t
LEFT JOIN cafe_tables ct ON ct.id = t.table_id
WHERE (
    NULLIF(/*keyword*/'', '') IS NULL
    OR t.terminal_code ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
    OR t.display_name ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
    OR ct.table_code ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
)
ORDER BY
    CASE t.terminal_type
        WHEN 'customer' THEN 1
        WHEN 'kitchen' THEN 2
        WHEN 'hall' THEN 3
        WHEN 'checkout' THEN 4
        WHEN 'analytics' THEN 5
        ELSE 9
    END,
    t.terminal_code;
