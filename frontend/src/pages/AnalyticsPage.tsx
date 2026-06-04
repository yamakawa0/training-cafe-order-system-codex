import { useEffect, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { yen } from '../domain/money';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AnalyticsPage() {
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [ranking, setRanking] = useState<Array<{ item_name: string; quantity: number; sales_total: number }>>([]);

  const load = () => {
    void cafeApi.analyticsSummary(fromDate, toDate).then((data) => setSummary(data.summary || {}));
    void cafeApi.itemRanking(fromDate, toDate).then((data) => setRanking(data.items));
  };

  useEffect(() => {
    load();
  }, [fromDate, toDate]);

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>分析</h1>
        </div>
        <div className="dateRange">
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <a className="button" href={cafeApi.salesCsvUrl(fromDate, toDate)}>CSV</a>
        </div>
      </section>
      <section className="metrics">
        <article><span>売上</span><strong>{yen(summary.sales_total || 0)}</strong></article>
        <article><span>会計件数</span><strong>{summary.payment_count || 0}</strong></article>
        <article><span>客単価</span><strong>{yen(summary.average_spend || 0)}</strong></article>
        <article><span>平均調理</span><strong>{summary.average_cooking_seconds || 0}秒</strong></article>
      </section>
      <section className="analyticsGrid">
        <div className="panel">
          <h2>商品ランキング</h2>
          {ranking.map((item, index) => (
            <div className="line" key={item.item_name}>
              <span>{index + 1}. {item.item_name} x {item.quantity}</span>
              <strong>{yen(item.sales_total)}</strong>
            </div>
          ))}
        </div>
        <div className="panel">
          <h2>支払い方法</h2>
          <div className="line"><span>cash</span><strong>{summary.cash_count || 0} / {yen(summary.cash_total || 0)}</strong></div>
          <div className="line"><span>card</span><strong>{summary.card_count || 0} / {yen(summary.card_total || 0)}</strong></div>
          <div className="line"><span>qr</span><strong>{summary.qr_count || 0} / {yen(summary.qr_total || 0)}</strong></div>
        </div>
      </section>
    </main>
  );
}
