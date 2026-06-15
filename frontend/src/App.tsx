import { AnalyticsPage } from './pages/AnalyticsPage';
import { AdminMenuPage } from './pages/AdminMenuPage';
import { AdminAuditLogsPage } from './pages/AdminAuditLogsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminOrdersPage } from './pages/AdminOrdersPage';
import { AdminTablesPage } from './pages/AdminTablesPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { CustomerOrderPage } from './pages/CustomerOrderPage';
import { HallPage } from './pages/HallPage';
import { KitchenPage } from './pages/KitchenPage';
import { LoginPage } from './pages/LoginPage';
import { AuthGate } from './auth/AuthGate';

export function App() {
  const path = window.location.pathname;
  if (path.startsWith('/customer/')) {
    return <CustomerOrderPage tableCode={decodeURIComponent(path.split('/')[2] || 'T01')} />;
  }
  if (path === '/login') return <LoginPage />;
  if (path === '/kitchen') return <AuthGate roles={['kitchen', 'manager']}><KitchenPage /></AuthGate>;
  if (path === '/hall') return <AuthGate roles={['hall', 'manager']}><HallPage /></AuthGate>;
  if (path === '/checkout') return <AuthGate roles={['cashier', 'manager']}><CheckoutPage /></AuthGate>;
  if (path === '/analytics') return <AuthGate roles={['manager', 'viewer']}><AnalyticsPage /></AuthGate>;
  if (path === '/admin/menu') return <AuthGate roles={['manager']}><AdminMenuPage /></AuthGate>;
  if (path === '/admin/tables') return <AuthGate roles={['manager']}><AdminTablesPage /></AuthGate>;
  if (path === '/admin/orders') return <AuthGate roles={['manager']}><AdminOrdersPage /></AuthGate>;
  if (path === '/admin/audit-logs') return <AuthGate roles={['manager']}><AdminAuditLogsPage /></AuthGate>;
  if (path === '/admin/users') return <AuthGate roles={['manager']}><AdminUsersPage /></AuthGate>;
  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">カフェ・ルポ / Cafe Repos</p>
          <h1>端末を選択</h1>
        </div>
      </section>
      <nav className="launcher">
        <a href="/customer/T01">T01 顧客注文</a>
        <a href="/login">ログイン</a>
        <a href="/kitchen">キッチン</a>
        <a href="/hall">ホール</a>
        <a href="/checkout">レジ精算</a>
        <a href="/analytics">分析</a>
        <a href="/admin/menu">メニュー管理</a>
        <a href="/admin/tables">席・端末管理</a>
        <a href="/admin/orders">注文管理</a>
        <a href="/admin/audit-logs">操作ログ</a>
        <a href="/admin/users">ユーザー管理</a>
      </nav>
    </main>
  );
}
