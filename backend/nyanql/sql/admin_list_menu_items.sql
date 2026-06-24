SELECT
    mi.id,
    mi.category_id,
    mc.name AS category_name,
    mi.name,
    mi.description,
    mi.price,
    mi.tax_rate,
    mi.image_url,
    mi.display_order,
    mi.active,
    mi.sold_out,
    mi.track_stock,
    mi.stock_quantity,
    mi.low_stock_threshold,
    mi.allergy_note,
    mi.updated_at
FROM menu_items mi
JOIN menu_categories mc ON mc.id = mi.category_id
WHERE (NULLIF(/*category_id*/'', '') IS NULL OR mi.category_id = NULLIF(/*category_id*/'', ''))
  AND (
      NULLIF(/*keyword*/'', '') IS NULL
      OR mi.name ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
      OR mi.description ILIKE '%' || NULLIF(/*keyword*/'', '') || '%'
  )
  AND (NULLIF(/*active*/'', '') IS NULL OR mi.active = (NULLIF(/*active*/'', ''))::boolean)
  AND (NULLIF(/*sold_out*/'', '') IS NULL OR mi.sold_out = (NULLIF(/*sold_out*/'', ''))::boolean)
ORDER BY mc.display_order, mi.display_order, mi.name;
