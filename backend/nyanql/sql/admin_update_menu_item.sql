UPDATE menu_items
SET
    name = /*name*/'商品名',
    description = COALESCE(/*description*/'', ''),
    price = /*price*/0,
    tax_rate = /*tax_rate*/10,
    category_id = /*category_id*/'cat-coffee',
    display_order = /*display_order*/0,
    active = /*active*/TRUE,
    sold_out = /*sold_out*/FALSE,
    allergy_note = COALESCE(/*allergy_note*/'', ''),
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
