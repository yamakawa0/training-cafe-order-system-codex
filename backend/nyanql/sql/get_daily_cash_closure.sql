SELECT *
FROM daily_cash_closures
WHERE business_date = /*business_date*/'2026-06-25'::date
   OR id = NULLIF(/*id*/'', '')
ORDER BY business_date DESC
LIMIT 1;
