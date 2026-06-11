UPDATE cafe_tables
SET status = /*status*/'available',
    updated_at = CURRENT_TIMESTAMP
WHERE table_code = /*table_code*/'T01'
RETURNING id AS table_id, table_code, display_name AS table_name, status, updated_at;
