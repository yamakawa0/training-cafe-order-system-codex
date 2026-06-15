import { useEffect, useState, type ReactNode } from 'react';
import { cafeApi } from '../api/cafeApi';
import { Banner } from '../components/ui';
import type { AuthUser, UserRole } from '../domain/types';
import { clearAuth, getStoredUser, hasAnyRole, storeAuth } from './authState';

export function AuthGate({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [checking, setChecking] = useState(Boolean(user));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void cafeApi.me().then((data) => {
      if (cancelled) return;
      storeAuth(localStorage.getItem('cafe.auth.token') || '', data.user);
      setUser(data.user);
    }).catch(() => {
      if (cancelled) return;
      clearAuth();
      setUser(null);
      setInvalid(true);
    }).finally(() => {
      if (!cancelled) setChecking(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (!user) {
    if (!invalid) window.location.replace('/login');
    return (
      <main className="shell">
        <Banner tone="warning">{invalid ? 'ログイン情報が無効です。再ログインしてください。' : 'ログイン画面へ移動しています。'}</Banner>
        <a className="button" href="/login">ログイン</a>
      </main>
    );
  }
  if (checking) {
    return (
      <main className="shell">
        <Banner>ログイン状態を確認しています。</Banner>
      </main>
    );
  }
  if (!hasAnyRole(user, roles)) {
    return (
      <main className="shell">
        <Banner tone="danger">この画面を利用する権限がありません。</Banner>
        <a className="button" href="/login">ログインし直す</a>
      </main>
    );
  }
  return <><AuthStatus />{children}</>;
}

export function AuthStatus() {
  const user = getStoredUser();
  if (!user) return null;
  return (
    <div className="authStatus">
      <span>{user.displayName}</span>
      <strong>{user.role}</strong>
      <button onClick={() => {
        void cafeApi.logout().finally(() => {
          clearAuth();
          window.location.href = '/login';
        });
      }}>ログアウト</button>
    </div>
  );
}
