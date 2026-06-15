import type { ReactNode } from 'react';
import { Banner } from '../components/ui';
import type { UserRole } from '../domain/types';
import { getStoredUser, hasAnyRole } from './authState';

export function AuthGate({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const user = getStoredUser();
  if (!user) {
    window.location.replace('/login');
    return <Banner tone="warning">ログイン画面へ移動しています。</Banner>;
  }
  if (!hasAnyRole(user, roles)) {
    return (
      <main className="shell">
        <Banner tone="danger">この画面を利用する権限がありません。</Banner>
        <a className="button" href="/login">ログインし直す</a>
      </main>
    );
  }
  return <>{children}</>;
}
