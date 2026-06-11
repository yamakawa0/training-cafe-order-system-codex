UPDATE menu_items
SET
    display_order = GREATEST(0, display_order + CASE WHEN /*direction*/'up' = 'up' THEN -15 ELSE 15 END),
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*item_id*/'item-admin'
RETURNING
    id,
    category_id,
    (SELECT name FROM menu_categories WHERE id = menu_items.category_id) AS category_name,
    name,
    description,
    price,
    tax_rate,
    display_order,
    active,
    sold_out,
    allergy_note,
    updated_at;
