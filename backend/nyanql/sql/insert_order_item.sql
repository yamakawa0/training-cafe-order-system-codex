INSERT INTO order_items (
    id, order_id, menu_item_id, item_name, unit_price, quantity,
    kitchen_station, allergy_note, customer_note
)
VALUES (
    /*id*/'oi-dev', /*order_id*/'ord-dev', /*menu_item_id*/'item-blend', /*item_name*/'ブレンドコーヒー', /*unit_price*/450, /*quantity*/1,
    /*kitchen_station*/'drink', /*allergy_note*/'', /*customer_note*/''
)
RETURNING id, status, created_at;
