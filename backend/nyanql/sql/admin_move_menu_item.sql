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
    cost_price,
    (price - cost_price)::INTEGER AS gross_profit,
    CASE WHEN price = 0 THEN 0 ELSE ROUND(((price - cost_price)::numeric / price) * 100, 1) END AS gross_margin_rate,
    tax_rate,
    image_url,
    display_order,
    active,
    sold_out,
    track_stock,
    stock_quantity,
    low_stock_threshold,
    allergy_note,
    updated_at;
