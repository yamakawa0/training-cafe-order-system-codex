import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Badge, Banner, EmptyState, SectionTitle } from '../components/ui';
import type { AuditLogDetail, AuditLogSummary } from '../domain/types';

const actionLabels: Record<string, string> = {
  admin_order_item_cancelled: '明細キャンセル',
  admin_order_cancelled: '注文全体キャンセル',
  admin_menu_item_created: '商品追加',
  admin_menu_item_updated: '商品編集',
  admin_menu_item_active_changed: '商品表示切替',
  admin_menu_item_sold_out_changed: '商品売切切替',
  admin_menu_item_moved: '商品並び順変更',
  admin_table_status_changed: '席ステータス変更',
  admin_session_force_closed: 'セッション強制クローズ',
  admin_terminal_active_changed: '端末有効切替',
  checkout_settled: '精算完了',
  checkout_settle_rejected: '精算拒否',
  customer_order_submitted: '注文確定',
  customer_payment_requested: '会計依頼',
  customer_staff_called: 'スタッフ呼び出し'
};

const targetLabels: Record<string, string> = {
  order: '注文',
  order_item: '注文明細',
  menu_item: '商品',
  table: '席',
  session: 'セッション',
  terminal: '端末',
  payment: '精算',
  hall_task: 'ホールタスク'
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ja-JP') : '-';
}

function labelOf(source: Record<string, string>, value: string) {
  return source[value] || value;
}

function jsonText(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return JSON.stringify(value, null, 2);
}

export function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogSummary[]>([]);
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [actorTerminalCode, setActorTerminalCode] = useState('');
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selected = useMemo(
    () => logs.find((log) => log.id === selectedId) || logs[0] || null,
    [logs, selectedId]
  );

  const loadDetail = async (id: string) => {
    const data = await cafeApi.adminAuditLogDetail(id);
    setDetail(data.log);
  };

  const load = () => {
    setLoading(true);
    setError('');
    void cafeApi.adminAuditLogs({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      action: action || undefined,
      targetType: targetType || undefined,
      actorTerminalCode: actorTerminalCode || undefined,
      status: status || undefined,
      keyword: keyword || undefined
    }).then(async (data) => {
      setLogs(data.logs);
      const nextId = selectedId && data.logs.some((log) => log.id === selectedId) ? selectedId : data.logs[0]?.id || '';
      setSelectedId(nextId);
      if (nextId) await loadDetail(nextId);
      else setDetail(null);
    }).catch((event: Error) => setError(event.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [fromDate, toDate, action, targetType, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250);
    return () => window.clearTimeout(timer);
  }, [actorTerminalCode, keyword]);

  useEffect(() => {
    if (!selected?.id) return;
    void loadDetail(selected.id).catch((event: Error) => setError(event.message));
  }, [selected?.id]);

  return (
    <main className="shell adminAuditLogs">
      <AppHeader
        title="操作ログ"
        subtitle="店長 PC"
        actions={(
          <div className="auditFilters">
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            <select value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">全操作</option>
              {Object.entries(actionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <select value={targetType} onChange={(event) => setTargetType(event.target.value)}>
              <option value="">全対象</option>
              {Object.entries(targetLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全結果</option>
              <option value="success">成功</option>
              <option value="failure">失敗</option>
            </select>
            <input value={actorTerminalCode} onChange={(event) => setActorTerminalCode(event.target.value)} placeholder="端末コード" />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="キーワード" />
            <a className="button" href="/analytics">分析</a>
            <a className="button" href="/admin/menu">メニュー管理</a>
            <a className="button" href="/admin/tables">席・端末管理</a>
            <a className="button" href="/admin/orders">注文管理</a>
            <button className="primary" onClick={load}>更新</button>
          </div>
        )}
      />
      {loading && <Banner>操作ログを読み込み中です。</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <section className="auditGrid">
        <section className="panel auditList">
          <SectionTitle title="操作ログ一覧" subtitle={`${logs.length} 件`} />
          {logs.length === 0 && !loading && <EmptyState>条件に一致する操作ログはありません。</EmptyState>}
          <div className="auditTable" role="table">
            <div className="auditRow header" role="row">
              <span>操作日時</span><span>結果</span><span>操作種別</span><span>操作ユーザー</span><span>ロール</span><span>操作端末</span><span>対象</span><span>対象ラベル</span><span>エラー</span><span>操作</span>
            </div>
            {logs.map((log) => (
              <div className={log.id === selectedId ? 'auditRow selected' : 'auditRow'} key={log.id} role="row">
                <span>{formatDate(log.occurredAt)}</span>
                <span><Badge tone={log.status === 'success' ? 'success' : 'danger'}>{log.status === 'success' ? '成功' : '失敗'}</Badge></span>
                <strong>{labelOf(actionLabels, log.action)}</strong>
                <span>{log.actorUserDisplayName || '-'}</span>
                <span>{log.actorUserRole || '-'}</span>
                <span>{log.actorTerminalCode || '-'}</span>
                <span>{labelOf(targetLabels, log.targetType)}</span>
                <span>{log.targetLabel || log.targetId || '-'}</span>
                <span className="auditError">{log.errorMessage || '-'}</span>
                <button onClick={() => setSelectedId(log.id)}>詳細</button>
              </div>
            ))}
          </div>
        </section>
        <aside className="panel auditDetail">
          <SectionTitle title={detail ? 'ログ詳細' : '詳細'} subtitle={detail ? detail.id : ''} />
          {!detail && <EmptyState>操作ログを選択してください。</EmptyState>}
          {detail && (
            <>
              <div className="detailMetricGrid">
                <div><span>操作日時</span><strong>{formatDate(detail.occurredAt)}</strong></div>
                <div><span>結果</span><strong>{detail.status === 'success' ? '成功' : '失敗'}</strong></div>
                <div><span>操作種別</span><strong>{labelOf(actionLabels, detail.action)}</strong></div>
                <div><span>操作ユーザー</span><strong>{detail.actorUserDisplayName || '-'}</strong></div>
                <div><span>ユーザー ID</span><strong>{detail.actorUserId || '-'}</strong></div>
                <div><span>ロール</span><strong>{detail.actorUserRole || '-'}</strong></div>
                <div><span>操作端末</span><strong>{detail.actorTerminalCode || '-'}</strong></div>
                <div><span>端末種別</span><strong>{detail.actorTerminalType || '-'}</strong></div>
                <div><span>対象</span><strong>{labelOf(targetLabels, detail.targetType)}</strong></div>
                <div><span>対象 ID</span><strong>{detail.targetId || '-'}</strong></div>
                <div><span>対象ラベル</span><strong>{detail.targetLabel || '-'}</strong></div>
              </div>
              {detail.errorMessage && <Banner tone="danger">{detail.errorMessage}</Banner>}
              <SectionTitle title="変更前" />
              <pre className="jsonBlock">{jsonText(detail.beforeData)}</pre>
              <SectionTitle title="変更後" />
              <pre className="jsonBlock">{jsonText(detail.afterData)}</pre>
              <SectionTitle title="リクエスト" />
              <pre className="jsonBlock">{jsonText(detail.requestData)}</pre>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
