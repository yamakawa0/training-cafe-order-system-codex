INSERT INTO menu_option_choices (id, option_id, name, price_delta, active, display_order)
VALUES (
    /*id*/'choice-admin',
    /*option_id*/'opt-admin',
    /*name*/'Choice',
    /*price_delta*/0,
    /*active*/TRUE,
    /*display_order*/0
)
RETURNING id AS choice_id, option_id, name AS choice_name, price_delta, active AS choice_active, display_order AS choice_order, updated_at AS choice_updated_at;
