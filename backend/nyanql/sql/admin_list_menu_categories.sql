SELECT
    mc.id,
    mc.name,
    mc.display_order,
    mc.active,
    COUNT(mi.id)::INTEGER AS item_count,
    mc.updated_at
FROM menu_categories mc
LEFT JOIN menu_items mi ON mi.category_id = mc.id
GROUP BY mc.id
ORDER BY display_order, name;
