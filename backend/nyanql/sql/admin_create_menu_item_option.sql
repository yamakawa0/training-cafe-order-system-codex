INSERT INTO menu_item_options (id, item_id, name, required, multi_select, min_select, max_select, active, display_order)
VALUES (
    /*id*/'opt-admin',
    /*item_id*/'item-admin',
    /*name*/'Option',
    /*required*/FALSE,
    /*multi_select*/FALSE,
    /*min_select*/0,
    /*max_select*/NULL,
    /*active*/TRUE,
    /*display_order*/0
)
RETURNING id AS option_id, item_id, name AS option_name, required, multi_select, min_select, max_select, active AS option_active, display_order AS option_order, updated_at AS option_updated_at;
