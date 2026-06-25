import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Badge, Banner, EmptyState, SectionTitle } from '../components/ui';
import { yen } from '../domain/money';
import type { AdminMenuCategory, AdminMenuItem, AdminMenuItemInput, AdminMenuItemOption, InventoryMovement } from '../domain/types';

type FormState = {
  id?: string;
  name: string;
  description: string;
  price: string;
  costPrice: string;
  taxRate: string;
  imageUrl: string;
  categoryId: string;
  displayOrder: string;
  active: boolean;
  soldOut: boolean;
  trackStock: boolean;
  stockQuantity: string;
  lowStockThreshold: string;
  allergyNote: string;
};

type CategoryFormState = {
  id?: string;
  name: string;
  displayOrder: string;
  active: boolean;
};

type OptionFormState = {
  id?: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  minSelect: string;
  maxSelect: string;
  displayOrder: string;
  active: boolean;
};

type ChoiceDraft = {
  name: string;
  priceDelta: string;
  displayOrder: string;
};

const emptyForm: FormState = {
  name: '',
  description: '',
  price: '0',
  costPrice: '0',
  taxRate: '10',
  imageUrl: '',
  categoryId: '',
  displayOrder: '10',
  active: true,
  soldOut: false,
  trackStock: false,
  stockQuantity: '0',
  lowStockThreshold: '0',
  allergyNote: ''
};

const emptyCategoryForm: CategoryFormState = {
  name: '',
  displayOrder: '10',
  active: true
};

const emptyOptionForm: OptionFormState = {
  name: '',
  required: false,
  multiSelect: false,
  minSelect: '0',
  maxSelect: '',
  displayOrder: '10',
  active: true
};

function toForm(item: AdminMenuItem): FormState {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: String(item.price),
    costPrice: String(item.costPrice),
    taxRate: String(item.taxRate),
    imageUrl: item.imageUrl || '',
    categoryId: item.categoryId,
    displayOrder: String(item.displayOrder),
    active: item.active,
    soldOut: item.soldOut,
    trackStock: item.trackStock,
    stockQuantity: String(item.stockQuantity),
    lowStockThreshold: String(item.lowStockThreshold),
    allergyNote: item.allergyNote || ''
  };
}

function toInput(form: FormState): AdminMenuItemInput {
  return {
    category_id: form.categoryId,
    name: form.name.trim(),
    description: form.description,
    price: Number(form.price),
    cost_price: Number(form.costPrice),
    tax_rate: Number(form.taxRate),
    image_url: form.imageUrl.trim(),
    display_order: Number(form.displayOrder),
    active: form.active,
    sold_out: form.soldOut,
    track_stock: form.trackStock,
    stock_quantity: Number(form.stockQuantity),
    low_stock_threshold: Number(form.lowStockThreshold),
    allergy_note: form.allergyNote
  };
}

function optionToForm(option: AdminMenuItemOption): OptionFormState {
  return {
    id: option.id,
    name: option.name,
    required: option.required,
    multiSelect: option.multiSelect,
    minSelect: String(option.minSelect),
    maxSelect: option.maxSelect === null ? '' : String(option.maxSelect),
    displayOrder: String(option.displayOrder),
    active: option.active
  };
}

function validateImageUrl(value: string) {
  const imageUrl = value.trim();
  const lower = imageUrl.toLowerCase();
  if (!imageUrl) return '';
  if (imageUrl.length > 2048) return '画像 URL は 2048 文字以内で入力してください。';
  if (lower.startsWith('data:') || lower.startsWith('javascript:') || lower.startsWith('file:')) return '画像 URL は http(s) URL または / から始まるパスを指定してください';
  if (lower.startsWith('http://') || lower.startsWith('https://') || imageUrl.startsWith('/')) return '';
  return '画像 URL は http(s) URL または / から始まるパスを指定してください';
}

