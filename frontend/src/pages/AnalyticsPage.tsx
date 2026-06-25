import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Banner, EmptyState, SectionTitle, SummaryCard } from '../components/ui';
import { yen } from '../domain/money';
import type { AnalyticsSummary, AuthUser, DailyCashClosure, ItemRanking } from '../domain/types';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function percent(value: number | undefined) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function AnalyticsPage() {
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [summary, setSummary] = useState<AnalyticsSummary>({});
  const [ranking, setRanking] = useState<ItemRanking[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [businessDate, setBusinessDate] = useState(today());
  const [dailyClose, setDailyClose] = useState<DailyCashClosure | null>(null);
  const [dailyCloseNote, setDailyCloseNote] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [dailyCloseLoading, setDailyCloseLoading] = useState(false);
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

  const loadDailyClose = () => {
    setDailyCloseLoading(true);
    setError('');
    void cafeApi.dailyClosePreview(businessDate)
      .then((data) => setDailyClose(data.preview))
      .catch((event: Error) => setError(event.message))
      .finally(() => setDailyCloseLoading(false));
  };

  useEffect(() => {
    load();
  }, [fromDate, toDate]);

  useEffect(() => {
    void cafeApi.me().then((data) => setUser(data.user)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    loadDailyClose();
  }, [businessDate]);

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

  async function closeDailyClose() {
    try {
      setDailyCloseLoading(true);
      setError('');
      const data = await cafeApi.dailyCloseClose({ businessDate, note: dailyCloseNote });
      setDailyClose(data.closure);
      setMessage(`${businessDate} の日次締めを確定しました`);
    } catch (event) {
      setError(event instanceof Error ? event.message : '日次締めに失敗しました');
    } finally {
      setDailyCloseLoading(false);
    }
  }

  async function reopenDailyClose() {
    try {
      setDailyCloseLoading(true);
      setError('');
      const data = await cafeApi.dailyCloseReopen({ businessDate, reason: reopenReason });
      setDailyClose(data.closure);
      setMessage(`${businessDate} の日次締めを再オープンしました`);
    } catch (event) {
      setError(event instanceof Error ? event.message : '日次締めの再オープンに失敗しました');
    } finally {
      setDailyCloseLoading(false);
    }
  }

  async function downloadDailyCloseCsv() {
    try {
      setDailyCloseLoading(true);
      setError('');
      const data = await cafeApi.exportDailyCloseCsv(businessDate, businessDate);
      const blob = new Blob([data.csv], { type: data.contentType || 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename || `daily-close-${businessDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`日次締め CSV をダウンロードしました: ${link.download}`);
    } catch (event) {
      setError(event instanceof Error ? event.message : '日次締め CSV 出力に失敗しました');
    } finally {
      setDailyCloseLoading(false);
    }
  }

  const canManageDailyClose = user?.role === 'manager';
  const canClose = canManageDailyClose && (!dailyClose?.alreadyClosed || dailyClose.closureStatus === 'reopened');
  const canReopen = canManageDailyClose && dailyClose?.closureStatus === 'closed';

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
            <a className="button" href="/admin/orders">注文管理</a>
            <a className="button" href="/admin/audit-logs">操作ログ</a>
            <button className="primary" disabled={csvLoading} onClick={() => void downloadCsv()}>{csvLoading ? 'CSV 作成中' : 'CSV ダウンロード'}</button>
          </div>
        )}
      />
      {loading && <Banner>分析データを読み込み中です。</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <section className="metrics">
        <SummaryCard label="総支払額" value={yen(summary.gross_sales_total || summary.sales_total || 0)} />
        <SummaryCard label="返金額" value={yen(summary.refund_total || 0)} />
        <SummaryCard label="純売上" value={yen(summary.net_sales_total || summary.sales_total || 0)} />
        <SummaryCard label="原価合計" value={yen(summary.cost_total || 0)} />
        <SummaryCard label="粗利合計" value={yen(summary.gross_profit || 0)} />
        <SummaryCard label="粗利率" value={percent(summary.gross_margin_rate)} />
        <SummaryCard label="会計件数" value={summary.payment_count || 0} />
        <SummaryCard label="注文件数" value={orderCount} />
        <SummaryCard label="平均客単価" value={yen(summary.average_spend || 0)} />
      </section>
      <section className="panel">
        <SectionTitle title="日次締め" subtitle="gross / refund / net と決済手段・provider 別集計" />
        <div className="dateRange">
          <input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
          <button onClick={loadDailyClose} disabled={dailyCloseLoading}>{dailyCloseLoading ? '確認中' : 'Preview'}</button>
          <button className="primary" onClick={() => void closeDailyClose()} disabled={!canClose || dailyCloseLoading}>Close</button>
          <button onClick={() => void reopenDailyClose()} disabled={!canReopen || dailyCloseLoading || !reopenReason.trim()}>Reopen</button>
          <button onClick={() => void downloadDailyCloseCsv()} disabled={dailyCloseLoading}>日次締め CSV</button>
        </div>
        <div className="formGrid">
          <label>
            締めメモ
            <input value={dailyCloseNote} onChange={(event) => setDailyCloseNote(event.target.value)} placeholder="通常締め" />
          </label>
          <label>
            Reopen 理由
            <input value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="訂正理由" />
          </label>
        </div>
        {dailyClose && (
          <>
            <div className="metrics compact">
              <SummaryCard label="締め状態" value={dailyClose.closureStatus || '未締め'} />
              <SummaryCard label="総支払額" value={yen(dailyClose.grossSalesTotal)} />
              <SummaryCard label="返金額" value={yen(dailyClose.refundTotal)} />
              <SummaryCard label="純売上" value={yen(dailyClose.netSalesTotal)} />
              <SummaryCard label="税額" value={yen(dailyClose.taxTotal)} />
              <SummaryCard label="原価" value={yen(dailyClose.costTotal)} />
              <SummaryCard label="粗利" value={yen(dailyClose.grossProfit)} />
              <SummaryCard label="返金件数" value={dailyClose.refundCount} />
            </div>
            <div className="analyticsGrid">
              <div className="panel compactPanel">
                <SectionTitle title="決済手段別" />
                <div className="paymentSummaryLine"><span>cash</span><em>{yen(dailyClose.cashTotal)}</em></div>
                <div className="paymentSummaryLine"><span>card</span><em>{yen(dailyClose.cardTotal)}</em></div>
                <div className="paymentSummaryLine"><span>qr</span><em>{yen(dailyClose.qrTotal)}</em></div>
              </div>
              <div className="panel compactPanel">
                <SectionTitle title="Provider 別" />
                <div className="paymentSummaryLine"><span>internal</span><em>{yen(dailyClose.internalProviderTotal)}</em></div>
                <div className="paymentSummaryLine"><span>mock</span><em>{yen(dailyClose.mockProviderTotal)}</em></div>
              </div>
              <div className="panel compactPanel">
                <SectionTitle title="Payment status" />
                <div className="paymentSummaryLine"><span>paid</span><strong>{dailyClose.paidCount}</strong></div>
                <div className="paymentSummaryLine"><span>partial_refunded</span><strong>{dailyClose.partialRefundedCount}</strong></div>
                <div className="paymentSummaryLine"><span>refunded</span><strong>{dailyClose.refundedCount}</strong></div>
                <div className="paymentSummaryLine"><span>failed</span><strong>{dailyClose.failedCount}</strong></div>
                <div className="paymentSummaryLine"><span>cancelled</span><strong>{dailyClose.cancelledCount}</strong></div>
              </div>
            </div>
            <Banner>failed / cancelled は売上対象外です。partial_refunded は支払額から返金累計を差し引いて純売上へ反映します。</Banner>
            {dailyClose.closedAt && <p className="muted">closed: {dailyClose.closedAt} / {dailyClose.closedByUserDisplayName || dailyClose.closedByUserId || '-'}</p>}
            {dailyClose.reopenedAt && <p className="muted">reopened: {dailyClose.reopenedAt} / {dailyClose.reopenReason || '-'}</p>}
          </>
        )}
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
                  <span>{item.quantity} 点 / 売上 {yen(item.sales_total)}</span>
                  <small>原価 {yen(item.cost_total || 0)} / 粗利 {yen(item.gross_profit || 0)} / 粗利率 {percent(item.gross_margin_rate)}</small>
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
