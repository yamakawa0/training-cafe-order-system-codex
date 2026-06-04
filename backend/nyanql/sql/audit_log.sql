INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, payload)
VALUES (:id, :actor_type, :actor_id, :action, :target_type, :target_id, CAST(:payload AS jsonb))
RETURNING id, created_at;
