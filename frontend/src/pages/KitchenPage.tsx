import { useEffect, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { minutes } from '../domain/money';
import type { KitchenTicket, OrderItemStatus } from '../domain/types';

const nextActions: Partial<Record<OrderItemStatus, Array<{ label: string; status: OrderItemStatus }>>> = {
  ordered: [{ label: '受付', status: 'accepted' }, { label: '取消', status: 'cancelled' }],
  accepted: [{ label: '調理開始', status: 'cooking' }, { label: '取消', status: 'cancelled' }],
  cooking: [{ label: '調理完了', status: 'ready' }, { label: '取消', status: 'cancelled' }]
};

export function KitchenPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [filter, setFilter] = useState<OrderItemStatus | 'all'>('all');
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

  const visible = filter === 'all' ? tickets : tickets.filter((ticket) => ticket.status === filter);

  return (
    <main className="shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">カフェ・ルポ / Cafe Repos</p>
          <h1>注文一覧</h1>
        </div>
        <div className="segmented">
          {(['all', 'ordered', 'accepted', 'cooking', 'ready'] as const).map((status) => (
            <button className={filter === status ? 'selected' : ''} key={status} onClick={() => setFilter(status)}>{status}</button>
          ))}
        </div>
      </section>
      {loading && <p className="notice">読み込み中です。</p>}
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}
      <section className="ticketGrid">
        {visible.length === 0 && !loading && <p className="empty">対象の注文明細はありません。</p>}
        {visible.map((ticket) => (
          <article className={`ticket ${ticket.status}`} key={ticket.order_item_id}>
            <header>
              <strong>{ticket.table_code}</strong>
              <span>{minutes(ticket.elapsed_seconds)}</span>
            </header>
            <h2>{ticket.item_name} x {ticket.quantity}</h2>
            <p>{ticket.options_text || 'オプションなし'}</p>
            {ticket.customer_note && <p className="tag">{ticket.customer_note}</p>}
            {ticket.allergy_note && <p className="warning">アレルギー: {ticket.allergy_note}</p>}
            <footer>
              <span className="status">{ticket.status}</span>
              {(nextActions[ticket.status] || []).map((action) => (
                <button disabled={busyId === ticket.order_item_id} key={action.status} onClick={() => {
                  setBusyId(ticket.order_item_id);
                  setError('');
                  void cafeApi.kitchenStatus(ticket.order_item_id, action.status)
                    .then(() => {
                      setMessage(`${ticket.item_name} を ${action.label} にしました`);
                      return load();
                    })
                    .catch((event: Error) => setError(event.message))
                    .finally(() => setBusyId(''));
                }}>{busyId === ticket.order_item_id ? '更新中' : action.label}</button>
              ))}
            </footer>
          </article>
        ))}
      </section>
    </main>
  );
}
