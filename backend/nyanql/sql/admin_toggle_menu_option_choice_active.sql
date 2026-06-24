UPDATE menu_option_choices
SET
    active = COALESCE(/*active*/TRUE, NOT active),
    updated_at = CURRENT_TIMESTAMP
WHERE id = /*choice_id*/'choice-admin'
RETURNING id AS choice_id, option_id, name AS choice_name, price_delta, active AS choice_active, display_order AS choice_order, updated_at AS choice_updated_at;
