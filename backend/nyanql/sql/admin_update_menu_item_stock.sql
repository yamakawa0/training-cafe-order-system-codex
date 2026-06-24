UPDATE menu_items
SET
    track_stock = COALESCE(/*track_stock*/FALSE, FALSE),
    stock_quantity = GREATEST(0, /*stock_quantity*/0),
    low_stock_threshold = GREATEST(0, /*low_stock_threshold*/0),
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
    track_stock,
    stock_quantity,
    low_stock_threshold,
    allergy_note,
    updated_at;
