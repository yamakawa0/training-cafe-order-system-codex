SELECT
    mc.id AS category_id,
    mc.name AS category_name,
    mc.display_order AS category_order,
    mi.id AS item_id,
    mi.name AS item_name,
    mi.description,
    mi.price,
    mi.tax_rate,
    mi.image_url,
    mi.kitchen_station,
    mi.allergy_note,
    mi.sold_out,
    mi.display_order AS item_order,
    mio.id AS option_id,
    mio.name AS option_name,
    mio.required,
    mio.multi_select,
    mio.min_select,
    mio.max_select,
    mio.display_order AS option_order,
    moc.id AS choice_id,
    moc.name AS choice_name,
    moc.price_delta,
    moc.display_order AS choice_order
FROM menu_categories mc
JOIN menu_items mi ON mi.category_id = mc.id
LEFT JOIN menu_item_options mio ON mio.item_id = mi.id AND mio.active = TRUE
LEFT JOIN menu_option_choices moc ON moc.option_id = mio.id AND moc.active = TRUE
WHERE mc.active = TRUE
  AND mi.active = TRUE
ORDER BY mc.display_order, mi.display_order, mio.display_order, moc.display_order;
