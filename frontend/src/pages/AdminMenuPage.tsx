import { useEffect, useMemo, useState } from 'react';
import { cafeApi } from '../api/cafeApi';
import { AppHeader, Badge, Banner, EmptyState, SectionTitle } from '../components/ui';
import { yen } from '../domain/money';
import type { AdminMenuCategory, AdminMenuItem, AdminMenuItemInput } from '../domain/types';

type FormState = {
  id?: string;
  name: string;
  description: string;
  price: string;
  taxRate: string;
  categoryId: string;
  displayOrder: string;
  active: boolean;
  soldOut: boolean;
  allergyNote: string;
};

const emptyForm: FormState = {
  name: '',
  description: '',
  price: '0',
  taxRate: '10',
  categoryId: '',
  displayOrder: '10',
  active: true,
  soldOut: false,
  allergyNote: ''
};

function toForm(item: AdminMenuItem): FormState {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: String(item.price),
    taxRate: String(item.taxRate),
    categoryId: item.categoryId,
    displayOrder: String(item.displayOrder),
    active: item.active,
    soldOut: item.soldOut,
    allergyNote: item.allergyNote || ''
  };
}

function toInput(form: FormState): AdminMenuItemInput {
  return {
    category_id: form.categoryId,
    name: form.name.trim(),
    description: form.description,
    price: Number(form.price),
    tax_rate: Number(form.taxRate),
    display_order: Number(form.displayOrder),
    active: form.active,
    sold_out: form.soldOut,
    allergy_note: form.allergyNote
  };
}

function validate(form: FormState) {
  if (!form.name.trim()) return '商品名は必須です。';
  if (!form.categoryId) return 'カテゴリは必須です。';
  if (!Number.isInteger(Number(form.price)) || Number(form.price) < 0) return '価格は 0 以上の整数で入力してください。';
  if (!Number.isFinite(Number(form.taxRate)) || Number(form.taxRate) < 0) return '税率は 0 以上で入力してください。';
  if (!Number.isInteger(Number(form.displayOrder))) return '表示順は整数で入力してください。';
  return '';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const filteredCategoryName = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId)?.name || '全カテゴリ',
    [categories, selectedCategoryId]
  );

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
            <button className="primary" onClick={startNew}>新規商品追加</button>
          </div>
        )}
      />
      {loading && <Banner>メニュー管理データを読み込み中です。</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
      <Banner>保存した商品名、価格、表示状態、売切状態は顧客メニューへ反映されます。</Banner>
      <section className="adminMenuGrid">
        <aside className="panel adminCategoryList">
          <SectionTitle title="カテゴリ一覧" subtitle={`${categories.length} 件`} />
          <button className={!selectedCategoryId ? 'selected' : ''} onClick={() => setSelectedCategoryId('')}>全カテゴリ</button>
          {categories.map((category) => (
            <button className={category.id === selectedCategoryId ? 'selected' : ''} key={category.id} onClick={() => setSelectedCategoryId(category.id)}>
              <span>{category.name}</span>
              <small>{category.displayOrder}</small>
            </button>
          ))}
        </aside>
        <section className="panel adminItemList">
          <SectionTitle title="商品一覧" subtitle={`${filteredCategoryName} / ${items.length} 件`} />
          {items.length === 0 && !loading && <EmptyState>条件に一致する商品はありません。</EmptyState>}
          <div className="adminMenuTable" role="table">
            <div className="adminMenuRow header" role="row">
              <span>商品名</span><span>カテゴリ</span><span>価格</span><span>税率</span><span>状態</span><span>売切</span><span>順</span><span>更新日時</span><span>操作</span>
            </div>
            {items.map((item) => (
              <div className="adminMenuRow" key={item.id} role="row">
                <strong>{item.name}</strong>
                <span>{item.categoryName}</span>
                <span>{yen(item.price)}</span>
                <span>{item.taxRate}%</span>
                <span><Badge tone={item.active ? 'success' : 'warning'}>{item.active ? '表示' : '非表示'}</Badge></span>
                <span><Badge tone={item.soldOut ? 'danger' : 'neutral'}>{item.soldOut ? '売切' : '販売可'}</Badge></span>
                <span>{item.displayOrder}</span>
                <span>{formatDate(item.updatedAt)}</span>
                <div className="rowActions">
                  <button onClick={() => setForm(toForm(item))}>編集</button>
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
          <div className="editorTwoCol">
            <label className="fieldLabel">価格<input type="number" min="0" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
            <label className="fieldLabel">税率<input type="number" min="0" step="1" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} /></label>
          </div>
          <label className="fieldLabel">表示順<input type="number" step="1" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.target.value })} /></label>
          <label className="fieldLabel">アレルギーメモ<input value={form.allergyNote} onChange={(event) => setForm({ ...form, allergyNote: event.target.value })} /></label>
          <div className="checkLine">
            <label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> 表示する</label>
            <label><input type="checkbox" checked={form.soldOut} onChange={(event) => setForm({ ...form, soldOut: event.target.checked })} /> 売切</label>
          </div>
          <button className="primary largeButton" disabled={saving} onClick={() => void save()}>{saving ? '保存中' : '保存'}</button>
        </aside>
      </section>
    </main>
  );
}
