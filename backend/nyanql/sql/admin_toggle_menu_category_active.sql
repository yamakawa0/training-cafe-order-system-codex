UPDATE menu_categories
SET
    active = COALESCE(/*active*/TRUE, NOT active),
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*category_id*/'cat-admin'
RETURNING
    id,
    name,
    display_order,
    active,
    (SELECT COUNT(*)::INTEGER FROM menu_items WHERE category_id = menu_categories.id) AS item_count,
    updated_at;
