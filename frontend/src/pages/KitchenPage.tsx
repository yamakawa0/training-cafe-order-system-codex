import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Badge, Banner, EmptyState, SectionTitle, StatusPill } from '../components/ui';
import { minutes } from '../domain/money';
import type { KitchenTicket, OrderItemStatus } from '../domain/types';

const columns: Array<{ status: OrderItemStatus; label: string; hint: string }> = [
  { status: 'ordered', label: '未受付', hint: '受付待ち' },
  { status: 'accepted', label: '受付済み', hint: '調理開始待ち' },
  { status: 'cooking', label: '調理中', hint: '完了待ち' },
  { status: 'ready', label: '提供待ち', hint: 'ホールへ連携済み' }
];

const nextActions: Partial<Record<OrderItemStatus, Array<{ label: string; status: OrderItemStatus; primary?: boolean }>>> = {
  ordered: [{ label: '受付', status: 'accepted', primary: true }, { label: '取消', status: 'cancelled' }],
  accepted: [{ label: '調理開始', status: 'cooking', primary: true }, { label: '取消', status: 'cancelled' }],
  cooking: [{ label: '調理完了', status: 'ready', primary: true }, { label: '取消', status: 'cancelled' }]
};

function urgency(seconds: number) {
  if (seconds >= 900) return 'danger';
  if (seconds >= 480) return 'warning';
  return 'neutral';
}

export function KitchenPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = () => {
    setError('');
    return cafeApi.kitchenTickets()
      .then((data) => setTickets(data.tickets))
      .catch((event: Error) => setError(event.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const counts = useMemo(() => columns.map((column) => ({
    ...column,
    tickets: tickets.filter((ticket) => ticket.status === column.status)
  })), [tickets]);

  function update(ticket: KitchenTicket, status: OrderItemStatus, label: string) {
    setBusyId(ticket.order_item_id);
    setError('');
    void cafeApi.kitchenStatus(ticket.order_item_id, status)
      .then(() => {
        setMessage(`${ticket.item_name} を ${label} にしました`);
        return load();
      })
      .catch((event: Error) => setError(event.message))
      .finally(() => setBusyId(''));
  }

  return (
    <main className="shell kitchen">
      <AppHeader
        title="キッチン注文管理"
        subtitle="5秒ごとに自動更新"
        meta={<Badge tone="info">未完了 {tickets.length} 件</Badge>}
      />
      {loading && <Banner>注文を読み込み中です。</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <section className="kanbanGrid">
        {counts.map((column) => (
          <section className="kanbanColumn" key={column.status}>
            <SectionTitle title={`${column.label} (${column.tickets.length})`} subtitle={column.hint} />
            <div className="ticketStack">
              {column.tickets.length === 0 && !loading && <EmptyState>対象の注文はありません</EmptyState>}
              {column.tickets.map((ticket) => (
                <article className={`ticketCard ${ticket.status} urgency-${urgency(ticket.elapsed_seconds)} ${busyId === ticket.order_item_id ? 'isBusy' : ''}`} key={ticket.order_item_id}>
                  <header>
                    <div>
                      <strong>{ticket.table_code}</strong>
                      <span>{ticket.table_name}</span>
                    </div>
                    <Badge tone={urgency(ticket.elapsed_seconds) === 'danger' ? 'danger' : urgency(ticket.elapsed_seconds) === 'warning' ? 'warning' : 'neutral'}>
                      {minutes(ticket.elapsed_seconds)}
                    </Badge>
                  </header>
                  <h3>{ticket.item_name} x {ticket.quantity}</h3>
                  <div className="detailRows">
                    <p><span>注文</span>{ticket.order_no}</p>
                    <p><span>オプション</span>{ticket.options_text || 'なし'}</p>
                    <p><span>メモ</span>{ticket.customer_note || 'なし'}</p>
                  </div>
                  <div className="badgeRow">
                    <StatusPill status={ticket.status} />
                    {ticket.allergy_note && <Badge tone="danger">アレルギー: {ticket.allergy_note}</Badge>}
                  </div>
                  <footer>
                    {(nextActions[ticket.status] || []).map((action) => (
                      <button
                        className={action.primary ? 'primary' : 'dangerButton'}
                        disabled={busyId === ticket.order_item_id}
                        key={action.status}
                        onClick={() => update(ticket, action.status, action.label)}
                      >
                        {busyId === ticket.order_item_id ? '更新中' : action.label}
                      </button>
                    ))}
                    {ticket.status === 'ready' && <span className="readyText">配膳待ち</span>}
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
