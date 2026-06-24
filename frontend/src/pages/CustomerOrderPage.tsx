import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Badge, Banner, EmptyState, SectionTitle, StatusPill, TerminalIndicator } from '../components/ui';
import { yen } from '../domain/money';
import type { CartItem, MenuCategory, MenuItem } from '../domain/types';

interface Props {
  tableCode: string;
}

interface OrderHistoryItem {
  order_item_id?: string;
  order_no?: string;
  item_name?: string;
  quantity?: number;
  status?: string;
  options_text?: string;
  customer_note?: string;
}

function defaultChoices(menuItem: MenuItem) {
  return menuItem.options.flatMap((option) => (option.required ? [option.choices[0]?.id].filter(Boolean) as string[] : []));
}

function optionTotal(menuItem: MenuItem, choiceIds: string[]) {
  return menuItem.options
    .flatMap((option) => option.choices)
    .filter((choice) => choiceIds.includes(choice.id))
    .reduce((sum, choice) => sum + choice.priceDelta, 0);
}

function selectedOptionText(menuItem: MenuItem, choiceIds: string[]) {
  return menuItem.options.flatMap((option) => {
    const names = option.choices.filter((choice) => choiceIds.includes(choice.id)).map((choice) => choice.name);
    return names.length ? [`${option.name}: ${names.join('、')}`] : [];
  }).join(' / ');
}

function CustomerMenuImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = (src || '').trim();

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (!imageUrl || failed) {
    return <div className="itemImageFallback">画像なし</div>;
  }

  return <img src={imageUrl} alt={alt} onError={() => setFailed(true)} />;
}

