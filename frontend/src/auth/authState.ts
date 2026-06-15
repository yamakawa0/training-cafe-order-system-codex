import type { AuthUser, UserRole } from '../domain/types';

const tokenKey = 'cafe.auth.token';
const userKey = 'cafe.auth.user';

export function getAuthToken() {
  return window.localStorage.getItem(tokenKey) || '';
}

export function getStoredUser(): AuthUser | null {
  const raw = window.localStorage.getItem(userKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function storeAuth(token: string, user: AuthUser) {
  window.localStorage.setItem(tokenKey, token);
  window.localStorage.setItem(userKey, JSON.stringify(user));
}

export function clearAuth() {
  window.localStorage.removeItem(tokenKey);
  window.localStorage.removeItem(userKey);
}

export function roleHome(role: UserRole) {
  if (role === 'cashier') return '/checkout';
  if (role === 'kitchen') return '/kitchen';
  if (role === 'hall') return '/hall';
  return '/analytics';
}

export function hasAnyRole(user: AuthUser | null, roles: UserRole[]) {
  return Boolean(user && roles.includes(user.role));
}
