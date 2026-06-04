UPDATE order_items
SET
    status = :status,
    accepted_at = CASE WHEN :status = 'accepted' THEN CURRENT_TIMESTAMP ELSE accepted_at END,
    cooking_started_at = CASE WHEN :status = 'cooking' THEN CURRENT_TIMESTAMP ELSE cooking_started_at END,
    ready_at = CASE WHEN :status = 'ready' THEN CURRENT_TIMESTAMP ELSE ready_at END,
    served_at = CASE WHEN :status = 'served' THEN CURRENT_TIMESTAMP ELSE served_at END,
    cancelled_at = CASE WHEN :status = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
    updated_at = CURRENT_TIMESTAMP
WHERE id = :order_item_id
RETURNING id, order_id, status, ready_at, served_at, cancelled_at;
