import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Badge, Banner, EmptyState, SectionTitle } from '../components/ui';
import { yen } from '../domain/money';
import type { AdminOrderDetail, AdminOrderSummary } from '../domain/types';

const statusLabels: Record<string, string> = {
  submitted: '受付済み',
  ordered: '受付',
  in_progress: '調理中',
  ready: '提供待ち',
  served: '提供済み',
  cancelled: '取消済み',
  unpaid: '未精算',
  paid: '精算済み',
  refunded: '返金済み',
  pending: '処理中',
  failed: '失敗',
  seated: '着席',
  ordering: '注文中',
  payment_requested: '会計依頼中',
  closed: '終了'
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(status: string | null) {
  return status ? statusLabels[status] || status : '-';
}

function statusTone(status: string | null): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'paid' || status === 'served') return 'success';
  if (status === 'cancelled' || status === 'failed' || status === 'refunded') return 'danger';
  if (status === 'ready' || status === 'payment_requested' || status === 'pending') return 'warning';
  if (status === 'in_progress') return 'info';
  return 'neutral';
}

function percent(value: number | undefined) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ja-JP') : '-';
}

function isPaid(order: AdminOrderDetail | null) {
  return Boolean(order && (order.paymentStatus === 'paid' || order.payments.some((payment) => payment.status === 'paid')));
}

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [tableCode, setTableCode] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedOrder = useMemo(
    () => orders.find((order) => order.orderId === selectedOrderId) || orders[0] || null,
    [orders, selectedOrderId]
  );
  const paid = isPaid(detail);
  const canCancelWholeOrder = Boolean(detail && !paid && detail.orderStatus !== 'cancelled' && detail.items.length > 0 && detail.items.every((item) => item.status !== 'ready' && item.status !== 'served') && detail.items.some((item) => item.status !== 'cancelled'));

  const loadDetail = async (orderId: string) => {
    const data = await cafeApi.adminOrderDetail(orderId);
    setDetail(data.order);
  };

  const load = () => {
    setLoading(true);
    setError('');
    void cafeApi.adminOrders({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      tableCode: tableCode || undefined,
      orderNo: orderNo || undefined,
      orderStatus: orderStatus || undefined,
      paymentStatus: paymentStatus || undefined
    }).then(async (data) => {
      setOrders(data.orders);
      const nextOrderId = selectedOrderId && data.orders.some((order) => order.orderId === selectedOrderId)
        ? selectedOrderId
        : data.orders[0]?.orderId || '';
      setSelectedOrderId(nextOrderId);
      if (nextOrderId) await loadDetail(nextOrderId);
      else setDetail(null);
    }).catch((event: Error) => setError(event.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [fromDate, toDate, orderStatus, paymentStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250);
    return () => window.clearTimeout(timer);
  }, [tableCode, orderNo]);

  useEffect(() => {
    if (!selectedOrder?.orderId) return;
    void loadDetail(selectedOrder.orderId).catch((event: Error) => setError(event.message));
  }, [selectedOrder?.orderId]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function refreshAfterAction(nextDetail: AdminOrderDetail, successMessage: string) {
    setDetail(nextDetail);
    setMessage(successMessage);
    const data = await cafeApi.adminOrders({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      tableCode: tableCode || undefined,
      orderNo: orderNo || undefined,
      orderStatus: orderStatus || undefined,
      paymentStatus: paymentStatus || undefined
    });
    setOrders(data.orders);
  }

  async function cancelItem(orderItemId: string, itemName: string) {
    if (!window.confirm(`${itemName} をキャンセルします。`)) return;
    setSaving(true);
    setError('');
    try {
      const data = await cafeApi.adminCancelOrderItem(orderItemId, cancelNote);
      await refreshAfterAction(data.order, '注文明細をキャンセルしました。');
    } catch (event) {
      setError(event instanceof Error ? event.message : '注文明細をキャンセルできませんでした。');
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrder() {
    if (!detail || !window.confirm(`${detail.orderNo} の注文全体をキャンセルします。`)) return;
    setSaving(true);
    setError('');
    try {
      const data = await cafeApi.adminCancelOrder(detail.orderId, cancelNote);
      await refreshAfterAction(data.order, '注文全体をキャンセルしました。');
    } catch (event) {
      setError(event instanceof Error ? event.message : '注文をキャンセルできませんでした。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell adminOrders">
      <AppHeader
        title="注文管理"
        subtitle="店長 PC"
        actions={(
          <div className="adminOrderTools">
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            <input value={tableCode} onChange={(event) => setTableCode(event.target.value)} placeholder="席コード" />
            <input value={orderNo} onChange={(event) => setOrderNo(event.target.value)} placeholder="注文番号" />
            <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}>
              <option value="">全注文状態</option>
              <option value="submitted">受付済み</option>
              <option value="ordered">受付</option>
              <option value="in_progress">調理中</option>
              <option value="ready">提供待ち</option>
              <option value="served">提供済み</option>
              <option value="cancelled">取消済み</option>
            </select>
            <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
              <option value="">全精算状態</option>
              <option value="unpaid">未精算</option>
              <option value="paid">精算済み</option>
              <option value="refunded">返金済み</option>
            </select>
            <a className="button" href="/analytics">CSV 出力</a>
            <a className="button" href="/admin/menu">メニュー管理</a>
            <a className="button" href="/admin/tables">席・端末管理</a>
            <a className="button" href="/admin/audit-logs">操作ログ</a>
            <button className="primary" onClick={load}>更新</button>
          </div>
        )}
      />
      {loading && <Banner>注文データを読み込み中です。</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <section className="adminOrdersGrid">
        <section className="panel adminOrderList">
          <SectionTitle title="注文一覧" subtitle={`${orders.length} 件`} />
          {orders.length === 0 && !loading && <EmptyState>条件に一致する注文はありません。</EmptyState>}
          <div className="adminOrdersTable" role="table">
            <div className="adminOrderRow header" role="row">
              <span>注文</span><span>席</span><span>注文状態</span><span>明細</span><span>金額</span><span>精算</span><span>受付日時</span><span>操作</span>
            </div>
            {orders.map((order) => (
              <div className={order.orderId === selectedOrderId ? 'adminOrderRow selected' : 'adminOrderRow'} key={order.orderId} role="row">
                <strong>{order.orderNo}</strong>
                <span>{order.tableCode}</span>
                <span><Badge tone={statusTone(order.orderStatus)}>{statusLabel(order.orderStatus)}</Badge></span>
                <span>{order.itemCount - order.cancelledItemCount}/{order.itemCount}</span>
                <span>{yen(order.totalAmount)}</span>
                <span><Badge tone={statusTone(order.paymentStatus || 'unpaid')}>{statusLabel(order.paymentStatus || 'unpaid')}</Badge></span>
                <span>{formatDate(order.submittedAt)}</span>
                <button onClick={() => setSelectedOrderId(order.orderId)}>詳細</button>
              </div>
            ))}
          </div>
        </section>
        <aside className="panel adminOrderDetail">
          <SectionTitle title={detail ? `${detail.orderNo} 詳細` : '注文詳細'} subtitle={detail ? `${detail.tableCode} ${detail.tableName}` : ''} />
          {!detail && <EmptyState>注文を選択してください。</EmptyState>}
          {detail && (
            <>
              <div className="detailMetricGrid">
                <div><span>注文状態</span><strong>{statusLabel(detail.orderStatus)}</strong></div>
                <div><span>精算状態</span><strong>{statusLabel(detail.paymentStatus || 'unpaid')}</strong></div>
                <div><span>合計</span><strong>{yen(detail.totalAmount)}</strong></div>
                <div><span>未提供</span><strong>{detail.unservedItemCount}</strong></div>
                <div><span>セッション</span><strong>{statusLabel(detail.sessionStatus)}</strong></div>
                <div><span>受付日時</span><strong>{formatDate(detail.submittedAt)}</strong></div>
                <div><span>精算日時</span><strong>{formatDate(detail.paidAt)}</strong></div>
                <div><span>取消明細</span><strong>{detail.cancelledItemCount}</strong></div>
              </div>
              <div className="cancelNoteBox">
                <label className="fieldLabel">取消メモ<textarea value={cancelNote} onChange={(event) => setCancelNote(event.target.value)} placeholder="任意" /></label>
                <button className="dangerButton" disabled={saving || !canCancelWholeOrder} onClick={() => void cancelOrder()}>注文全体をキャンセル</button>
              </div>
              {paid && <Banner tone="warning">精算済み注文の取消はできません。</Banner>}
              <SectionTitle title="注文明細" />
              <div className="adminOrderItems">
                {detail.items.map((item) => (
                  <div className="adminOrderItem" key={item.orderItemId}>
                    <div>
                      <strong>{item.itemName} x {item.quantity}</strong>
                      <span>{yen(item.lineSubtotal + item.lineTax)} / 単価 {yen(item.unitPrice)} / オプション {yen(item.optionTotal)}</span>
                      <small>明細売上 {yen(item.lineSubtotal)} / 明細原価 {yen(item.lineCostTotal)} / 明細粗利 {yen(item.lineGrossProfit)} / 粗利率 {percent(item.lineGrossMarginRate)}</small>
                      {item.optionsText && <small>{item.optionsText}</small>}
                      {(item.customerNote || item.allergyNote) && <small>{item.customerNote || ''}{item.allergyNote ? ` / アレルギー: ${item.allergyNote}` : ''}</small>}
                    </div>
                    <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                    <button disabled={saving || paid || !item.canCancel} onClick={() => void cancelItem(item.orderItemId, item.itemName)}>明細取消</button>
                  </div>
                ))}
              </div>
              <SectionTitle title="支払い情報" />
              <div className="adminLines">
                {detail.payments.length === 0 && <EmptyState>支払い情報はありません。</EmptyState>}
                {detail.payments.map((payment) => (
                  <div className="adminLine" key={payment.paymentId}>
                    <strong>{payment.paymentNo}</strong>
                    <span>{payment.method} / <Badge tone={statusTone(payment.status)}>{statusLabel(payment.status)}</Badge></span>
                    <small>{yen(payment.totalAmount)} / {formatDate(payment.paidAt)}</small>
                    {(payment.refunds || []).map((refund) => (
                      <small key={refund.refundId}>返金 {refund.refundNo}: {yen(refund.amount)} / {formatDate(refund.refundedAt)} / {refund.reason || '理由なし'}</small>
                    ))}
                  </div>
                ))}
              </div>
              <SectionTitle title="関連ホールタスク" />
              <div className="adminLines">
                {detail.hallTasks.length === 0 && <EmptyState>関連タスクはありません。</EmptyState>}
                {detail.hallTasks.map((task) => (
                  <div className="adminLine" key={task.taskId}>
                    <strong>{task.title}</strong>
                    <span>{task.taskType}</span>
                    <small>{statusLabel(task.status)} / {formatDate(task.createdAt)}</small>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
