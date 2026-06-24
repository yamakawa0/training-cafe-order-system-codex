UPDATE menu_item_options
SET
    name = /*name*/'Option',
    required = /*required*/FALSE,
    multi_select = /*multi_select*/FALSE,
    min_select = /*min_select*/0,
    max_select = /*max_select*/NULL,
    active = /*active*/TRUE,
    display_order = /*display_order*/0,
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*option_id*/'opt-admin'
RETURNING id AS option_id, item_id, name AS option_name, required, multi_select, min_select, max_select, active AS option_active, display_order AS option_order, updated_at AS option_updated_at;
