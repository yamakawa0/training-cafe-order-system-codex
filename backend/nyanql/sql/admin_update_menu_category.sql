UPDATE menu_categories
SET
    name = /*name*/'Category',
    display_order = /*display_order*/0,
    active = /*active*/TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*category_id*/'cat-admin'
RETURNING
    id,
    name,
    display_order,
    active,
    (SELECT COUNT(*)::INTEGER FROM menu_items WHERE category_id = menu_categories.id) AS item_count,
    updated_at;
