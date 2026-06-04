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
  const paymentLocked = session?.status === 'payment_requested';

  useEffect(() => {
    void cafeApi.menu(tableCode).then((data) => {
      setCategories(data.categories);
      setActiveCategoryId(data.categories[0]?.id || '');
    });
    void cafeApi.openSession(tableCode).then((data) => setSession(data.session));
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
    if (menuItem.soldOut || paymentLocked) return;
    const choiceIds = menuItem.options.flatMap((option) => option.required ? [option.choices[0]?.id].filter(Boolean) as string[] : []);
    setCart((current) => [...current, { localId: crypto.randomUUID(), menuItem, quantity: 1, choiceIds, customerNote: '' }]);
  }

  async function submit() {
    if (cart.length === 0) return;
    const result = await cafeApi.submitOrder(tableCode, cart.map((item) => ({
      menu_item_id: item.menuItem.id,
      quantity: item.quantity,
      choice_ids: item.choiceIds,
      customer_note: item.customerNote
    })));
    setCart([]);
    setMessage(`${result.orderNo} を送信しました`);
  }

  async function requestPayment() {
    await cafeApi.requestPayment(tableCode);
    const current = await cafeApi.currentSession(tableCode);
    setSession(current.session);
    setMessage('会計を依頼しました');
  }

  return (
    <main className="shell customer">
      <section className="toolbar">
        <div>
          <p className="eyebrow">Customer Terminal</p>
          <h1>{tableCode} 注文</h1>
        </div>
        <button onClick={() => void cafeApi.staffCall(tableCode, '席端末から呼び出し').then(() => setMessage('スタッフを呼び出しました'))}>スタッフ呼出</button>
      </section>
      {message && <p className="notice">{message}</p>}
      {paymentLocked && <p className="warning">会計依頼済みのため、新規注文はできません。</p>}
      <section className="customerGrid">
        <aside className="panel">
          {categories.map((category) => (
            <button className={category.id === activeCategoryId ? 'selected' : ''} key={category.id} onClick={() => setActiveCategoryId(category.id)}>
              {category.name}
            </button>
          ))}
        </aside>
        <section className="menuGrid">
          {visibleItems.map((item) => (
            <article className="itemCard" key={item.id}>
              {item.imageUrl && <img src={item.imageUrl} alt="" />}
              <div>
                <h2>{item.name}</h2>
                <p>{item.description}</p>
                <p className="price">{yen(item.price)}</p>
                {item.allergyNote && <p className="tag">アレルギー: {item.allergyNote}</p>}
              </div>
              <button disabled={item.soldOut || paymentLocked} onClick={() => addItem(item)}>{item.soldOut ? '売切' : '追加'}</button>
            </article>
          ))}
        </section>
        <aside className="panel cart">
          <h2>カート</h2>
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
          <button className="primary" disabled={cart.length === 0 || paymentLocked} onClick={() => void submit()}>注文確定</button>
          <button onClick={() => void requestPayment()}>会計へ進む</button>
          <h2>注文履歴</h2>
          <p>{history.length} 件の明細</p>
        </aside>
      </section>
    </main>
  );
}
