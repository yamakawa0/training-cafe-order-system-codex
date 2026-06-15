import { FormEvent, useState } from 'react';
import { cafeApi, terminals } from '../api/cafeApi';
import { AppHeader, Banner } from '../components/ui';
import { clearAuth, roleHome, storeAuth } from '../auth/authState';

const terminalOptions = [
  { value: terminals.analytics, label: '店長 PC' },
  { value: terminals.checkout, label: 'レジ端末' },
  { value: terminals.kitchen, label: 'キッチン端末' },
  { value: terminals.hall, label: 'ホール端末' }
];

export function LoginPage() {
  const [loginId, setLoginId] = useState('manager');
  const [password, setPassword] = useState('manager123');
  const [terminalCode, setTerminalCode] = useState(terminals.analytics);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    clearAuth();
    try {
      const data = await cafeApi.login({ loginId, password, terminalCode });
      storeAuth(data.token, data.user);
      window.location.href = roleHome(data.user.role);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ログインに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shell authShell">
      <AppHeader title="ログイン" subtitle="スタッフ認証" />
      {error && <Banner tone="danger">{error}</Banner>}
      <form className="panel authForm" onSubmit={submit}>
        <label>ログイン ID<input value={loginId} onChange={(event) => setLoginId(event.target.value)} /></label>
        <label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>端末<select value={terminalCode} onChange={(event) => setTerminalCode(event.target.value)}>
          {terminalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <button className="primary" disabled={loading}>{loading ? 'ログイン中' : 'ログイン'}</button>
      </form>
    </main>
  );
}
