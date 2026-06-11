import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Banner, EmptyState, SectionTitle, SummaryCard } from '../components/ui';
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
  const [csvLoading, setCsvLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    void Promise.all([
      cafeApi.analyticsSummary(fromDate, toDate),
      cafeApi.itemRanking(fromDate, toDate)
    ]).then(([summaryData, rankingData]) => {
      setSummary(summaryData.summary || {});
      setRanking(rankingData.items);
      setLastUpdatedAt(new Date().toLocaleString('ja-JP'));
    }).catch((event: Error) => setError(event.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const orderCount = useMemo(() => summary.order_count || ranking.reduce((sum, item) => sum + item.quantity, 0), [ranking, summary.order_count]);
  const maxRankingSales = Math.max(...ranking.map((item) => item.sales_total), 1);

  async function downloadCsv() {
    try {
      setCsvLoading(true);
      setError('');
      setMessage('');
      const data = await cafeApi.exportSalesCsv(fromDate, toDate);
      const blob = new Blob([data.csv], { type: data.contentType || 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename || `sales-${fromDate}-${toDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`CSV をダウンロードしました: ${link.download}`);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'CSV 出力に失敗しました');
    } finally {
      setCsvLoading(false);
    }
  }

  return (
    <main className="shell analytics">
      <AppHeader
        title="分析ダッシュボード"
        subtitle={lastUpdatedAt ? `最終更新 ${lastUpdatedAt}` : '店長 PC'}
        actions={(
          <div className="dateRange">
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            <a className="button" href="/admin/menu">メニュー管理</a>
            <a className="button" href="/admin/tables">席・端末管理</a>
            <button className="primary" disabled={csvLoading} onClick={() => void downloadCsv()}>{csvLoading ? 'CSV 作成中' : 'CSV ダウンロード'}</button>
          </div>
        )}
      />
      {loading && <Banner>分析データを読み込み中です。</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <section className="metrics">
        <SummaryCard label="本日売上" value={yen(summary.sales_total || 0)} />
        <SummaryCard label="会計件数" value={summary.payment_count || 0} />
        <SummaryCard label="注文件数" value={orderCount} />
        <SummaryCard label="平均客単価" value={yen(summary.average_spend || 0)} />
      </section>
      <section className="analyticsGrid">
        <div className="panel">
          <SectionTitle title="商品ランキング" subtitle="売上金額順" />
          {ranking.length === 0 && !loading && <EmptyState>対象期間の売上商品はありません。</EmptyState>}
          <div className="rankingList">
            {ranking.map((item, index) => (
              <div className="rankingLine" key={item.item_name}>
                <div>
                  <strong>{index + 1}. {item.item_name}</strong>
                  <span>{item.quantity} 点 / {yen(item.sales_total)}</span>
                </div>
                <div className="barTrack"><span style={{ width: `${Math.max(8, (item.sales_total / maxRankingSales) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <SectionTitle title="支払い方法別" />
          {(['cash', 'card', 'qr'] as const).map((method) => (
            <div className="paymentSummaryLine" key={method}>
              <span>{method}</span>
              <strong>{summary[`${method}_count`] || 0} 件</strong>
              <em>{yen(summary[`${method}_total`] || 0)}</em>
            </div>
          ))}
          {!loading && (summary.payment_count || 0) === 0 && <EmptyState>対象期間の精算データはありません。</EmptyState>}
        </div>
      </section>
    </main>
  );
}
