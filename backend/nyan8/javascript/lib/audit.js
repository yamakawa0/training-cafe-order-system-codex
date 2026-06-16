function jsonForAudit(value) {
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(sanitizeAuditValue(value));
  } catch (event) {
    return JSON.stringify({ serializationError: String(event) });
  }
}

function isSensitiveAuditKey(key) {
  return /password|session_token|sessionToken|token|authorization|cookie/i.test(String(key || ""));
}

function sanitizeAuditValue(value) {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) {
    return value.map(function(item) { return sanitizeAuditValue(item); });
  }
  if (typeof value === "object") {
    var sanitized = {};
    Object.keys(value).forEach(function(key) {
      sanitized[key] = isSensitiveAuditKey(key) ? "[masked]" : sanitizeAuditValue(value[key]);
    });
    return sanitized;
  }
  return value;
}

function auditLogDebug(message) {
  if (typeof console !== "undefined" && console && typeof console.log === "function") {
    console.log(message);
  }
}

function writeAuditLog(input) {
  try {
    input = input || {};
    var currentUser = null;
    if (!input.skipCurrentUser && typeof getCurrentUser === "function") currentUser = getCurrentUser();
    return nyanqlPost("audit-logs", {
      id: newId("audit"),
      actor_terminal_code: input.actorTerminalCode || "",
      actor_terminal_type: input.actorTerminalType || "",
      actor_user_id: input.actorUserId || (currentUser ? currentUser.id : ""),
      actor_user_display_name: input.actorUserDisplayName || (currentUser ? currentUser.displayName : ""),
      actor_user_role: input.actorUserRole || (currentUser ? currentUser.role : ""),
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId || "",
      target_label: input.targetLabel || "",
      status: input.status || "success",
      before_data: jsonForAudit(input.beforeData),
      after_data: jsonForAudit(input.afterData),
      request_data: jsonForAudit(input.requestData),
      error_message: input.errorMessage || ""
    });
  } catch (event) {
    auditLogDebug("audit log write failed: " + (event && event.message ? event.message : String(event)));
    return null;
  }
}

function auditFailure(input, action, targetType, targetId, targetLabel, event, beforeData) {
  writeAuditLog({
    actorTerminalCode: input && input.terminal_code,
    action: action,
    targetType: targetType,
    targetId: targetId || "",
    targetLabel: targetLabel || "",
    status: "failure",
    beforeData: beforeData || null,
    requestData: input || {},
    errorMessage: event && event.message ? event.message : String(event)
  });
}
