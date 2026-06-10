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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    void Promise.all([
      cafeApi.analyticsSummary(fromDate, toDate),
      cafeApi.itemRanking(fromDate, toDate)
    ]).then(([summaryData, rankingData]) => {
      setSummary(summaryData.summary || {});
      setRanking(rankingData.items);
    }).catch((event: Error) => setError(event.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [fromDate, toDate]);

  async function downloadCsv() {
    try {
      setError('');
      const data = await cafeApi.exportSalesCsv(fromDate, toDate);
      const blob = new Blob([data.csv], { type: data.contentType || 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename || `sales-${fromDate}-${toDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'CSV 出力に失敗しました');
    }
  }

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">カフェ・ルポ / Cafe Repos</p>
          <h1>分析</h1>
        </div>
        <div className="dateRange">
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <button onClick={() => void downloadCsv()}>CSV</button>
        </div>
      </section>
      {loading && <p className="notice">読み込み中です。</p>}
      {error && <p className="error">{error}</p>}
      <section className="metrics">
        <article><span>売上</span><strong>{yen(summary.sales_total || 0)}</strong></article>
        <article><span>会計件数</span><strong>{summary.payment_count || 0}</strong></article>
        <article><span>客単価</span><strong>{yen(summary.average_spend || 0)}</strong></article>
        <article><span>平均調理</span><strong>{summary.average_cooking_seconds || 0}秒</strong></article>
      </section>
      <section className="analyticsGrid">
        <div className="panel">
          <h2>商品ランキング</h2>
          {ranking.length === 0 && !loading && <p className="empty">対象期間の売上商品はありません。</p>}
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
