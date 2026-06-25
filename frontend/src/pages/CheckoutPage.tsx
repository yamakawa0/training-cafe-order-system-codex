import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Badge, Banner, EmptyState, SectionTitle, StatusPill } from '../components/ui';
import { yen } from '../domain/money';
import type { CheckoutSummary, PaymentAttempt, PaymentMethod, PaymentReceipt } from '../domain/types';

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
  const [refundAmount, setRefundAmount] = useState('');
  const [failureReason, setFailureReason] = useState('カード承認エラー');
  const [cancelReason, setCancelReason] = useState('顧客が支払い方法を変更');
  const [attempts, setAttempts] = useState<PaymentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const summary = summaries[tableCode] || null;

  const loadAttempts = (targetTable = tableCode) =>
    cafeApi.paymentAttempts({ tableCode: targetTable })
      .then((data) => setAttempts(data.attempts))
      .catch(() => setAttempts([]));

  const load = () => {
    setLoading(true);
    setError('');
    return Promise.all(tables.map((table) => cafeApi.checkoutSummary(table).then((data) => [table, data.summary] as const)))
      .then((entries) => {
        const next = Object.fromEntries(entries);
        setSummaries(next);
        const requested = entries.find(([, candidate]) => candidate.sessionStatus === 'payment_requested')?.[0];
        if (requested && (!next[tableCode] || next[tableCode].sessionStatus !== 'payment_requested')) setTableCode(requested);
        void loadAttempts(requested || tableCode);
      })
      .catch((event: Error) => setError(event.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    void loadAttempts(tableCode);
  }, [tableCode]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const requestedCount = useMemo(() => Object.values(summaries).filter((candidate) => candidate.sessionStatus === 'payment_requested').length, [summaries]);

  async function settle(simulateResult: 'paid' | 'failed' = 'paid') {
    if (settling || !summary?.items.length || summary.sessionStatus !== 'payment_requested') return;
    setSettling(true);
    setError('');
    setReceiptNo('');
    try {
      const result = await cafeApi.settle(tableCode, method, { simulateResult, failureReason });
      if (result.paymentAttempt?.status === 'failed') {
        setMessage(`${tableCode} の支払いを失敗として記録しました`);
      } else if (result.receiptNo) {
        setReceiptNo(result.receiptNo);
        const receiptResult = await cafeApi.receipt({ paymentNo: result.receiptNo });
        setReceipt(receiptResult.receipt);
        setReceiptQuery(result.receiptNo);
        setMessage(`${tableCode} の精算が完了しました`);
      }
      await load();
      await loadAttempts(tableCode);
    } catch (event) {
      setError(event instanceof Error ? event.message : '精算に失敗しました');
    } finally {
      setSettling(false);
    }
  }

  async function cancelAttempt(attemptId: string) {
    if (!window.confirm('この決済試行を取消します。')) return;
    setSettling(true);
    setError('');
    try {
      await cafeApi.cancelPayment({ attemptId, reason: cancelReason });
      setMessage('決済試行を取消しました');
      await load();
      await loadAttempts(tableCode);
    } catch (event) {
      setError(event instanceof Error ? event.message : '決済試行を取消できませんでした');
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

  async function refund(refundType: 'full' | 'partial') {
    if (!receipt || !['paid', 'partial_refunded'].includes(receipt.status)) return;
    let amount: number | undefined;
    if (refundType === 'partial') {
      amount = Number(refundAmount);
      if (!Number.isInteger(amount) || amount <= 0) {
        setError('返金額は 1 円以上の整数で入力してください');
        return;
      }
      if (amount > receipt.refundRemaining) {
        setError('返金額が返金可能残額を超えています');
        return;
      }
    }
    const label = refundType === 'full' ? `残額 ${yen(receipt.refundRemaining)} を全額返金` : `${yen(amount || 0)} を部分返金`;
    if (!window.confirm(`${receipt.paymentNo} の ${label} します。`)) return;
    setRefunding(true);
    setError('');
    try {
      const data = await cafeApi.refundPayment(receipt.paymentId, refundReason, { amount, refundType });
      setReceipt(data.receipt);
      setRefundAmount('');
      setMessage(`${receipt.paymentNo} を返金しました`);
      await load();
    } catch (event) {
      setError(event instanceof Error ? event.message : '返金できませんでした');
    } finally {
      setRefunding(false);
    }
  }

  const canRefundReceipt = receipt ? ['paid', 'partial_refunded'].includes(receipt.status) && receipt.refundRemaining > 0 : false;

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
          <button className="primary largeButton" disabled={!summary?.items.length || summary?.sessionStatus !== 'payment_requested' || settling} onClick={() => void settle('paid')}>
            {settling ? '精算中' : '支払い完了'}
          </button>
          <label className="fieldLabel">失敗理由<input value={failureReason} onChange={(event) => setFailureReason(event.target.value)} /></label>
          <button className="dangerButton" disabled={!summary?.items.length || summary?.sessionStatus !== 'payment_requested' || settling} onClick={() => void settle('failed')}>
            失敗として処理
          </button>
          {receiptNo && <Banner tone="success">領収書番号: {receiptNo}</Banner>}
          {summary?.sessionStatus === 'payment_requested' && <p className="helperText">金額はサーバー集計値を使用します。端末入力の金額は会計に使用しません。</p>}
        </aside>
      </section>
      <section className="panel receiptLookupPanel">
        <SectionTitle title="決済試行履歴" subtitle={`${tableCode} / 失敗後は再度「支払い完了」で再試行`} />
        {summary?.latestAttempt && (
          <Banner tone={summary.latestAttempt.status === 'failed' ? 'danger' : summary.latestAttempt.status === 'cancelled' ? 'warning' : 'info'}>
            直近: {summary.latestAttempt.attemptNo} / {summary.latestAttempt.status} / {summary.latestAttempt.failureReason || summary.latestAttempt.cancelReason || '-'}
          </Banner>
        )}
        <div className="cancelNoteBox">
          <label className="fieldLabel">取消理由<input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label>
        </div>
        <div className="adminLines">
          {attempts.length === 0 && <EmptyState>決済試行履歴はありません。</EmptyState>}
          {attempts.map((attempt) => (
            <div className="adminLine" key={attempt.attemptId}>
              <strong>{attempt.attemptNo}</strong>
              <span>{paymentLabels[attempt.method]} / <Badge tone={attempt.status === 'paid' ? 'success' : attempt.status === 'failed' || attempt.status === 'cancelled' ? 'danger' : 'warning'}>{attempt.status}</Badge> / {yen(attempt.amount)}</span>
              <small>{formatDate(attempt.attemptedAt)} / {attempt.failureReason || attempt.cancelReason || '-'}</small>
              <button disabled={settling || !['pending', 'failed'].includes(attempt.status)} onClick={() => void cancelAttempt(attempt.attemptId)}>取消</button>
            </div>
          ))}
        </div>
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
            <Badge tone={receipt.status === 'refunded' ? 'danger' : receipt.status === 'partial_refunded' ? 'warning' : 'success'}>
              {receipt.status === 'partial_refunded' ? 'PARTIAL REFUNDED' : receipt.status === 'refunded' ? 'REFUNDED' : receipt.status.toUpperCase()}
            </Badge>
            <dl className="totals receiptTotals">
              <dt>支払日時</dt><dd>{formatDate(receipt.paidAt)}</dd>
              <dt>支払方法</dt><dd>{paymentLabels[receipt.method] || receipt.method}</dd>
              <dt>返金済み合計</dt><dd>{yen(receipt.refundTotal)}</dd>
              <dt>返金可能残額</dt><dd>{yen(receipt.refundRemaining)}</dd>
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
              <dt>支払合計</dt><dd>{yen(receipt.totalAmount)}</dd>
              <dt>返金後残額</dt><dd>{yen(receipt.totalAmount - receipt.refundTotal)}</dd>
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
              <label className="fieldLabel">返金額<input inputMode="numeric" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder={`${receipt.refundRemaining}`} /></label>
              <label className="fieldLabel">返金理由<textarea value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="任意" /></label>
              <button className="dangerButton" disabled={refunding || !canRefundReceipt || !refundAmount.trim()} onClick={() => void refund('partial')}>部分返金</button>
              <button className="dangerButton" disabled={refunding || !canRefundReceipt} onClick={() => void refund('full')}>残額全額返金</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
