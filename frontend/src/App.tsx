import { AnalyticsPage } from './pages/AnalyticsPage';
import { AdminMenuPage } from './pages/AdminMenuPage';
import { AdminAuditLogsPage } from './pages/AdminAuditLogsPage';
import { AdminOrdersPage } from './pages/AdminOrdersPage';
import { AdminTablesPage } from './pages/AdminTablesPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { CustomerOrderPage } from './pages/CustomerOrderPage';
import { HallPage } from './pages/HallPage';
import { KitchenPage } from './pages/KitchenPage';

export function App() {
  const path = window.location.pathname;
  if (path.startsWith('/customer/')) {
    return <CustomerOrderPage tableCode={decodeURIComponent(path.split('/')[2] || 'T01')} />;
  }
  if (path === '/kitchen') return <KitchenPage />;
  if (path === '/hall') return <HallPage />;
  if (path === '/checkout') return <CheckoutPage />;
  if (path === '/analytics') return <AnalyticsPage />;
  if (path === '/admin/menu') return <AdminMenuPage />;
  if (path === '/admin/tables') return <AdminTablesPage />;
  if (path === '/admin/orders') return <AdminOrdersPage />;
  if (path === '/admin/audit-logs') return <AdminAuditLogsPage />;
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
        <a href="/kitchen">キッチン</a>
        <a href="/hall">ホール</a>
        <a href="/checkout">レジ精算</a>
        <a href="/analytics">分析</a>
        <a href="/admin/menu">メニュー管理</a>
        <a href="/admin/tables">席・端末管理</a>
        <a href="/admin/orders">注文管理</a>
        <a href="/admin/audit-logs">操作ログ</a>
      </nav>
    </main>
  );
}
