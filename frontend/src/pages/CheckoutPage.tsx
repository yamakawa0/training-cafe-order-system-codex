import { useEffect, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { yen } from '../domain/money';
import type { CheckoutSummary, PaymentMethod } from '../domain/types';

const tables = ['T01', 'T02', 'T03', 'T04'];

export function CheckoutPage() {
  const [tableCode, setTableCode] = useState('T01');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [receiptNo, setReceiptNo] = useState('');
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    return cafeApi.checkoutSummary(tableCode)
      .then((data) => setSummary(data.summary))
      .catch((event: Error) => setError(event.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [tableCode]);

  async function settle() {
    if (settling || !summary?.items.length || summary.sessionStatus !== 'payment_requested') return;
    setSettling(true);
    setError('');
    try {
      const result = await cafeApi.settle(tableCode, method);
      setReceiptNo(result.receiptNo);
      await load();
    } catch (event) {
      setError(event instanceof Error ? event.message : '精算に失敗しました');
    } finally {
      setSettling(false);
    }
  }

  return (
    <main className="shell checkout">
      <section className="toolbar">
        <div>
          <p className="eyebrow">カフェ・ルポ / Cafe Repos</p>
          <h1>セルフ精算</h1>
        </div>
        <select value={tableCode} onChange={(event) => setTableCode(event.target.value)}>
          {tables.map((table) => <option key={table}>{table}</option>)}
        </select>
      </section>
      {loading && <p className="notice">読み込み中です。</p>}
      {error && <p className="error">{error}</p>}
      {summary?.sessionStatus && summary.sessionStatus !== 'payment_requested' && <p className="warning">会計依頼前、または精算済みの席は精算できません。</p>}
      <section className="checkoutGrid">
        <div className="panel">
          <h2>{tableCode} 明細</h2>
          {summary?.items.length === 0 && !loading && <p className="empty">未精算明細はありません。</p>}
          {summary?.items.map((item) => (
            <div className="line" key={item.orderItemId}>
              <span>{item.itemName} x {item.quantity}</span>
              <strong>{yen(item.lineSubtotal + item.lineTax)}</strong>
            </div>
          ))}
        </div>
        <aside className="panel">
          <dl className="totals">
            <dt>小計</dt><dd>{yen(summary?.subtotal || 0)}</dd>
            <dt>税</dt><dd>{yen(summary?.taxAmount || 0)}</dd>
            <dt>合計</dt><dd>{yen(summary?.totalAmount || 0)}</dd>
          </dl>
          <div className="segmented">
            {(['cash', 'card', 'qr'] as const).map((candidate) => (
              <button className={method === candidate ? 'selected' : ''} key={candidate} onClick={() => setMethod(candidate)}>{candidate}</button>
            ))}
          </div>
          <button className="primary" disabled={!summary?.items.length || summary?.sessionStatus !== 'payment_requested' || settling} onClick={() => void settle()}>{settling ? '精算中' : '支払い完了'}</button>
          {receiptNo && <p className="notice">領収書番号: {receiptNo}</p>}
        </aside>
      </section>
    </main>
  );
}
