function params(request) {
  return { ...(request.query || {}), ...(request.params || {}) };
}

function body(request) {
  return request.body || {};
}

function ok(data, headers) {
  return { status: 200, headers: headers || {}, body: data };
}

module.exports = { params, body, ok };