export function CustomerOrderPage({ tableCode }: Props) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [session, setSession] = useState<{ id: string; status: string } | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [detailChoices, setDetailChoices] = useState<string[]>([]);
  const [detailNote, setDetailNote] = useState('');
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
      }).catch(() => undefined);
      void cafeApi.history(tableCode, session.id).then((data) => setHistory(data.items as OrderHistoryItem[])).catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [session?.id, tableCode]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const visibleItems = categories.find((category) => category.id === activeCategoryId)?.items || [];
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.menuItem.price + optionTotal(item.menuItem, item.choiceIds)) * item.quantity, 0);
    return { subtotal, tax: Math.round(subtotal * 0.1), total: Math.round(subtotal * 1.1) };
  }, [cart]);

  function openDetail(menuItem: MenuItem) {
    if (menuItem.soldOut || orderLocked) return;
    setDetailItem(menuItem);
    setDetailChoices(defaultChoices(menuItem));
    setDetailNote('');
  }

  function addItem(menuItem: MenuItem, choiceIds = defaultChoices(menuItem), customerNote = '') {
    if (menuItem.soldOut || orderLocked) return;
    const validationError = menuItem.options.map((option) => {
      const selectedCount = option.choices.filter((choice) => choiceIds.includes(choice.id)).length;
      const minSelect = option.required ? Math.max(1, option.minSelect || 0) : option.minSelect || 0;
      const maxSelect = option.multiSelect ? option.maxSelect : 1;
      if (selectedCount < minSelect) return `${option.name}を選択してください。`;
      if (maxSelect !== null && selectedCount > maxSelect) return `${option.name}は${maxSelect}個まで選択できます。`;
      return '';
    }).find(Boolean);
    if (validationError) {
      setError(validationError);
      return;
    }
    setCart((current) => [...current, { localId: crypto.randomUUID(), menuItem, quantity: 1, choiceIds, customerNote }]);
    setDetailItem(null);
    setMessage(`${menuItem.name} をカートに追加しました`);
  }

  function updateQuantity(localId: string, delta: number) {
    setCart((current) => current
      .map((item) => item.localId === localId ? { ...item, quantity: Math.max(1, Math.min(99, item.quantity + delta)) } : item)
      .filter((item) => item.quantity > 0));
  }

  function toggleChoice(item: MenuItem, optionId: string, choiceId: string, multiSelect: boolean) {
    const optionChoiceIds = item.options.find((option) => option.id === optionId)?.choices.map((choice) => choice.id) || [];
    setDetailChoices((current) => {
      if (multiSelect) {
        const option = item.options.find((candidate) => candidate.id === optionId);
        const selectedCount = current.filter((id) => optionChoiceIds.includes(id)).length;
        if (!current.includes(choiceId) && option?.maxSelect !== null && option?.maxSelect !== undefined && selectedCount >= option.maxSelect) return current;
        return current.includes(choiceId) ? current.filter((id) => id !== choiceId) : [...current, choiceId];
      }
      return [...current.filter((id) => !optionChoiceIds.includes(id)), choiceId];
    });
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
      if (session?.id) {
        const data = await cafeApi.history(tableCode, session.id);
        setHistory(data.items as OrderHistoryItem[]);
      }
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
      setMessage('会計を依頼しました。スタッフが確認します。');
    } catch (event) {
      setError(event instanceof Error ? event.message : '会計依頼に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell customer">
      <AppHeader
        title={`${tableCode} ご注文`}
        subtitle="顧客用タブレット"
        meta={<TerminalIndicator label={`テーブル ${tableCode}`} status={session?.status || 'loading'} />}
        actions={<button className="staffButton" disabled={submitting || loading} onClick={() => void cafeApi.staffCall(tableCode, '席端末から呼び出し').then(() => setMessage('スタッフを呼び出しました')).catch((event: Error) => setError(event.message))}>スタッフ呼出</button>}
      />
      {loading && <Banner>メニューを読み込み中です</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="danger">API エラー: {error}</Banner>}
      {orderLocked && <Banner tone="warning">会計依頼後または精算済みのため、新規注文はできません。カート内容は変更できません。</Banner>}
      <section className="customerGrid">
        <aside className="panel categoryPanel">
          <SectionTitle title="カテゴリ" />
          {categories.length === 0 && !loading && !error && <EmptyState>表示できるメニューがありません</EmptyState>}
          <div className="pillStack">
            {categories.map((category) => (
              <button className={category.id === activeCategoryId ? 'selected' : ''} key={category.id} onClick={() => setActiveCategoryId(category.id)}>
                {category.name}
              </button>
            ))}
          </div>
        </aside>
        <section className="menuArea">
          <SectionTitle title={categories.find((category) => category.id === activeCategoryId)?.name || 'メニュー'} subtitle="写真、価格、アレルギー情報を確認して追加してください。" />
          <div className="menuGrid">
            {categories.length > 0 && visibleItems.length === 0 && !loading && !error && <EmptyState>このカテゴリには商品がありません</EmptyState>}
            {visibleItems.map((item) => (
              <article className={`itemCard ${item.soldOut ? 'soldOut' : ''}`} key={item.id}>
                <CustomerMenuImage src={item.imageUrl} alt={item.name} />
                <div className="itemBody">
                  <div className="itemHeading">
                    <h2>{item.name}</h2>
                    <p className="price">{yen(item.price)}</p>
                  </div>
                  <p>{item.description}</p>
                  <div className="badgeRow">
                    {item.soldOut && <Badge tone="danger">売切</Badge>}
                    {!item.soldOut && item.lowStock && <Badge tone="warning">残りわずか</Badge>}
                    {item.allergyNote && <Badge tone="danger">アレルギー: {item.allergyNote}</Badge>}
                    {item.options.length > 0 && <Badge tone="info">オプションあり</Badge>}
                  </div>
                </div>
                <div className="itemActions">
                  <button disabled={item.soldOut || orderLocked || submitting} onClick={() => openDetail(item)}>選択</button>
                  <button className="primary" disabled={item.soldOut || orderLocked || submitting} onClick={() => addItem(item)}>{item.soldOut ? '売切' : '追加'}</button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="panel cartPanel">
          <SectionTitle title="カート" subtitle={`${cart.length} 件`} />
          {cart.length === 0 && <EmptyState>カートは空です。</EmptyState>}
          <div className="cartLines">
            {cart.map((item) => (
              <div className="cartLine" key={item.localId}>
                <div>
                  <strong>{item.menuItem.name}</strong>
                  <span>{yen((item.menuItem.price + optionTotal(item.menuItem, item.choiceIds)) * item.quantity)}</span>
                  {selectedOptionText(item.menuItem, item.choiceIds) && <small>{selectedOptionText(item.menuItem, item.choiceIds)}</small>}
                  {item.customerNote && <small>{item.customerNote}</small>}
                </div>
                <div className="stepper">
                  <button disabled={submitting || orderLocked} onClick={() => updateQuantity(item.localId, -1)}>-</button>
                  <span>{item.quantity}</span>
                  <button disabled={submitting || orderLocked} onClick={() => updateQuantity(item.localId, 1)}>+</button>
                </div>
                <button className="dangerButton" disabled={submitting || orderLocked} onClick={() => setCart((current) => current.filter((candidate) => candidate.localId !== item.localId))}>削除</button>
              </div>
            ))}
          </div>
          <dl className="totals emphasized"><dt>小計</dt><dd>{yen(totals.subtotal)}</dd><dt>税</dt><dd>{yen(totals.tax)}</dd><dt>合計</dt><dd>{yen(totals.total)}</dd></dl>
          <button className="primary largeButton" disabled={cart.length === 0 || orderLocked || submitting} onClick={() => void submit()}>{submitting ? '送信中' : '注文確定'}</button>
          <button className="paymentButton largeButton" disabled={!session || orderLocked || submitting} onClick={() => void requestPayment()}>会計依頼</button>
          <SectionTitle title="注文履歴" />
          <div className="historyList">
            {history.length === 0 && <EmptyState>注文履歴はありません。</EmptyState>}
            {history.map((item, index) => (
              <div className="historyLine" key={item.order_item_id || `${item.order_no}-${index}`}>
                <div>
                  <strong>{item.item_name || '明細'}</strong>
                  <span>{item.order_no} / 数量 {item.quantity || 0}</span>
                  {item.options_text && <small>{item.options_text}</small>}
                </div>
                <StatusPill status={item.status || 'unknown'} />
              </div>
            ))}
          </div>
        </aside>
      </section>
      {detailItem && (
        <div className="modalBackdrop" role="presentation" onClick={() => setDetailItem(null)}>
          <section className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <SectionTitle title={detailItem.name} subtitle={`${yen(detailItem.price + optionTotal(detailItem, detailChoices))} から`} />
            <p>{detailItem.description}</p>
            {detailItem.options.map((option) => (
              <div className="optionGroup" key={option.id}>
                <h3>{option.name} {option.required && <Badge tone="warning">必須</Badge>} {option.maxSelect !== null && <Badge tone="info">最大 {option.maxSelect}</Badge>}</h3>
                <div className="choiceGrid">
                  {option.choices.map((choice) => (
                    <button
                      className={detailChoices.includes(choice.id) ? 'selected' : ''}
                      key={choice.id}
                      onClick={() => toggleChoice(detailItem, option.id, choice.id, option.multiSelect)}
                    >
                      {choice.name}{choice.priceDelta ? ` +${yen(choice.priceDelta)}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <label className="fieldLabel">
              メモ
              <input value={detailNote} onChange={(event) => setDetailNote(event.target.value)} placeholder="例: 氷少なめ、取り皿希望" />
            </label>
            <footer className="modalActions">
              <button onClick={() => setDetailItem(null)}>閉じる</button>
              <button className="primary" onClick={() => addItem(detailItem, detailChoices, detailNote)}>カートに追加</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
