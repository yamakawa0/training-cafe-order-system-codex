var AUTH_COOKIE_NAME = "cafe_session";
var AUTH_SESSION_SECONDS = 28800;
var AUTH_LOCK_THRESHOLD = 5;
var AUTH_LOCK_SECONDS = 300;
var AUTH_HASH_VERSION = "pbkdf2_sha256_v1";
var AUTH_FALLBACK_HASH_VERSION = "salted_sha256_v1";

function cryptoModule() {
  if (typeof require === "function") {
    try {
      return require("crypto");
    } catch (event) {}
  }
  return null;
}

function sha256(text) {
  var crypto = cryptoModule();
  if (typeof nyanHash === "function") return nyanHash("sha256", String(text));
  if (crypto) return crypto.createHash("sha256").update(String(text)).digest("hex");
  return sha256Fallback(String(text));
}

function sha256Fallback(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var result = "";
  var words = [];
  var asciiBitLength = ascii.length * 8;
  var hash = [];
  var k = [];
  var primeCounter = 0;
  var isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (var i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while (ascii.length % 64 - 56) ascii += "\x00";
  for (var j = 0; j < ascii.length; j++) {
    words[j >> 2] |= ascii.charCodeAt(j) << ((3 - j) % 4) * 8;
  }
  words[words.length] = ((asciiBitLength / maxWord) | 0);
  words[words.length] = asciiBitLength;
  for (var start = 0; start < words.length;) {
    var w = words.slice(start, start += 16);
    var oldHash = hash.slice(0);
    for (var round = 0; round < 64; round++) {
      var w15 = w[round - 15];
      var w2 = w[round - 2];
      var a = hash[0];
      var e = hash[4];
      var temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[round]
        + (w[round] = round < 16 ? w[round] : (w[round - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[round - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (var h = 0; h < 8; h++) hash[h] = (hash[h] + oldHash[h]) | 0;
  }
  for (var part = 0; part < 8; part++) {
    for (var byte = 3; byte + 1; byte--) {
      var b = (hash[part] >> (byte * 8)) & 255;
      result += ((b < 16) ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

function authHeaderValue() {
  var input = params();
  return input.authorization || input.Authorization || input.http_authorization || input.HTTP_AUTHORIZATION || "";
}

function cookieHeaderValue() {
  var input = params();
  return input.cookie || input.Cookie || input.http_cookie || input.HTTP_COOKIE || "";
}

function cookieToken() {
  var direct = params()[AUTH_COOKIE_NAME];
  if (direct) return String(direct);
  var header = String(cookieHeaderValue() || "");
  var pairs = header.split(";");
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].trim();
    if (pair.indexOf(AUTH_COOKIE_NAME + "=") === 0) return decodeURIComponent(pair.slice(AUTH_COOKIE_NAME.length + 1));
  }
  return "";
}

function bearerToken() {
  var input = params();
  if (input.token) return String(input.token);
  var header = String(authHeaderValue() || "");
  var match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function getSessionToken() {
  return cookieToken() || bearerToken();
}

function userDto(row) {
  return {
    id: row.user_id || row.id,
    loginId: row.login_id,
    displayName: row.display_name,
    role: row.role,
    active: Boolean(row.active)
  };
}

function sessionAudit(action, status, row, message) {
  writeAuditLog({
    skipCurrentUser: true,
    actorTerminalCode: row && row.terminal_code,
    actorUserId: row && row.user_id,
    actorUserDisplayName: row && row.display_name,
    actorUserRole: row && row.role,
    action: action,
    targetType: "auth_session",
    targetId: row && row.id,
    targetLabel: row && row.login_id,
    status: status,
    requestData: {
      login_id: row && row.login_id,
      terminal_code: row && row.terminal_code,
      user_agent: requestUserAgent()
    },
    errorMessage: message || ""
  });
}

function getCurrentUser() {
  var token = getSessionToken();
  if (!token) return null;
  var session = first(nyanqlGet("auth/sessions/current", { session_token: token }));
  if (!session) {
    var raw = first(nyanqlGet("auth/sessions/raw", { session_token: token }));
    if (raw) {
      var now = new Date();
      if (raw.revoked_at) sessionAudit("auth_session_revoked", "failure", raw, "session revoked");
      else if (raw.expires_at && new Date(raw.expires_at).getTime() <= now.getTime()) sessionAudit("auth_session_expired", "failure", raw, "session expired");
    }
    return null;
  }
  return userDto(session);
}

function requireLogin() {
  var user = getCurrentUser();
  if (!user) throw error(401, "ログインが必要です");
  return user;
}

function requireRole(allowedRoles) {
  var user = requireLogin();
  if (allowedRoles.indexOf(user.role) < 0) throw error(403, "権限がありません");
  return user;
}

function requireManager() {
  return requireRole(["manager"]);
}

function randomHex(bytes) {
  var crypto = cryptoModule();
  if (crypto && crypto.randomBytes) return crypto.randomBytes(bytes).toString("hex");
  return sha256(newId("rnd") + ":" + Math.random() + ":" + new Date().toISOString()).slice(0, bytes * 2);
}

function timingSafeEqualText(a, b) {
  a = String(a || "");
  b = String(b || "");
  var crypto = cryptoModule();
  if (crypto && crypto.timingSafeEqual) {
    var left = Buffer.from(a);
    var right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  }
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hashPassword(password) {
  var salt = randomHex(16);
  var iterations = 210000;
  var crypto = cryptoModule();
  if (crypto && crypto.pbkdf2Sync) {
    var digest = crypto.pbkdf2Sync(String(password), salt, iterations, 32, "sha256").toString("hex");
    return AUTH_HASH_VERSION + "$" + iterations + "$" + salt + "$" + digest;
  }
  return AUTH_FALLBACK_HASH_VERSION + "$" + salt + "$" + sha256(salt + ":" + String(password));
}

function passwordHashVersion(passwordHash) {
  return String(passwordHash || "").split("$")[0] || AUTH_FALLBACK_HASH_VERSION;
}

function verifyPassword(password, passwordHash) {
  passwordHash = String(passwordHash || "");
  var parts = passwordHash.split("$");
  var crypto = cryptoModule();
  if (parts[0] === AUTH_HASH_VERSION && parts.length === 4 && crypto && crypto.pbkdf2Sync) {
    var digest = crypto.pbkdf2Sync(String(password), parts[2], Number(parts[1]), 32, "sha256").toString("hex");
    return timingSafeEqualText(digest, parts[3]);
  }
  if (parts[0] === "salted_sha256_v1" && parts.length === 3) {
    return timingSafeEqualText(sha256(parts[1] + ":" + String(password)), parts[2]);
  }
  return timingSafeEqualText(sha256(password), passwordHash);
}

function requestUserAgent() {
  var input = params();
  return input.user_agent || input.User_Agent || input.http_user_agent || input.HTTP_USER_AGENT || "";
}

function cookieExpires(expiresAt) {
  var date = expiresAt ? new Date(expiresAt) : new Date(Date.now() + AUTH_SESSION_SECONDS * 1000);
  return date.toUTCString();
}

function sessionCookieValue(token, expiresAt) {
  return AUTH_COOKIE_NAME + "=" + encodeURIComponent(token) + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + AUTH_SESSION_SECONDS + "; Expires=" + cookieExpires(expiresAt);
}

function expiredSessionCookieValue() {
  return AUTH_COOKIE_NAME + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

function withHeaders(response, headers) {
  response.headers = headers;
  return response;
}

function setSessionCookie(response, token, expiresAt) {
  return withHeaders(response, { "Set-Cookie": sessionCookieValue(token, expiresAt) });
}

function clearSessionCookie(response) {
  return withHeaders(response, { "Set-Cookie": expiredSessionCookieValue() });
}

function authAudit(action, status, input, user, message, afterData) {
  writeAuditLog({
    skipCurrentUser: true,
    actorTerminalCode: input.terminalCode || input.terminal_code || "",
    actorUserId: user && user.id,
    actorUserDisplayName: user && user.display_name,
    actorUserRole: user && user.role,
    action: action,
    targetType: "auth_user",
    targetId: user && user.id,
    targetLabel: input.loginId || input.login_id || "",
    status: status,
    afterData: afterData || null,
    requestData: {
      login_id: input.loginId || input.login_id || "",
      terminal_code: input.terminalCode || input.terminal_code || "",
      user_agent: requestUserAgent()
    },
    errorMessage: message || ""
  });
}

function assertRoleTerminal(input, user, expectedType) {
  requireField(input.terminal_code, "terminal_code");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  assertTerminal(terminal, expectedType);
  return terminal;
}

function authLogin() {
  var input = params();
  requireField(input.loginId, "loginId");
  requireField(input.password, "password");
  requireField(input.terminalCode, "terminalCode");
  var user = first(nyanqlGet("auth/users/by-login-id", { login_id: input.loginId }));
  var genericMessage = "ログインIDまたはパスワードが違います";
  if (user && user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    authAudit("auth_user_locked", "failure", input, user, "account temporarily locked");
    throw error(401, genericMessage);
  }
  if (!user || !Boolean(user.active) || !verifyPassword(input.password, user.password_hash)) {
    if (user) {
      var failure = first(nyanqlPost("auth/users/login-failure", {
        login_id: input.loginId,
        lock_threshold: AUTH_LOCK_THRESHOLD,
        lock_seconds: AUTH_LOCK_SECONDS
      }));
      authAudit(failure && failure.locked_until ? "auth_user_locked" : "auth_login_failed", "failure", input, user, genericMessage, {
        failed_login_count: failure && failure.failed_login_count,
        locked_until: failure && failure.locked_until
      });
    } else {
      authAudit("auth_login_failed", "failure", input, null, genericMessage);
    }
    throw error(401, "ログインIDまたはパスワードが違います");
  }
  first(nyanqlPost("auth/users/login-success", { user_id: user.id }));
  var token = "tok-" + randomHex(32);
  var session = first(nyanqlPost("auth/sessions", {
    id: newId("session"),
    user_id: user.id,
    session_token: token,
    terminal_code: input.terminalCode,
    user_agent: requestUserAgent(),
    expires_seconds: AUTH_SESSION_SECONDS
  }));
  authAudit("auth_login_succeeded", "success", input, user, "", {
    session_id: session && session.id,
    expires_at: session && session.expires_at
  });
  return setSessionCookie(ok({ user: userDto(user), expiresAt: session && session.expires_at }), token, session && session.expires_at);
}

function authLogout() {
  var token = getSessionToken();
  if (token) {
    var session = first(nyanqlPost("auth/sessions/delete", { session_token: token }));
    if (session) sessionAudit("auth_logout", "success", session, "");
  }
  return clearSessionCookie(ok({ loggedOut: true }));
}

function authMe() {
  return ok({ user: requireLogin() });
}
