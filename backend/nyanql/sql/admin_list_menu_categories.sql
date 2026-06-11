SELECT
    id,
    name,
    display_order,
    active,
    updated_at
FROM menu_categories
ORDER BY display_order, name;
