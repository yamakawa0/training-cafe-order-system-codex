INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, payload)
VALUES (/*id*/'audit-dev', /*actor_type*/'system', /*actor_id*/'', /*action*/'dev.audit', /*target_type*/'dev', /*target_id*/'dev', CAST(/*payload*/'{}' AS jsonb))
RETURNING id, created_at;
