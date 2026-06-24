INSERT INTO menu_categories (id, name, display_order, active)
VALUES (
    /*id*/'cat-admin',
    /*name*/'Category',
    /*display_order*/0,
    /*active*/TRUE
)
RETURNING id, name, display_order, active, 0::INTEGER AS item_count, updated_at;
