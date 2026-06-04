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

  const load = () => void cafeApi.checkoutSummary(tableCode).then((data) => setSummary(data.summary));
  useEffect(() => {
    load();
  }, [tableCode]);

  async function settle() {
    const result = await cafeApi.settle(tableCode, method);
    setReceiptNo(result.receiptNo);
    load();
  }

  return (
    <main className="shell checkout">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1>セルフ精算</h1>
        </div>
        <select value={tableCode} onChange={(event) => setTableCode(event.target.value)}>
          {tables.map((table) => <option key={table}>{table}</option>)}
        </select>
      </section>
      <section className="checkoutGrid">
        <div className="panel">
          <h2>{tableCode} 明細</h2>
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
          <button className="primary" disabled={!summary?.items.length} onClick={() => void settle()}>支払い完了</button>
          {receiptNo && <p className="notice">領収書番号: {receiptNo}</p>}
        </aside>
      </section>
    </main>
  );
}
