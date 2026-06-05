import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { yen } from '../domain/money';
import type { CartItem, MenuCategory, MenuItem } from '../domain/types';

interface Props {
  tableCode: string;
}

export function CustomerOrderPage({ tableCode }: Props) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [session, setSession] = useState<{ id: string; status: string } | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const orderLocked = Boolean(session && !['seated', 'ordering'].includes(session.status));

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      cafeApi.menu(tableCode),
      cafeApi.openSession(tableCode)
    ]).then(([menuData, sessionData]) => {
      setCategories(menuData.categories);
      setActiveCategoryId(menuData.categories[0]?.id || '');
      setSession(sessionData.session);
    }).catch((event: Error) => setError(event.message)).finally(() => setLoading(false));
  }, [tableCode]);

  useEffect(() => {
    if (!session?.id) return;
    const load = () => {
      void cafeApi.currentSession(tableCode).then((data) => {
        if (data.session) setSession(data.session);
      });
      void cafeApi.history(tableCode, session.id).then((data) => setHistory(data.items));
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [session?.id, tableCode]);

  const visibleItems = categories.find((category) => category.id === activeCategoryId)?.items || [];
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => {
      const optionTotal = item.menuItem.options
        .flatMap((option) => option.choices)
        .filter((choice) => item.choiceIds.includes(choice.id))
        .reduce((choiceSum, choice) => choiceSum + choice.priceDelta, 0);
      return sum + (item.menuItem.price + optionTotal) * item.quantity;
    }, 0);
    return { subtotal, tax: Math.round(subtotal * 0.1), total: Math.round(subtotal * 1.1) };
  }, [cart]);

  function addItem(menuItem: MenuItem) {
    if (menuItem.soldOut || orderLocked) return;
    const choiceIds = menuItem.options.flatMap((option) => option.required ? [option.choices[0]?.id].filter(Boolean) as string[] : []);
    setCart((current) => [...current, { localId: crypto.randomUUID(), menuItem, quantity: 1, choiceIds, customerNote: '' }]);
  }

  async function submit() {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await cafeApi.submitOrder(tableCode, cart.map((item) => ({
        menu_item_id: item.menuItem.id,
        quantity: item.quantity,
        choice_ids: item.choiceIds,
        customer_note: item.customerNote
      })));
      setCart([]);
      setMessage(`${result.orderNo} を送信しました`);
    } catch (event) {
      setError(event instanceof Error ? event.message : '注文送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  async function requestPayment() {
    if (submitting || !session || orderLocked) return;
    setSubmitting(true);
    setError('');
    try {
      await cafeApi.requestPayment(tableCode);
      const current = await cafeApi.currentSession(tableCode);
      setSession(current.session);
      setCart([]);
      setMessage('会計を依頼しました');
    } catch (event) {
      setError(event instanceof Error ? event.message : '会計依頼に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell customer">
      <section className="toolbar">
        <div>
          <p className="eyebrow">カフェ・ルポ / Cafe Repos</p>
          <h1>{tableCode} 注文</h1>
        </div>
        <button disabled={submitting || loading} onClick={() => void cafeApi.staffCall(tableCode, '席端末から呼び出し').then(() => setMessage('スタッフを呼び出しました')).catch((event: Error) => setError(event.message))}>スタッフ呼出</button>
      </section>
      {loading && <p className="notice">メニューを読み込み中です</p>}
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">API エラー: {error}</p>}
      {orderLocked && <p className="warning">会計依頼後または精算済みのため、新規注文はできません。</p>}
      <section className="customerGrid">
        <aside className="panel">
          {categories.length === 0 && !loading && !error && <p className="empty">表示できるメニューがありません</p>}
          {categories.map((category) => (
            <button className={category.id === activeCategoryId ? 'selected' : ''} key={category.id} onClick={() => setActiveCategoryId(category.id)}>
              {category.name}
            </button>
          ))}
        </aside>
        <section className="menuGrid">
          {categories.length > 0 && visibleItems.length === 0 && !loading && !error && <p className="empty">このカテゴリには商品がありません</p>}
          {visibleItems.map((item) => (
            <article className="itemCard" key={item.id}>
              {item.imageUrl && <img src={item.imageUrl} alt="" />}
              <div>
                <h2>{item.name}</h2>
                <p>{item.description}</p>
                <p className="price">{yen(item.price)}</p>
                {item.allergyNote && <p className="tag">アレルギー: {item.allergyNote}</p>}
              </div>
              <button disabled={item.soldOut || orderLocked || submitting} onClick={() => addItem(item)}>{item.soldOut ? '売切' : '追加'}</button>
            </article>
          ))}
        </section>
        <aside className="panel cart">
          <h2>カート</h2>
          {cart.length === 0 && <p className="empty">カートは空です。</p>}
          {cart.map((item) => (
            <div className="line" key={item.localId}>
              <span>{item.menuItem.name}</span>
              <input type="number" min={1} max={99} value={item.quantity} onChange={(event) => {
                const quantity = Math.max(1, Math.min(99, Number(event.target.value)));
                setCart((current) => current.map((candidate) => candidate.localId === item.localId ? { ...candidate, quantity } : candidate));
              }} />
              <button onClick={() => setCart((current) => current.filter((candidate) => candidate.localId !== item.localId))}>削除</button>
            </div>
          ))}
          <dl className="totals"><dt>小計</dt><dd>{yen(totals.subtotal)}</dd><dt>税</dt><dd>{yen(totals.tax)}</dd><dt>合計</dt><dd>{yen(totals.total)}</dd></dl>
          <button className="primary" disabled={cart.length === 0 || orderLocked || submitting} onClick={() => void submit()}>{submitting ? '送信中' : '注文確定'}</button>
          <button disabled={!session || orderLocked || submitting} onClick={() => void requestPayment()}>会計へ進む</button>
          <h2>注文履歴</h2>
          <p>{history.length > 0 ? `${history.length} 件の明細` : '注文履歴はありません。'}</p>
        </aside>
      </section>
    </main>
  );
}
