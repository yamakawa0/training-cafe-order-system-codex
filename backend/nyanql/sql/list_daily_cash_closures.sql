SELECT *
FROM daily_cash_closures
WHERE (NULLIF(/*from_date*/'', '') IS NULL OR business_date >= /*from_date*/'2026-06-01'::date)
  AND (NULLIF(/*to_date*/'', '') IS NULL OR business_date <= /*to_date*/'2026-06-30'::date)
  AND (NULLIF(/*status*/'', '') IS NULL OR status = /*status*/'closed')
ORDER BY business_date DESC
LIMIT COALESCE(NULLIF(/*limit*/'50', '')::INTEGER, 50)
OFFSET COALESCE(NULLIF(/*offset*/'0', '')::INTEGER, 0);
