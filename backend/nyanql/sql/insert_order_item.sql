INSERT INTO order_items (
    id, order_id, menu_item_id, item_name, unit_price, quantity,
    kitchen_station, allergy_note, customer_note
)
VALUES (
    :id, :order_id, :menu_item_id, :item_name, :unit_price, :quantity,
    :kitchen_station, :allergy_note, :customer_note
)
RETURNING id, status, created_at;
