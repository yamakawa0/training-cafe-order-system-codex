function sha256(text) {
  if (typeof nyanHash === "function") return nyanHash("sha256", String(text));
  if (typeof require === "function") {
    try {
      return require("crypto").createHash("sha256").update(String(text)).digest("hex");
    } catch (event) {}
  }
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

function bearerToken() {
  var input = params();
  if (input.token) return String(input.token);
  var header = String(authHeaderValue() || "");
  var match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
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

function getCurrentUser() {
  var token = bearerToken();
  if (!token) return null;
  var session = first(nyanqlGet("auth/sessions/current", { session_token: token }));
  if (!session) return null;
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
  if (!user || !Boolean(user.active) || user.password_hash !== sha256(input.password)) {
    throw error(401, "ログインIDまたはパスワードが違います");
  }
  var token = newId("tok") + "-" + Math.random().toString(36).slice(2, 12);
  nyanqlPost("auth/sessions", {
    id: newId("session"),
    user_id: user.id,
    session_token: token,
    terminal_code: input.terminalCode,
    expires_seconds: 28800
  });
  return ok({ token: token, user: userDto(user) });
}

function authLogout() {
  var token = bearerToken();
  if (token) nyanqlPost("auth/sessions/delete", { session_token: token });
  return ok({ loggedOut: true });
}

function authMe() {
  return ok({ user: requireLogin() });
}
