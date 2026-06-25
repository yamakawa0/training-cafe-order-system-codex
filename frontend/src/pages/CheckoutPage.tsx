import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Badge, Banner, EmptyState, SectionTitle, StatusPill } from '../components/ui';
import { yen } from '../domain/money';
import type { CheckoutSummary, PaymentMethod, PaymentReceipt } from '../domain/types';

const tables = ['T01', 'T02', 'T03', 'T04'];
const paymentLabels: Record<PaymentMethod, string> = {
  cash: '現金',
  card: 'カード',
  qr: 'QR'
};

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('ja-JP') : '-';
}

export function CheckoutPage() {
  const [tableCode, setTableCode] = useState('T01');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [summaries, setSummaries] = useState<Record<string, CheckoutSummary>>({});
  const [receiptNo, setReceiptNo] = useState('');
  const [receiptQuery, setReceiptQuery] = useState('');
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const summary = summaries[tableCode] || null;

  const load = () => {
    setLoading(true);
    setError('');
    return Promise.all(tables.map((table) => cafeApi.checkoutSummary(table).then((data) => [table, data.summary] as const)))
      .then((entries) => {
        const next = Object.fromEntries(entries);
        setSummaries(next);
        const requested = entries.find(([, candidate]) => candidate.sessionStatus === 'payment_requested')?.[0];
        if (requested && (!next[tableCode] || next[tableCode].sessionStatus !== 'payment_requested')) setTableCode(requested);
      })
      .catch((event: Error) => setError(event.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const requestedCount = useMemo(() => Object.values(summaries).filter((candidate) => candidate.sessionStatus === 'payment_requested').length, [summaries]);

  async function settle() {
    if (settling || !summary?.items.length || summary.sessionStatus !== 'payment_requested') return;
    setSettling(true);
    setError('');
    setReceiptNo('');
    try {
      const result = await cafeApi.settle(tableCode, method);
      setReceiptNo(result.receiptNo);
      const receiptResult = await cafeApi.receipt({ paymentNo: result.receiptNo });
      setReceipt(receiptResult.receipt);
      setReceiptQuery(result.receiptNo);
      setMessage(`${tableCode} の精算が完了しました`);
      await load();
    } catch (event) {
      setError(event instanceof Error ? event.message : '精算に失敗しました');
    } finally {
      setSettling(false);
    }
  }

  async function loadReceipt(reissue = false) {
    if (!receiptQuery.trim()) return;
    setReceiptLoading(true);
    setError('');
    try {
      const key = receiptQuery.trim();
      const data = await cafeApi.receipt(key.startsWith('pay-') ? { paymentId: key, reissue } : { paymentNo: key, reissue });
      setReceipt(data.receipt);
      if (reissue) setMessage('レシートを再発行しました');
    } catch (event) {
      setError(event instanceof Error ? event.message : 'レシートを取得できませんでした');
    } finally {
      setReceiptLoading(false);
    }
  }

  async function refund() {
    if (!receipt || receipt.status !== 'paid') return;
    if (!window.confirm(`${receipt.paymentNo} を全額返金します。`)) return;
    setRefunding(true);
    setError('');
    try {
      const data = await cafeApi.refundPayment(receipt.paymentId, refundReason);
      setReceipt(data.receipt);
      setMessage(`${receipt.paymentNo} を返金しました`);
      await load();
    } catch (event) {
      setError(event instanceof Error ? event.message : '返金できませんでした');
    } finally {
      setRefunding(false);
    }
  }

  return (
    <main className="shell checkout">
      <AppHeader
        title="レジ精算"
        subtitle="精算端末"
        meta={<Badge tone={requestedCount > 0 ? 'warning' : 'info'}>会計依頼 {requestedCount} 席</Badge>}
      />
      {loading && <Banner>精算情報を読み込み中です。</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      {summary?.sessionStatus && summary.sessionStatus !== 'payment_requested' && <Banner tone="warning">会計依頼前、または精算済みの席は精算できません。</Banner>}
      <section className="checkoutGrid">
        <aside className="panel tableSelectPanel">
          <SectionTitle title="テーブル選択" subtitle="会計依頼済みの席を優先表示" />
          <div className="tableSelectGrid">
            {tables.map((table) => {
              const candidate = summaries[table];
              const status = candidate?.sessionStatus || 'available';
              return (
                <button className={`tableSelect ${tableCode === table ? 'selected' : ''} status-${status}`} key={table} onClick={() => setTableCode(table)}>
                  <strong>{table}</strong>
                  <StatusPill status={status} />
                  <span>{yen(candidate?.totalAmount || 0)}</span>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="receiptPanel">
          <div className="receipt">
            <SectionTitle title={`${tableCode} レシート`} subtitle={summary?.tableName || 'テーブル'} />
            {!summary?.items.length && !loading && <EmptyState>未精算明細はありません。</EmptyState>}
            {summary?.items.map((item) => (
              <div className="receiptLine" key={item.orderItemId}>
                <div>
                  <strong>{item.itemName}</strong>
                  <span>{item.status} / {yen(item.unitPrice + item.optionTotal)} x {item.quantity}</span>
                  {item.optionsText && <small>{item.optionsText}</small>}
                </div>
                <strong>{yen(item.lineSubtotal + item.lineTax)}</strong>
              </div>
            ))}
            <dl className="totals receiptTotals">
              <dt>小計</dt><dd>{yen(summary?.subtotal || 0)}</dd>
              <dt>税</dt><dd>{yen(summary?.taxAmount || 0)}</dd>
              <dt>合計</dt><dd>{yen(summary?.totalAmount || 0)}</dd>
            </dl>
          </div>
        </section>
        <aside className="panel paymentPanel">
          <SectionTitle title="支払い方法" />
          <div className="paymentMethodGrid">
            {(['cash', 'card', 'qr'] as const).map((candidate) => (
              <button className={`paymentMethod ${method === candidate ? 'selected' : ''}`} key={candidate} onClick={() => setMethod(candidate)}>
                <strong>{paymentLabels[candidate]}</strong>
                <span>{candidate}</span>
              </button>
            ))}
          </div>
          <button className="primary largeButton" disabled={!summary?.items.length || summary?.sessionStatus !== 'payment_requested' || settling} onClick={() => void settle()}>
            {settling ? '精算中' : '支払い完了'}
          </button>
          {receiptNo && <Banner tone="success">領収書番号: {receiptNo}</Banner>}
          {summary?.sessionStatus === 'payment_requested' && <p className="helperText">金額はサーバー集計値を使用します。端末入力の金額は会計に使用しません。</p>}
        </aside>
      </section>
      <section className="panel receiptLookupPanel">
        <SectionTitle title="レシート再発行・返金" subtitle="payment_no または payment_id で検索" />
        <div className="adminOrderTools">
          <input value={receiptQuery} onChange={(event) => setReceiptQuery(event.target.value)} placeholder="PAY-... または pay-..." />
          <button onClick={() => void loadReceipt(false)} disabled={receiptLoading || !receiptQuery.trim()}>検索</button>
          <button onClick={() => void loadReceipt(true)} disabled={receiptLoading || !receiptQuery.trim()}>再発行</button>
        </div>
        {receipt && (
          <div className="receipt reissueReceipt">
            <SectionTitle title="Cafe Order System" subtitle={`${receipt.paymentNo} / ${receipt.tableCode} ${receipt.tableName}`} />
            <Badge tone={receipt.status === 'refunded' ? 'danger' : 'success'}>{receipt.status === 'refunded' ? 'REFUNDED' : receipt.status.toUpperCase()}</Badge>
            <dl className="totals receiptTotals">
              <dt>支払日時</dt><dd>{formatDate(receipt.paidAt)}</dd>
              <dt>支払方法</dt><dd>{paymentLabels[receipt.method] || receipt.method}</dd>
            </dl>
            {receipt.items.map((item) => (
              <div className="receiptLine" key={item.orderItemId}>
                <div>
                  <strong>{item.itemName}</strong>
                  <span>{yen(item.unitPrice + item.optionTotal)} x {item.quantity}</span>
                  {item.optionsText && <small>{item.optionsText}</small>}
                </div>
                <strong>{yen(item.lineTotal)}</strong>
              </div>
            ))}
            <dl className="totals receiptTotals">
              <dt>小計</dt><dd>{yen(receipt.subtotal)}</dd>
              <dt>税</dt><dd>{yen(receipt.taxAmount)}</dd>
              <dt>合計</dt><dd>{yen(receipt.totalAmount)}</dd>
            </dl>
            {receipt.refunds.length > 0 && (
              <div className="adminLines">
                {receipt.refunds.map((refundItem) => (
                  <div className="adminLine" key={refundItem.refundId}>
                    <strong>{refundItem.refundNo}</strong>
                    <span>{yen(refundItem.amount)} / {formatDate(refundItem.refundedAt)}</span>
                    <small>{refundItem.reason || '理由なし'}</small>
                  </div>
                ))}
              </div>
            )}
            <div className="cancelNoteBox">
              <label className="fieldLabel">返金理由<textarea value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="任意" /></label>
              <button className="dangerButton" disabled={refunding || receipt.status !== 'paid'} onClick={() => void refund()}>全額返金</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
