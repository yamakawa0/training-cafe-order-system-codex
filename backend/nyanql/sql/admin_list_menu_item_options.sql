SELECT
    mio.id AS option_id,
    mio.item_id,
    mio.name AS option_name,
    mio.required,
    mio.multi_select,
    mio.min_select,
    mio.max_select,
    mio.active AS option_active,
    mio.display_order AS option_order,
    mio.updated_at AS option_updated_at,
    moc.id AS choice_id,
    moc.name AS choice_name,
    moc.price_delta,
    moc.active AS choice_active,
    moc.display_order AS choice_order,
    moc.updated_at AS choice_updated_at
FROM menu_item_options mio
LEFT JOIN menu_option_choices moc ON moc.option_id = mio.id
WHERE mio.item_id = /*item_id*/'item-admin'
ORDER BY mio.display_order, mio.name, moc.display_order, moc.name;
