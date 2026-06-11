UPDATE terminals
SET active = /*active*/TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE terminal_code = /*terminal_code*/'customer-T01'
RETURNING
    id AS terminal_id,
    terminal_code,
    terminal_type,
    (SELECT table_code FROM cafe_tables WHERE id = terminals.table_id) AS table_code,
    active,
    display_name AS description,
    updated_at;
