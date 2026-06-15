import { FormEvent, useEffect, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { getStoredUser } from '../auth/authState';
import { AppHeader, Badge, Banner, EmptyState, SectionTitle } from '../components/ui';
import type { AdminUser, UserRole } from '../domain/types';

const roles: UserRole[] = ['manager', 'cashier', 'kitchen', 'hall', 'viewer'];

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ login_id: '', display_name: '', password: '', role: 'viewer' as UserRole, active: true });
  const currentUser = getStoredUser();
  const activeManagerCount = users.filter((user) => user.role === 'manager' && user.active).length;

  const load = () => {
    setError('');
    void cafeApi.adminUsers(keyword).then((data) => setUsers(data.users)).catch((event: Error) => setError(event.message));
  };

  useEffect(load, [keyword]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await cafeApi.adminCreateUser(form);
      setForm({ login_id: '', display_name: '', password: '', role: 'viewer', active: true });
      setMessage('ユーザーを作成しました。');
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '作成に失敗しました。');
    }
  };

  const update = async (user: AdminUser, patch: Partial<AdminUser> & { password?: string }) => {
    const nextRole = patch.role ?? user.role;
    if (user.id === currentUser?.id && nextRole !== 'manager') {
      setError('自分自身の manager 権限は変更できません。');
      return;
    }
    if (user.role === 'manager' && user.active && nextRole !== 'manager' && activeManagerCount <= 1) {
      setError('最後の active manager は変更できません。');
      return;
    }
    setError('');
    setMessage('');
    try {
      await cafeApi.adminUpdateUser({
        id: user.id,
        display_name: patch.displayName ?? user.displayName,
        role: patch.role ?? user.role,
        password: patch.password
      });
      setMessage('ユーザーを更新しました。');
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '更新に失敗しました。');
    }
  };

  const toggleActive = async (user: AdminUser) => {
    if (user.role === 'manager' && user.active && activeManagerCount <= 1) {
      setError('最後の active manager は無効化できません。');
      return;
    }
    setError('');
    setMessage('');
    try {
      await cafeApi.adminToggleUserActive(user.id, !user.active);
      setMessage('有効状態を更新しました。');
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '更新に失敗しました。');
    }
  };

  return (
    <main className="shell adminUsers">
      <AppHeader title="ユーザー管理" subtitle={currentUser ? `${currentUser.displayName} / ${currentUser.role}` : 'manager only'} actions={(
        <>
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="検索" />
          <a className="button" href="/analytics">分析</a>
          <a className="button" href="/admin/audit-logs">操作ログ</a>
        </>
      )} />
      {error && <Banner tone="danger">{error}</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      <section className="adminUserGrid">
        <form className="panel adminUserForm" onSubmit={create}>
          <SectionTitle title="新規ユーザー" />
          <input value={form.login_id} onChange={(event) => setForm({ ...form, login_id: event.target.value })} placeholder="login_id" required />
          <input value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} placeholder="表示名" required />
          <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="初期パスワード" required />
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}>
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <button className="primary">作成</button>
        </form>
        <section className="panel">
          <SectionTitle title="ユーザー一覧" subtitle={`${users.length} 件`} />
          {users.length === 0 && <EmptyState>ユーザーがありません。</EmptyState>}
          <div className="userTable">
            {users.map((user) => (
              <div className="userRow" key={user.id}>
                <strong>{user.displayName}</strong>
                <span>{user.loginId}</span>
                <select
                  value={user.role}
                  disabled={user.id === currentUser?.id || (user.role === 'manager' && user.active && activeManagerCount <= 1)}
                  onChange={(event) => update(user, { role: event.target.value as UserRole })}
                >
                  {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                <Badge tone={user.active ? 'success' : 'danger'}>{user.active ? 'active' : 'inactive'}</Badge>
                <button onClick={() => {
                  const displayName = window.prompt('表示名', user.displayName);
                  if (displayName) void update(user, { displayName });
                }}>表示名</button>
                <button onClick={() => {
                  const password = window.prompt('新しいパスワード');
                  if (password) void update(user, { password });
                }}>PW</button>
                <button
                  disabled={user.role === 'manager' && user.active && activeManagerCount <= 1}
                  onClick={() => toggleActive(user)}
                >{user.active ? '無効化' : '有効化'}</button>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
