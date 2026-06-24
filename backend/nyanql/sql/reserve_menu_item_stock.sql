UPDATE menu_items
SET
    stock_quantity = stock_quantity - /*quantity*/1,
    sold_out = CASE WHEN stock_quantity - /*quantity*/1 = 0 THEN TRUE ELSE sold_out END,
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*item_id*/'item-admin'
  AND active = TRUE
  AND sold_out = FALSE
  AND track_stock = TRUE
  AND stock_quantity >= /*quantity*/1
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
