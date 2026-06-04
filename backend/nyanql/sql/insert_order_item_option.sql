INSERT INTO order_item_options (id, order_item_id, option_name, choice_name, price_delta)
VALUES (:id, :order_item_id, :option_name, :choice_name, :price_delta)
RETURNING id;
