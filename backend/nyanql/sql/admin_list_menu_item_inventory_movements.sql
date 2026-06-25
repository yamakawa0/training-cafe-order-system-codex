SELECT
    im.id,
    im.menu_item_id,
    mi.name AS item_name,
    im.movement_type,
    im.quantity_delta,
    im.quantity_before,
    im.quantity_after,
    im.reason,
    im.source_type,
    im.source_id,
    im.order_id,
    o.order_no,
    im.order_item_id,
    im.actor_user_id,
    im.actor_user_display_name,
    im.actor_user_role,
    im.actor_terminal_code,
    im.occurred_at,
    im.created_at
FROM inventory_movements im
JOIN menu_items mi ON mi.id = im.menu_item_id
LEFT JOIN orders o ON o.id = im.order_id
WHERE im.menu_item_id = /*item_id*/'item-admin'
  AND (COALESCE(/*movement_type*/'', '') = '' OR im.movement_type = /*movement_type*/'manual_adjust')
ORDER BY im.occurred_at DESC, im.id DESC
LIMIT LEAST(GREATEST(/*limit*/20, 1), 100)
OFFSET GREATEST(/*offset*/0, 0);
