UPDATE menu_item_options
SET
    display_order = GREATEST(0, display_order + CASE WHEN /*direction*/'up' = 'up' THEN -15 ELSE 15 END),
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*option_id*/'opt-admin'
RETURNING id AS option_id, item_id, name AS option_name, required, multi_select, min_select, max_select, active AS option_active, display_order AS option_order, updated_at AS option_updated_at;
