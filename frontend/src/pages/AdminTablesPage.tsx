import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Badge, Banner, EmptyState, SectionTitle } from '../components/ui';
import { yen } from '../domain/money';
import type { AdminTableDetail, AdminTableSummary, AdminTerminalSummary } from '../domain/types';

const statusLabels: Record<string, string> = {
  available: '空席',
  occupied: '利用中',
  payment_requested: '会計依頼中',
  paid: '精算済み',
  cleaning: '片付け中',
  disabled: '使用停止',
  seated: '着席',
  ordering: '注文中',
  closed: '終了'
};

function statusLabel(status: string | null) {
  return status ? statusLabels[status] || status : '-';
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'available') return 'success';
  if (status === 'disabled') return 'danger';
  if (status === 'payment_requested' || status === 'cleaning') return 'warning';
  if (status === 'paid') return 'info';
  return 'neutral';
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ja-JP') : '-';
}

export function AdminTablesPage() {
  const [tables, setTables] = useState<AdminTableSummary[]>([]);
  const [terminals, setTerminals] = useState<AdminTerminalSummary[]>([]);
  const [selectedTableCode, setSelectedTableCode] = useState('');
  const [detail, setDetail] = useState<AdminTableDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedTable = useMemo(
    () => tables.find((table) => table.tableCode === selectedTableCode) || tables[0] || null,
    [tables, selectedTableCode]
  );

  const load = () => {
    setLoading(true);
    setError('');
    void Promise.all([
      cafeApi.adminTables({ status: statusFilter || undefined, keyword: keyword || undefined }),
      cafeApi.adminTerminals(keyword)
    ]).then(([tableData, terminalData]) => {
      setTables(tableData.tables);
      setTerminals(terminalData.terminals);
      const nextTableCode = selectedTableCode || tableData.tables[0]?.tableCode || '';
      setSelectedTableCode(nextTableCode);
      if (nextTableCode) {
        void cafeApi.adminTableDetail(nextTableCode).then((data) => setDetail(data.table)).catch(() => setDetail(null));
      } else {
        setDetail(null);
      }
    }).catch((event: Error) => setError(event.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (!selectedTableCode) return;
    void cafeApi.adminTableDetail(selectedTableCode).then((data) => setDetail(data.table)).catch((event: Error) => setError(event.message));
  }, [selectedTableCode]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setSaving(true);
    setError('');
    try {
      await action();
      setMessage(successMessage);
      await Promise.all([
        cafeApi.adminTables({ status: statusFilter || undefined, keyword: keyword || undefined }).then((data) => setTables(data.tables)),
        cafeApi.adminTerminals(keyword).then((data) => setTerminals(data.terminals))
      ]);
      if (selectedTableCode) {
        const data = await cafeApi.adminTableDetail(selectedTableCode);
        setDetail(data.table);
      }
    } catch (event) {
      setError(event instanceof Error ? event.message : '操作に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  function forceClose() {
    if (!detail?.currentSessionId) return;
    const ok = window.confirm(`${detail.tableCode} の現在セッションを強制クローズします。未精算注文がある場合は拒否されます。`);
    if (!ok) return;
    void runAction(() => cafeApi.adminForceCloseSession(detail.currentSessionId as string), 'セッションを強制クローズしました。');
  }

  function setAvailable() {
    if (!selectedTable) return;
    const needsConfirm = Boolean(selectedTable.currentSessionId);
    if (needsConfirm && !window.confirm(`${selectedTable.tableCode} には現在セッションがあります。空席化を試行しますか。`)) return;
    void runAction(() => cafeApi.adminUpdateTableStatus(selectedTable.tableCode, 'available'), '席を空席にしました。');
  }

  return (
    <main className="shell adminTables">
      <AppHeader
        title="席・端末管理"
        subtitle="店長 PC"
        actions={(
          <div className="adminTableTools">
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="席・端末を検索" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">全状態</option>
              <option value="available">空席</option>
              <option value="occupied">利用中</option>
              <option value="payment_requested">会計依頼中</option>
              <option value="paid">精算済み</option>
              <option value="cleaning">片付け中</option>
              <option value="disabled">使用停止</option>
            </select>
            <a className="button" href="/admin/menu">メニュー管理</a>
            <a className="button" href="/admin/orders">注文管理</a>
            <a className="button" href="/admin/audit-logs">操作ログ</a>
            <button className="primary" onClick={load}>更新</button>
          </div>
        )}
      />
      {loading && <Banner>席・端末データを読み込み中です。</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <section className="adminTablesGrid">
        <aside className="panel tableCardList">
          <SectionTitle title="席一覧" subtitle={`${tables.length} 席`} />
          {tables.length === 0 && !loading && <EmptyState>条件に一致する席はありません。</EmptyState>}
          {tables.map((table) => (
            <button className={table.tableCode === selectedTableCode ? 'tableAdminCard selected' : 'tableAdminCard'} key={table.tableId} onClick={() => setSelectedTableCode(table.tableCode)}>
              <span>
                <strong>{table.tableCode}</strong>
                <small>{table.tableName}</small>
              </span>
              <Badge tone={statusTone(table.status)}>{statusLabel(table.status)}</Badge>
              <small>{table.customerTerminalCode || '端末なし'} / 注文 {table.orderCount}</small>
              <small>未提供 {table.unservedItemCount} / タスク {table.openTaskCount}</small>
            </button>
          ))}
        </aside>
        <section className="panel tableDetailPanel">
          <SectionTitle title={detail ? `${detail.tableCode} ${detail.tableName}` : '席詳細'} subtitle={detail ? `最終更新 ${formatDate(detail.updatedAt)}` : ''} />
          {!detail && <EmptyState>席を選択してください。</EmptyState>}
          {detail && (
            <>
              <div className="detailMetricGrid">
                <div><span>席状態</span><strong>{statusLabel(detail.status)}</strong></div>
                <div><span>顧客端末</span><strong>{detail.customerTerminalCode || '-'}</strong></div>
                <div><span>セッション</span><strong>{detail.currentSessionId || '-'}</strong></div>
                <div><span>セッション状態</span><strong>{statusLabel(detail.sessionStatus)}</strong></div>
                <div><span>注文数</span><strong>{detail.orderCount}</strong></div>
                <div><span>未精算注文</span><strong>{detail.unpaidOrderCount}</strong></div>
                <div><span>未提供明細</span><strong>{detail.unservedItemCount}</strong></div>
                <div><span>未完了タスク</span><strong>{detail.openTaskCount}</strong></div>
              </div>
              <div className="adminActionBar">
                <button disabled={saving} onClick={setAvailable}>空席にする</button>
                <button className="dangerButton" disabled={saving} onClick={() => void runAction(() => cafeApi.adminUpdateTableStatus(detail.tableCode, 'disabled'), '席を使用停止にしました。')}>使用停止</button>
                <button className="primary" disabled={saving || !detail.currentSessionId} onClick={forceClose}>セッション強制クローズ</button>
              </div>
              <SectionTitle title="現在の注文一覧" subtitle={`開始 ${formatDate(detail.sessionOpenedAt)}`} />
              <div className="adminLines">
                {detail.orders.length === 0 && <EmptyState>現在注文はありません。</EmptyState>}
                {detail.orders.map((order) => (
                  <div className="adminLine" key={order.orderId}>
                    <strong>{order.orderNo}</strong>
                    <span>{statusLabel(order.status)} / {yen(order.totalAmount)}</span>
                    <small>{formatDate(order.submittedAt)}</small>
                  </div>
                ))}
              </div>
              <SectionTitle title="未提供明細" />
              <div className="adminLines">
                {detail.orderItems.filter((item) => !['served', 'cancelled'].includes(item.status)).length === 0 && <EmptyState>未提供明細はありません。</EmptyState>}
                {detail.orderItems.filter((item) => !['served', 'cancelled'].includes(item.status)).map((item) => (
                  <div className="adminLine" key={item.orderItemId}>
                    <strong>{item.itemName} x {item.quantity}</strong>
                    <span>{statusLabel(item.status)} / {item.orderNo}</span>
                    {item.allergyNote && <small>アレルギー: {item.allergyNote}</small>}
                  </div>
                ))}
              </div>
              <SectionTitle title="支払い情報" />
              <div className="adminLines">
                {detail.payments.length === 0 && <EmptyState>支払い情報はありません。</EmptyState>}
                {detail.payments.map((payment) => (
                  <div className="adminLine" key={payment.paymentId}>
                    <strong>{payment.paymentNo}</strong>
                    <span>{payment.method} / {yen(payment.totalAmount)}</span>
                    <small>{formatDate(payment.paidAt)}</small>
                  </div>
                ))}
              </div>
              <SectionTitle title="関連ホールタスク" />
              <div className="adminLines">
                {detail.hallTasks.length === 0 && <EmptyState>関連タスクはありません。</EmptyState>}
                {detail.hallTasks.map((task) => (
                  <div className="adminLine" key={task.taskId}>
                    <strong>{task.title}</strong>
                    <span>{task.taskType} / {statusLabel(task.status)}</span>
                    <small>{task.note || formatDate(task.createdAt)}</small>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
        <aside className="panel terminalPanel">
          <SectionTitle title="端末一覧" subtitle={`${terminals.length} 台`} />
          <div className="terminalList">
            {terminals.map((terminal) => {
              const protectedTerminal = terminal.terminalCode === 'analytics-manager';
              const warnsCore = ['kitchen-main', 'hall-main', 'checkout-main'].includes(terminal.terminalCode);
              return (
                <div className="terminalCard" key={terminal.terminalId}>
                  <div>
                    <strong>{terminal.terminalCode}</strong>
                    <span>{terminal.terminalType} / {terminal.tableCode || '-'}</span>
                    <small>{terminal.description || '-'} / {formatDate(terminal.updatedAt)}</small>
                    {warnsCore && <small className="warningText">無効化すると主要業務端末が停止します。</small>}
                  </div>
                  <Badge tone={terminal.active ? 'success' : 'danger'}>{terminal.active ? '有効' : '無効'}</Badge>
                  <button
                    disabled={saving || protectedTerminal}
                    onClick={() => void runAction(() => cafeApi.adminUpdateTerminalActive(terminal.terminalCode, !terminal.active), terminal.active ? '端末を無効化しました。' : '端末を有効化しました。')}
                  >
                    {terminal.active ? '無効化' : '有効化'}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>
      </section>
    </main>
  );
}
