SELECT
    COALESCE(SUM(p.total_amount), 0)::INTEGER AS sales_total,
    COUNT(p.id)::INTEGER AS payment_count,
    CASE WHEN COUNT(p.id) = 0 THEN 0 ELSE ROUND(AVG(p.total_amount))::INTEGER END AS average_spend,
    COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.total_amount ELSE 0 END), 0)::INTEGER AS cash_total,
    COALESCE(SUM(CASE WHEN p.method = 'card' THEN p.total_amount ELSE 0 END), 0)::INTEGER AS card_total,
    COALESCE(SUM(CASE WHEN p.method = 'qr' THEN p.total_amount ELSE 0 END), 0)::INTEGER AS qr_total,
    COUNT(CASE WHEN p.method = 'cash' THEN 1 END)::INTEGER AS cash_count,
    COUNT(CASE WHEN p.method = 'card' THEN 1 END)::INTEGER AS card_count,
    COUNT(CASE WHEN p.method = 'qr' THEN 1 END)::INTEGER AS qr_count,
    COALESCE((
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (ready_at - cooking_started_at))))::INTEGER
        FROM order_items
        WHERE ready_at IS NOT NULL
          AND cooking_started_at IS NOT NULL
          AND created_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date
    ), 0)::INTEGER AS average_cooking_seconds,
    COUNT(DISTINCT p.session_id)::INTEGER AS table_turns
FROM payments p
WHERE p.status = 'paid'
  AND p.paid_at::date BETWEEN /*from_date*/'2026-06-05'::date AND /*to_date*/'2026-06-05'::date;
