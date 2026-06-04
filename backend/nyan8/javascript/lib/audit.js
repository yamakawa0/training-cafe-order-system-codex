const { newId } = require('./ids');
const { nyanql } = require('./nyanql_client');

async function audit({ actorType, actorId, action, targetType, targetId, payload }) {
  await nyanql('POST', '/audit-logs', {
    id: newId('audit'),
    actor_type: actorType,
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    payload: JSON.stringify(payload || {})
  });
}

module.exports = { audit };
