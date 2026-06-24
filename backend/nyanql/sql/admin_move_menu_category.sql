UPDATE menu_categories
SET
    display_order = GREATEST(0, display_order + CASE WHEN /*direction*/'up' = 'up' THEN -15 ELSE 15 END),
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*category_id*/'cat-admin'
RETURNING
    id,
    name,
    display_order,
    active,
    (SELECT COUNT(*)::INTEGER FROM menu_items WHERE category_id = menu_categories.id) AS item_count,
    updated_at;
