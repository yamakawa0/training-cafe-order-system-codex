SELECT
    o.id AS order_id,
    o.order_no,
    o.submitted_at,
    o.subtotal,
    o.tax_amount,
    o.total_amount,
    oi.id AS order_item_id,
    oi.item_name,
    oi.unit_price,
    oi.quantity,
    oi.status,
    oi.customer_note,
    COALESCE(
        STRING_AGG(oio.option_name || ': ' || oio.choice_name, ', ' ORDER BY oio.option_name),
        ''
    ) AS options_text
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN order_item_options oio ON oio.order_item_id = oi.id
WHERE o.session_id = :session_id
GROUP BY o.id, oi.id
ORDER BY o.submitted_at DESC, oi.created_at ASC;