function validate(form: FormState) {
  if (!form.name.trim()) return '商品名は必須です。';
  if (!form.categoryId) return 'カテゴリは必須です。';
  if (!Number.isInteger(Number(form.price)) || Number(form.price) < 0) return '価格は 0 以上の整数で入力してください。';
  if (!Number.isInteger(Number(form.costPrice)) || Number(form.costPrice) < 0) return '原価は 0 以上の整数で入力してください。';
  if (!Number.isFinite(Number(form.taxRate)) || Number(form.taxRate) < 0) return '税率は 0 以上で入力してください。';
  if (!Number.isInteger(Number(form.displayOrder))) return '表示順は整数で入力してください。';
  if (!Number.isInteger(Number(form.stockQuantity)) || Number(form.stockQuantity) < 0) return '在庫数は 0 以上の整数で入力してください。';
  if (!Number.isInteger(Number(form.lowStockThreshold)) || Number(form.lowStockThreshold) < 0) return '低在庫閾値は 0 以上の整数で入力してください。';
  const imageError = validateImageUrl(form.imageUrl);
  if (imageError) return imageError;
  return '';
}

function grossProfit(price: number, costPrice: number) {
  return price - costPrice;
}

function grossMarginRate(price: number, costPrice: number) {
  if (price <= 0) return 0;
  return Math.round((grossProfit(price, costPrice) / price) * 1000) / 10;
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function movementLabel(type: string) {
  const labels: Record<string, string> = {
    manual_set: '直接設定',
    manual_adjust: '差分調整',
    order_reserved: '注文引当',
    order_cancel_restored: '取消戻し',
    auto_sold_out: '自動売切'
  };
  return labels[type] || type;
}

function signedQuantity(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function MenuImagePreview({ src, alt, compact = false }: { src: string; alt: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = src.trim();

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (!imageUrl || failed) {
    return <div className={compact ? 'adminMenuThumb imageFallback' : 'adminImagePreview imageFallback'}>画像なし</div>;
  }

  return <img className={compact ? 'adminMenuThumb' : 'adminImagePreview'} src={imageUrl} alt={alt} onError={() => setFailed(true)} />;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('ja-JP') : '-';
}

export function AdminMenuPage() {
  const [categories, setCategories] = useState<AdminMenuCategory[]>([]);
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [options, setOptions] = useState<AdminMenuItemOption[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [movementType, setMovementType] = useState('');
  const [movementLoading, setMovementLoading] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [optionForm, setOptionForm] = useState<OptionFormState>(emptyOptionForm);
  const [choiceDrafts, setChoiceDrafts] = useState<Record<string, ChoiceDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const filteredCategoryName = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId)?.name || '全カテゴリ',
    [categories, selectedCategoryId]
  );
  const formPrice = Number(form.price) || 0;
  const formCostPrice = Number(form.costPrice) || 0;
  const formGrossProfit = grossProfit(formPrice, formCostPrice);
  const formGrossMarginRate = grossMarginRate(formPrice, formCostPrice);
  const formIsLoss = formCostPrice > formPrice;

  const load = () => {
    setLoading(true);
    setError('');
    void Promise.all([
      cafeApi.adminMenuCategories(),
      cafeApi.adminMenuItems({ categoryId: selectedCategoryId || undefined, keyword: keyword || undefined })
    ]).then(([categoryData, itemData]) => {
      setCategories(categoryData.categories);
      setItems(itemData.items);
      setForm((current) => (current.categoryId ? current : { ...current, categoryId: categoryData.categories[0]?.id || '' }));
    }).catch((event: Error) => setError(event.message)).finally(() => setLoading(false));
  };

  const loadCategories = async () => {
    const data = await cafeApi.adminMenuCategories();
    setCategories(data.categories);
  };

  const loadOptions = async (itemId: string) => {
    const data = await cafeApi.adminMenuItemOptions(itemId);
    setOptions(data.options);
    setChoiceDrafts((current) => {
      const next = { ...current };
      data.options.forEach((option) => {
        if (!next[option.id]) next[option.id] = { name: '', priceDelta: '0', displayOrder: String((option.choices[option.choices.length - 1]?.displayOrder || 0) + 10) };
      });
      return next;
    });
  };

  const loadInventoryMovements = async (itemId: string, type = movementType) => {
    setMovementLoading(true);
    try {
      const data = await cafeApi.adminMenuItemInventoryMovements(itemId, { movementType: type || undefined, limit: 20 });
      setInventoryMovements(data.movements);
    } finally {
      setMovementLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedCategoryId]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  function startNew() {
    setForm({ ...emptyForm, categoryId: selectedCategoryId || categories[0]?.id || '', displayOrder: String((items[items.length - 1]?.displayOrder || 0) + 10) });
    setOptions([]);
    setInventoryMovements([]);
    setAdjustDelta('');
    setAdjustReason('');
    setOptionForm(emptyOptionForm);
  }

  function startEditItem(item: AdminMenuItem) {
    setForm(toForm(item));
    setOptionForm(emptyOptionForm);
    setAdjustDelta('');
    setAdjustReason('');
    void loadOptions(item.id).catch((event: Error) => setError(event.message));
    void loadInventoryMovements(item.id).catch((event: Error) => setError(event.message));
  }

  async function save() {
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input = toInput(form);
      const result = form.id
        ? await cafeApi.adminUpdateMenuItem({ ...input, item_id: form.id })
        : await cafeApi.adminCreateMenuItem(input);
      setForm(toForm(result.item));
      await loadOptions(result.item.id);
      await loadInventoryMovements(result.item.id);
      setMessage(form.id ? '商品を更新しました。' : '商品を追加しました。');
      await cafeApi.adminMenuItems({ categoryId: selectedCategoryId || undefined, keyword: keyword || undefined }).then((data) => setItems(data.items));
    } catch (event) {
      setError(event instanceof Error ? event.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(action: () => Promise<unknown>, successMessage: string) {
    setSaving(true);
    setError('');
    try {
      await action();
      setMessage(successMessage);
      const data = await cafeApi.adminMenuItems({ categoryId: selectedCategoryId || undefined, keyword: keyword || undefined });
      setItems(data.items);
    } catch (event) {
      setError(event instanceof Error ? event.message : '更新に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  async function saveStock() {
    if (!form.id) return;
    if (!Number.isInteger(Number(form.stockQuantity)) || Number(form.stockQuantity) < 0 || !Number.isInteger(Number(form.lowStockThreshold)) || Number(form.lowStockThreshold) < 0) {
      setError('在庫数と低在庫閾値は 0 以上の整数で入力してください。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await cafeApi.adminUpdateMenuItemStock({
        item_id: form.id,
        track_stock: form.trackStock,
        stock_quantity: Number(form.stockQuantity),
        low_stock_threshold: Number(form.lowStockThreshold)
      });
      setForm(toForm(result.item));
      setMessage('在庫設定を更新しました。');
      const data = await cafeApi.adminMenuItems({ categoryId: selectedCategoryId || undefined, keyword: keyword || undefined });
      setItems(data.items);
      await loadInventoryMovements(result.item.id);
    } catch (event) {
      setError(event instanceof Error ? event.message : '在庫更新に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  async function adjustStock() {
    if (!form.id) return;
    const delta = Number(adjustDelta);
    if (!Number.isInteger(delta) || delta === 0) {
      setError('調整数は 0 以外の整数で入力してください。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await cafeApi.adminAdjustMenuItemStock({
        item_id: form.id,
        delta,
        reason: adjustReason
      });
      setForm(toForm(result.item));
      setAdjustDelta('');
      setAdjustReason('');
      setMessage('在庫を調整しました。');
      const data = await cafeApi.adminMenuItems({ categoryId: selectedCategoryId || undefined, keyword: keyword || undefined });
      setItems(data.items);
      await loadInventoryMovements(result.item.id);
    } catch (event) {
      setError(event instanceof Error ? event.message : '在庫調整に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  async function changeMovementType(type: string) {
    setMovementType(type);
    if (!form.id) return;
    try {
      await loadInventoryMovements(form.id, type);
    } catch (event) {
      setError(event instanceof Error ? event.message : '在庫履歴の取得に失敗しました。');
    }
  }

  async function saveCategory() {
    if (!categoryForm.name.trim()) {
      setError('カテゴリ名は必須です。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input = { name: categoryForm.name.trim(), display_order: Number(categoryForm.displayOrder), active: categoryForm.active };
      const result = categoryForm.id
        ? await cafeApi.adminUpdateMenuCategory({ ...input, category_id: categoryForm.id })
        : await cafeApi.adminCreateMenuCategory(input);
      setCategoryForm({ id: result.category.id, name: result.category.name, displayOrder: String(result.category.displayOrder), active: result.category.active });
      setMessage(categoryForm.id ? 'カテゴリを更新しました。' : 'カテゴリを追加しました。');
      await loadCategories();
    } catch (event) {
      setError(event instanceof Error ? event.message : 'カテゴリ保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  async function updateCategory(action: () => Promise<unknown>, successMessage: string) {
    setSaving(true);
    setError('');
    try {
      await action();
      setMessage(successMessage);
      await loadCategories();
      const itemData = await cafeApi.adminMenuItems({ categoryId: selectedCategoryId || undefined, keyword: keyword || undefined });
      setItems(itemData.items);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'カテゴリ更新に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  function optionInput(itemId: string, optionState: OptionFormState) {
    return {
      item_id: itemId,
      name: optionState.name.trim(),
      required: optionState.required,
      multi_select: optionState.multiSelect,
      min_select: Number(optionState.minSelect),
      max_select: optionState.maxSelect === '' ? null : Number(optionState.maxSelect),
      active: optionState.active,
      display_order: Number(optionState.displayOrder)
    };
  }

  async function saveOption() {
    if (!form.id) return;
    if (!optionForm.name.trim()) {
      setError('オプション名は必須です。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input = optionInput(form.id, optionForm);
      const result = optionForm.id
        ? await cafeApi.adminUpdateMenuItemOption({ ...input, option_id: optionForm.id })
        : await cafeApi.adminCreateMenuItemOption(input);
      setOptionForm(optionToForm(result.option));
      await loadOptions(form.id);
      setMessage(optionForm.id ? 'オプションを更新しました。' : 'オプションを追加しました。');
    } catch (event) {
      setError(event instanceof Error ? event.message : 'オプション保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  async function updateOption(action: () => Promise<unknown>, successMessage: string) {
    if (!form.id) return;
    setSaving(true);
    setError('');
    try {
      await action();
      await loadOptions(form.id);
      setMessage(successMessage);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'オプション更新に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  async function addChoice(option: AdminMenuItemOption) {
    if (!form.id) return;
    const draft = choiceDrafts[option.id] || { name: '', priceDelta: '0', displayOrder: '10' };
    if (!draft.name.trim()) {
      setError('選択肢名は必須です。');
      return;
    }
    await updateOption(
      () => cafeApi.adminCreateMenuOptionChoice({ option_id: option.id, name: draft.name.trim(), price_delta: Number(draft.priceDelta), active: true, display_order: Number(draft.displayOrder) }),
      '選択肢を追加しました。'
    );
    setChoiceDrafts((current) => ({ ...current, [option.id]: { name: '', priceDelta: '0', displayOrder: String((option.choices[option.choices.length - 1]?.displayOrder || 0) + 20) } }));
  }

  return (
    <main className="shell adminMenu">
      <AppHeader
        title="メニュー管理"
        subtitle="店長 PC"
        actions={(
          <div className="adminMenuTools">
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="商品名・説明で検索" />
            <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
              <option value="">全カテゴリ</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <a className="button" href="/admin/tables">席・端末管理</a>
            <a className="button" href="/admin/orders">注文管理</a>
            <a className="button" href="/admin/audit-logs">操作ログ</a>
            <button className="primary" onClick={startNew}>新規商品追加</button>
          </div>
        )}
      />
      {loading && <Banner>メニュー管理データを読み込み中です。</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <Banner>保存した商品名、価格、表示状態、売切状態、在庫状態は顧客メニューへ反映されます。</Banner>
      <section className="adminMenuGrid">
        <aside className="panel adminCategoryList">
          <SectionTitle title="カテゴリ一覧" subtitle={`${categories.length} 件`} />
          <div className="adminSubForm">
            <input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} placeholder="カテゴリ名" />
            <input type="number" value={categoryForm.displayOrder} onChange={(event) => setCategoryForm({ ...categoryForm, displayOrder: event.target.value })} aria-label="カテゴリ表示順" />
            <label><input type="checkbox" checked={categoryForm.active} onChange={(event) => setCategoryForm({ ...categoryForm, active: event.target.checked })} /> 表示</label>
            <button className="primary" disabled={saving} onClick={() => void saveCategory()}>{categoryForm.id ? '更新' : '追加'}</button>
            {categoryForm.id && <button onClick={() => setCategoryForm(emptyCategoryForm)}>新規</button>}
          </div>
          <button className={!selectedCategoryId ? 'selected' : ''} onClick={() => setSelectedCategoryId('')}>全カテゴリ</button>
          {categories.map((category) => (
            <div className="adminCategoryItem" key={category.id}>
              <button className={category.id === selectedCategoryId ? 'selected' : ''} onClick={() => setSelectedCategoryId(category.id)}>
                <span>{category.name}</span>
                <small>{category.itemCount} 商品 / 順 {category.displayOrder}</small>
              </button>
              <div className="rowActions compact">
                <button onClick={() => setCategoryForm({ id: category.id, name: category.name, displayOrder: String(category.displayOrder), active: category.active })}>編集</button>
                <button onClick={() => {
                  if (category.active && category.itemCount > 0 && !window.confirm(`${category.name} を非表示にすると、このカテゴリの商品は顧客画面から非表示になります。`)) return;
                  void updateCategory(() => cafeApi.adminToggleMenuCategoryActive(category.id, !category.active), category.active ? 'カテゴリを非表示にしました。' : 'カテゴリを表示しました。');
                }}>{category.active ? '非表示' : '表示'}</button>
                <button onClick={() => void updateCategory(() => cafeApi.adminMoveMenuCategory(category.id, 'up'), 'カテゴリ順を上げました。')}>上へ</button>
                <button onClick={() => void updateCategory(() => cafeApi.adminMoveMenuCategory(category.id, 'down'), 'カテゴリ順を下げました。')}>下へ</button>
              </div>
            </div>
          ))}
        </aside>
        <section className="panel adminItemList">
          <SectionTitle title="商品一覧" subtitle={`${filteredCategoryName} / ${items.length} 件`} />
          {items.length === 0 && !loading && <EmptyState>条件に一致する商品はありません。</EmptyState>}
          <div className="adminMenuTable" role="table">
            <div className="adminMenuRow header" role="row">
              <span>画像</span><span>商品名</span><span>カテゴリ</span><span>価格</span><span>原価</span><span>粗利</span><span>状態</span><span>売切</span><span>在庫</span><span>更新日時</span><span>操作</span>
            </div>
            {items.map((item) => (
              <div className="adminMenuRow" key={item.id} role="row">
                <MenuImagePreview src={item.imageUrl || ''} alt={item.name} compact />
                <strong>{item.name}</strong>
                <span>{item.categoryName}</span>
                <span>{yen(item.price)}</span>
                <span>{yen(item.costPrice)}</span>
                <span className={item.costPrice > item.price ? 'lossText' : ''}>{yen(item.grossProfit)} / {percent(item.grossMarginRate)}</span>
                <span><Badge tone={item.active ? 'success' : 'warning'}>{item.active ? '表示' : '非表示'}</Badge></span>
                <span><Badge tone={item.soldOut ? 'danger' : 'neutral'}>{item.soldOut ? '売切' : '販売可'}</Badge></span>
                <span>
                  {item.trackStock ? `${item.stockQuantity} / 閾 ${item.lowStockThreshold}` : '対象外'}
                  {item.trackStock && item.stockQuantity <= item.lowStockThreshold && item.stockQuantity > 0 && <Badge tone="warning">低在庫</Badge>}
                  {item.trackStock && item.stockQuantity === 0 && <Badge tone="danger">0</Badge>}
                </span>
                <span>{formatDate(item.updatedAt)}</span>
                <div className="rowActions">
                  <button onClick={() => startEditItem(item)}>編集</button>
                  <button onClick={() => void updateItem(() => cafeApi.adminToggleMenuItemActive(item.id, !item.active), item.active ? '商品を非表示にしました。' : '商品を表示しました。')}>{item.active ? '非表示' : '表示'}</button>
                  <button onClick={() => void updateItem(() => cafeApi.adminToggleMenuItemSoldOut(item.id, !item.soldOut), item.soldOut ? '売切を解除しました。' : '売切にしました。')}>{item.soldOut ? '解除' : '売切'}</button>
                  <button onClick={() => void updateItem(() => cafeApi.adminMoveMenuItem(item.id, 'up'), '表示順を上げました。')}>上へ</button>
                  <button onClick={() => void updateItem(() => cafeApi.adminMoveMenuItem(item.id, 'down'), '表示順を下げました。')}>下へ</button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="panel adminEditor">
          <SectionTitle title={form.id ? '商品編集' : '新規商品'} subtitle={form.id || '未保存'} />
          <label className="fieldLabel">商品名<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="fieldLabel">説明<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label className="fieldLabel">カテゴリ<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="fieldLabel">
            商品画像 URL
            <div className="imageUrlInput">
              <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://example.com/menu.jpg または /images/menu.jpg" />
              <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })}>クリア</button>
            </div>
          </label>
          <MenuImagePreview src={form.imageUrl} alt={form.name || '商品画像'} />
          <div className="editorTwoCol">
            <label className="fieldLabel">価格<input type="number" min="0" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
            <label className="fieldLabel">税率<input type="number" min="0" step="1" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} /></label>
          </div>
          <section className="profitEditor">
            <div className="editorTwoCol">
              <label className="fieldLabel">標準原価<input type="number" min="0" step="1" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} /></label>
              <div className="profitPreview">
                <span>粗利</span>
                <strong className={formIsLoss ? 'lossText' : ''}>{yen(formGrossProfit)}</strong>
                <small>粗利率 {percent(formGrossMarginRate)}</small>
              </div>
            </div>
            {formIsLoss && <Banner tone="danger">標準原価が販売価格を上回っています。赤字商品として扱われます。</Banner>}
          </section>
          <label className="fieldLabel">表示順<input type="number" step="1" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.target.value })} /></label>
          <label className="fieldLabel">アレルギーメモ<input value={form.allergyNote} onChange={(event) => setForm({ ...form, allergyNote: event.target.value })} /></label>
          <div className="checkLine">
            <label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> 表示する</label>
            <label><input type="checkbox" checked={form.soldOut} onChange={(event) => setForm({ ...form, soldOut: event.target.checked })} /> 売切</label>
          </div>
          <section className="stockEditor">
            <div className="optionEditorHeader">
              <strong>在庫</strong>
              {form.trackStock && Number(form.stockQuantity) === 0 && <Badge tone="danger">在庫 0</Badge>}
              {form.trackStock && Number(form.stockQuantity) > 0 && Number(form.stockQuantity) <= Number(form.lowStockThreshold) && <Badge tone="warning">低在庫</Badge>}
            </div>
            <label><input type="checkbox" checked={form.trackStock} onChange={(event) => setForm({ ...form, trackStock: event.target.checked })} /> 在庫管理対象</label>
            <div className="editorTwoCol">
              <label className="fieldLabel">現在在庫数<input type="number" min="0" step="1" disabled={!form.trackStock} value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })} /></label>
              <label className="fieldLabel">低在庫閾値<input type="number" min="0" step="1" disabled={!form.trackStock} value={form.lowStockThreshold} onChange={(event) => setForm({ ...form, lowStockThreshold: event.target.value })} /></label>
            </div>
            {form.trackStock && Number(form.stockQuantity) === 0 && <Banner tone="warning">在庫 0 の商品は注文成功時に自動で売切になります。売切解除は管理者操作で行います。</Banner>}
            {form.id && <button disabled={saving} onClick={() => void saveStock()}>在庫のみ更新</button>}
            {form.id && (
              <>
                <div className="adminSubForm inventoryAdjustForm">
                  <input type="number" step="1" disabled={!form.trackStock} value={adjustDelta} onChange={(event) => setAdjustDelta(event.target.value)} placeholder="調整数" aria-label="在庫調整数" />
                  <input disabled={!form.trackStock} value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} placeholder="理由" aria-label="在庫調整理由" />
                  <button disabled={saving || !form.trackStock} onClick={() => void adjustStock()}>差分調整</button>
                </div>
                <div className="inventoryHistory">
                  <div className="optionEditorHeader">
                    <strong>在庫履歴</strong>
                    <select value={movementType} onChange={(event) => void changeMovementType(event.target.value)} aria-label="在庫履歴種別">
                      <option value="">すべて</option>
                      <option value="manual_set">直接設定</option>
                      <option value="manual_adjust">差分調整</option>
                      <option value="order_reserved">注文引当</option>
                      <option value="order_cancel_restored">取消戻し</option>
                    </select>
                  </div>
                  {movementLoading && <p className="mutedText">読み込み中</p>}
                  {!movementLoading && inventoryMovements.length === 0 && <p className="mutedText">履歴はありません。</p>}
                  {!movementLoading && inventoryMovements.map((movement) => (
                    <div className="inventoryMovementLine" key={movement.id}>
                      <div>
                        <strong className={movement.quantityDelta > 0 ? 'stockPlus' : 'stockMinus'}>{signedQuantity(movement.quantityDelta)}</strong>
                        <span>{movement.quantityBefore} → {movement.quantityAfter}</span>
                      </div>
                      <div>
                        <Badge tone={movement.quantityDelta > 0 ? 'success' : 'warning'}>{movementLabel(movement.movementType)}</Badge>
                        <small>{formatDate(movement.occurredAt)}</small>
                      </div>
                      <small>{movement.reason || '-'}{movement.orderNo ? ` / ${movement.orderNo}` : ''}{movement.actorUserDisplayName ? ` / ${movement.actorUserDisplayName}` : ''}</small>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
          <button className="primary largeButton" disabled={saving} onClick={() => void save()}>{saving ? '保存中' : '保存'}</button>
          {form.id && (
            <section className="optionEditor">
              <SectionTitle title="商品オプション" subtitle={`${options.length} 件`} />
              <div className="adminSubForm">
                <input value={optionForm.name} onChange={(event) => setOptionForm({ ...optionForm, name: event.target.value })} placeholder="オプショングループ名" />
                <label><input type="checkbox" checked={optionForm.required} onChange={(event) => setOptionForm({ ...optionForm, required: event.target.checked, minSelect: event.target.checked ? '1' : optionForm.minSelect })} /> 必須</label>
                <label><input type="checkbox" checked={optionForm.multiSelect} onChange={(event) => setOptionForm({ ...optionForm, multiSelect: event.target.checked, maxSelect: event.target.checked ? optionForm.maxSelect : '1' })} /> 複数</label>
                <input type="number" min="0" value={optionForm.minSelect} onChange={(event) => setOptionForm({ ...optionForm, minSelect: event.target.value })} aria-label="最小選択数" />
                <input type="number" min="0" value={optionForm.maxSelect} onChange={(event) => setOptionForm({ ...optionForm, maxSelect: event.target.value })} placeholder="最大" aria-label="最大選択数" />
                <input type="number" value={optionForm.displayOrder} onChange={(event) => setOptionForm({ ...optionForm, displayOrder: event.target.value })} aria-label="オプション表示順" />
                <label><input type="checkbox" checked={optionForm.active} onChange={(event) => setOptionForm({ ...optionForm, active: event.target.checked })} /> 表示</label>
                <button className="primary" disabled={saving} onClick={() => void saveOption()}>{optionForm.id ? '更新' : '追加'}</button>
                {optionForm.id && <button onClick={() => setOptionForm(emptyOptionForm)}>新規</button>}
              </div>
              <div className="optionList">
                {options.map((option) => (
                  <div className="optionEditorGroup" key={option.id}>
                    <div className="optionEditorHeader">
                      <strong>{option.name}</strong>
                      <span>{option.required ? '必須' : '任意'} / {option.multiSelect ? '複数' : '単一'} / {option.minSelect}-{option.maxSelect ?? '無制限'}</span>
                      <Badge tone={option.active ? 'success' : 'warning'}>{option.active ? '表示' : '非表示'}</Badge>
                    </div>
                    <div className="rowActions">
                      <button onClick={() => setOptionForm(optionToForm(option))}>編集</button>
                      <button onClick={() => void updateOption(() => cafeApi.adminToggleMenuItemOptionActive(option.id, !option.active), option.active ? 'オプションを非表示にしました。' : 'オプションを表示しました。')}>{option.active ? '非表示' : '表示'}</button>
                      <button onClick={() => void updateOption(() => cafeApi.adminMoveMenuItemOption(option.id, 'up'), 'オプション順を上げました。')}>上へ</button>
                      <button onClick={() => void updateOption(() => cafeApi.adminMoveMenuItemOption(option.id, 'down'), 'オプション順を下げました。')}>下へ</button>
                    </div>
                    <div className="choiceList">
                      {option.choices.map((choice) => (
                        <div className="choiceLine" key={choice.id}>
                          <span>{choice.name} {choice.priceDelta ? `+${yen(choice.priceDelta)}` : '+0円'}</span>
                          <Badge tone={choice.active ? 'success' : 'warning'}>{choice.active ? '表示' : '非表示'}</Badge>
                          <button onClick={() => {
                            const name = window.prompt('選択肢名', choice.name);
                            if (!name) return;
                            const price = window.prompt('追加料金', String(choice.priceDelta));
                            if (price === null) return;
                            void updateOption(() => cafeApi.adminUpdateMenuOptionChoice({ choice_id: choice.id, option_id: option.id, name, price_delta: Number(price), active: choice.active, display_order: choice.displayOrder }), '選択肢を更新しました。');
                          }}>編集</button>
                          <button onClick={() => void updateOption(() => cafeApi.adminToggleMenuOptionChoiceActive(choice.id, !choice.active), choice.active ? '選択肢を非表示にしました。' : '選択肢を表示しました。')}>{choice.active ? '非表示' : '表示'}</button>
                          <button onClick={() => void updateOption(() => cafeApi.adminMoveMenuOptionChoice(choice.id, 'up'), '選択肢順を上げました。')}>上へ</button>
                          <button onClick={() => void updateOption(() => cafeApi.adminMoveMenuOptionChoice(choice.id, 'down'), '選択肢順を下げました。')}>下へ</button>
                        </div>
                      ))}
                    </div>
                    <div className="adminSubForm">
                      <input value={choiceDrafts[option.id]?.name || ''} onChange={(event) => setChoiceDrafts((current) => ({ ...current, [option.id]: { ...(current[option.id] || { priceDelta: '0', displayOrder: '10' }), name: event.target.value } }))} placeholder="選択肢名" />
                      <input type="number" min="0" value={choiceDrafts[option.id]?.priceDelta || '0'} onChange={(event) => setChoiceDrafts((current) => ({ ...current, [option.id]: { ...(current[option.id] || { name: '', displayOrder: '10' }), priceDelta: event.target.value } }))} aria-label="追加料金" />
                      <input type="number" value={choiceDrafts[option.id]?.displayOrder || '10'} onChange={(event) => setChoiceDrafts((current) => ({ ...current, [option.id]: { ...(current[option.id] || { name: '', priceDelta: '0' }), displayOrder: event.target.value } }))} aria-label="選択肢表示順" />
                      <button onClick={() => void addChoice(option)}>選択肢追加</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
