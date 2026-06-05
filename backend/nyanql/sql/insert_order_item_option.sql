INSERT INTO order_item_options (id, order_item_id, option_name, choice_name, price_delta)
VALUES (/*id*/'oio-dev', /*order_item_id*/'oi-dev', /*option_name*/'サイズ', /*choice_name*/'Regular', /*price_delta*/0)
RETURNING id;
