const DEFAULT_BASE_URL = 'http://localhost:8890';

function authHeaders() {
  const user = process.env.NYANQL_USER || 'nyanql';
  const password = process.env.NYANQL_PASSWORD || 'nyanql';
  return {
    Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
  };
}

function queryString(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function nyanql(method, path, payload) {
  const baseUrl = process.env.NYANQL_BASE_URL || DEFAULT_BASE_URL;
  const isGet = method.toUpperCase() === 'GET';
  const response = await fetch(`${baseUrl}${path}${isGet ? queryString(payload) : ''}`, {
    method,
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json'
    },
    body: isGet ? undefined : JSON.stringify(payload || {})
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw Object.assign(new Error(data?.message || `NyanQL request failed: ${path}`), { status: response.status });
  }
  return data;
}

function rows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.data)) return result.data;
  if (result === null || result === undefined) return [];
  return [result];
}

function first(result) {
  return rows(result)[0] || null;
}

module.exports = { nyanql, rows, first };
