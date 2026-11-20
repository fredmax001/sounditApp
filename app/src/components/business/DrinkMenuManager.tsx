import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Loader2, Martini, Pencil, Plus, Trash2, Upload, X, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

interface DrinkItem {
  id: number;
  event_id: number | null;
  master_item_id: number | null;
  name: string;
  category: string;
  description?: string | null;
  price: number;
  event_price: number | null;
  effective_price: number;
  supports_mixers: boolean;
  allowed_mixers: string[];
  mixer_included_qty: number;
  mixer_extra_price: number;
  is_active: boolean;
  is_master?: boolean;
}

interface ParsedItem {
  name: string;
  price: number | null;
  category?: string;
  description?: string | null;
  confidence?: number;
}

interface DrinkFormState {
  name: string;
  category: string;
  description: string;
  price: string;
  event_price: string;
  supports_mixers: boolean;
  allowed_mixers: string;
  mixer_included_qty: string;
  mixer_extra_price: string;
}

const CATEGORIES = [
  'cocktail_signature', 'cocktail_classic', 'mocktail',
  'shot', 'beer_bottle', 'beer_draft', 'beer_craft',
  'champagne', 'wine', 'whiskey', 'bourbon', 'japanese_whiskey',
  'brandy', 'tequila', 'vodka', 'gin', 'rum', 'liqueur',
  'coffee', 'tea', 'juice', 'soft', 'mixer', 'non_alcoholic', 'food', 'other',
];

const LIQUOR_CATEGORIES = new Set([
  'whiskey', 'bourbon', 'japanese_whiskey',
  'brandy', 'tequila', 'vodka', 'gin', 'rum', 'liqueur',
]);

const DEFAULT_MIXERS = 'Red Bull, Tonic Water, Cola, Soda Water, Juice';

const CATEGORY_LABELS: Record<string, string> = {
  cocktail_signature: 'Signature Cocktails 特色鸡尾酒',
  cocktail_classic: 'Cocktails 鸡尾酒',
  mocktail: 'Mocktails 无酒精鸡尾酒',
  shot: 'Shots 一口酒',
  beer_bottle: 'Beers 啤酒',
  beer_draft: 'Draft Beers 生啤',
  beer_craft: 'Craft Beers 精酿啤酒',
  champagne: 'Champagne 香槟',
  wine: 'Wine 葡萄酒',
  whiskey: 'Whisky 威士忌',
  bourbon: 'Bourbon 波本',
  japanese_whiskey: 'Japanese Whisky 日威',
  brandy: 'Cognac & Brandy 白兰地',
  tequila: 'Tequila 龙舌兰',
  vodka: 'Vodka 伏特加',
  gin: 'Gin 金酒',
  rum: 'Rum 朗姆',
  liqueur: 'Liqueurs 力娇酒',
  coffee: 'Coffee 咖啡',
  tea: 'Tea 茶',
  juice: 'Juice 果汁',
  soft: 'Soft Drinks 饮料',
  mixer: 'Mixers',
  non_alcoholic: 'Non-Alcoholic',
  food: 'Food',
  other: 'Other',
};

const token = () => localStorage.getItem('auth-token') || localStorage.getItem('token');
const fmt = (n: number | null | undefined) => (n == null ? '—' : `¥${Number(n).toLocaleString()}`);

const DrinkMenuManager = ({ eventId }: { eventId: number | null }) => {
  const { t } = useTranslation();
  const [master, setMaster] = useState<DrinkItem[]>([]);
  const [eventItems, setEventItems] = useState<DrinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // import review state
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);
  const [importing, setImporting] = useState(false);

  const [createForm, setCreateForm] = useState<DrinkFormState>({
    name: '', category: 'whiskey', description: '', price: '',
    event_price: '', supports_mixers: true, allowed_mixers: DEFAULT_MIXERS, mixer_included_qty: '4', mixer_extra_price: '10',
  });

  const [editForm, setEditForm] = useState<DrinkFormState>({
    name: '', category: 'cocktail_signature', description: '', price: '',
    event_price: '', supports_mixers: false, allowed_mixers: '', mixer_included_qty: '4', mixer_extra_price: '10',
  });

  const fetchDrinks = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tables/business/drinks${eventId ? `?event_id=${eventId}` : ''}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMaster(data.master || []);
        setEventItems(data.event_items || []);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => { fetchDrinks(); }, [eventId]);

  const openCreate = () => {
    setEditingId(null);
    setCreateForm({
      name: '', category: 'whiskey', description: '', price: '', event_price: '',
      supports_mixers: true, allowed_mixers: DEFAULT_MIXERS, mixer_included_qty: '4', mixer_extra_price: '10',
    });
    setShowCreateForm(true);
  };

  const openEdit = (item: DrinkItem) => {
    setShowCreateForm(false);
    setEditingId(item.id);
    const isLiquor = LIQUOR_CATEGORIES.has(item.category);
    setEditForm({
      name: item.name,
      category: item.category,
      description: item.description || '',
      price: String(item.price),
      event_price: item.event_price != null ? String(item.event_price) : '',
      supports_mixers: item.supports_mixers ?? isLiquor,
      allowed_mixers: (item.allowed_mixers && item.allowed_mixers.length > 0)
        ? item.allowed_mixers.join(', ')
        : (isLiquor ? DEFAULT_MIXERS : ''),
      mixer_included_qty: String(item.mixer_included_qty || (item.supports_mixers || isLiquor ? 4 : 0)),
      mixer_extra_price: String(item.mixer_extra_price || (item.supports_mixers || isLiquor ? 10 : 0)),
    });
  };

  const submitCreate = async () => {
    if (!createForm.name.trim() || !createForm.price) return;
    setSaving(true);
    try {
      const body = {
        name: createForm.name.trim(),
        category: createForm.category,
        description: createForm.description || null,
        price: parseFloat(createForm.price) || 0,
        event_id: eventId,
        event_price: createForm.event_price ? parseFloat(createForm.event_price) : null,
        supports_mixers: createForm.supports_mixers,
        allowed_mixers: createForm.allowed_mixers.split(',').map(s => s.trim()).filter(Boolean),
        mixer_included_qty: parseInt(createForm.mixer_included_qty) || 0,
        mixer_extra_price: parseFloat(createForm.mixer_extra_price) || 0,
      };
      const res = await fetch(`${API_BASE_URL}/tables/business/drinks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      setShowCreateForm(false);
      await fetchDrinks(true);
      toast.success(t('kit.common.saved', 'Saved'));
    } catch {
      toast.error(t('kit.editProfile.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const submitInlineEdit = async (itemId: number) => {
    if (!editForm.name.trim() || !editForm.price) return;
    setSaving(true);
    try {
      const body = {
        name: editForm.name.trim(),
        category: editForm.category,
        description: editForm.description || null,
        price: parseFloat(editForm.price) || 0,
        event_price: editForm.event_price ? parseFloat(editForm.event_price) : null,
        supports_mixers: editForm.supports_mixers,
        allowed_mixers: editForm.allowed_mixers.split(',').map(s => s.trim()).filter(Boolean),
        mixer_included_qty: parseInt(editForm.mixer_included_qty) || 0,
        mixer_extra_price: parseFloat(editForm.mixer_extra_price) || 0,
      };
      const res = await fetch(`${API_BASE_URL}/tables/business/drinks/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      const updatedItem: DrinkItem = await res.json();
      setMaster(prev => prev.map(i => (i.id === itemId ? updatedItem : i)));
      setEventItems(prev => prev.map(i => (i.id === itemId ? updatedItem : i)));
      setEditingId(null);
      toast.success(t('kit.common.saved', 'Price & drink updated'));
    } catch {
      toast.error(t('kit.editProfile.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (id: number) => {
    await fetch(`${API_BASE_URL}/tables/business/drinks/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    setMaster(prev => prev.filter(i => i.id !== id));
    setEventItems(prev => prev.filter(i => i.id !== id));
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE_URL}/tables/business/drinks/import`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.detail || 'parse failed');
      setParsedItems((data.items || []).map((i: ParsedItem) => ({ ...i, category: i.category || 'other' })));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmImport = async (selected: ParsedItem[]) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tables/business/drinks/import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(selected.filter(i => i.price != null).map(i => {
          const cat = i.category || 'other';
          const isLiquor = LIQUOR_CATEGORIES.has(cat);
          return {
            name: i.name,
            category: cat,
            description: i.description || null,
            price: i.price || 0,
            event_id: eventId,
            supports_mixers: isLiquor,
            allowed_mixers: isLiquor ? DEFAULT_MIXERS.split(',').map(s => s.trim()) : [],
            mixer_included_qty: isLiquor ? 4 : 0,
            mixer_extra_price: isLiquor ? 10 : 0,
          };
        })),
      });
      if (!res.ok) throw new Error('confirm failed');
      setParsedItems(null);
      await fetchDrinks(true);
      toast.success(t('tables.importDone', 'Menu imported'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-[#020b00] border border-white/10 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#d3da0c]';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-gray-400 text-xs">
          {eventId
            ? t('tables.eventMenuHint', 'Event menu: items and prices for this event. Master items are inherited unless overridden.')
            : t('tables.masterMenuHint', 'Master menu: your reusable drink list. Tap the edit button next to any price to edit it directly.')}
        </p>
        <div className="flex gap-2 shrink-0">
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv" className="hidden" onChange={e => e.target.files?.[0] && handleImportFile(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-semibold hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50">
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-[#d3da0c]" />}
            {t('tables.importMenu', 'Import menu')}
          </button>
          <button onClick={openCreate} className="h-9 px-3 rounded-lg bg-[#d3da0c] text-black text-xs font-bold hover:bg-[#bbc10b] transition-colors flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />{t('tables.addDrink', 'Add drink')}
          </button>
        </div>
      </div>

      {/* Import review (spec §4.3) */}
      {parsedItems && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-[#d3da0c]/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-sm font-semibold">{t('tables.reviewImport', 'Review imported items')} ({parsedItems.length})</h3>
            <button onClick={() => setParsedItems(null)} className="p-1.5 bg-white/5 rounded-full text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto mb-3">
            {parsedItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <input type="checkbox" defaultChecked={item.price != null} id={`imp-${idx}`} className="accent-[#d3da0c] shrink-0" />
                <label htmlFor={`imp-${idx}`} className="flex-1 text-gray-300 truncate">{item.name}</label>
                <select defaultValue={item.category || 'other'} onChange={e => { const next = [...parsedItems]; next[idx] = { ...next[idx], category: e.target.value }; setParsedItems(next); }}
                  className="bg-[#020b00] border border-white/10 text-gray-400 rounded-lg px-1.5 py-1 text-[0.625rem]">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" defaultValue={item.price ?? ''} placeholder="¥" onChange={e => { const next = [...parsedItems]; next[idx] = { ...next[idx], price: e.target.value ? parseFloat(e.target.value) : null }; setParsedItems(next); }}
                  className="w-16 bg-[#020b00] border border-white/10 text-white rounded-lg px-1.5 py-1 text-[0.6875rem]" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => confirmImport(parsedItems.filter((_, i) => (document.getElementById(`imp-${i}`) as HTMLInputElement)?.checked))} disabled={saving}
              className="flex-1 h-10 rounded-xl bg-[#d3da0c] text-black text-xs font-bold hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Check className="w-3.5 h-3.5" />{t('tables.confirmImport', 'Import selected')}
            </button>
            <button onClick={() => setParsedItems(null)} className="flex-1 h-10 rounded-xl bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition-colors">
              {t('kit.common.cancel')}
            </button>
          </div>
        </motion.div>
      )}

      {/* Create form (only when adding a new drink) */}
      {showCreateForm && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder={t('tables.drinkName', 'Drink name')} className={inputCls} />
            <select
              value={createForm.category}
              onChange={e => {
                const nextCat = e.target.value;
                const isLiquor = LIQUOR_CATEGORIES.has(nextCat);
                setCreateForm({
                  ...createForm,
                  category: nextCat,
                  supports_mixers: isLiquor,
                  allowed_mixers: isLiquor && !createForm.allowed_mixers ? DEFAULT_MIXERS : createForm.allowed_mixers,
                  mixer_included_qty: isLiquor ? '4' : '0',
                });
              }}
              className={inputCls}
            >
              {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#111111]">{CATEGORY_LABELS[c] || c.replace(/_/g, ' ')}</option>)}
            </select>
            <input value={createForm.price} onChange={e => setCreateForm({ ...createForm, price: e.target.value })} placeholder={t('tables.masterPrice', 'Price ¥')} type="number" inputMode="decimal" className={inputCls} />
            {eventId && (
              <input value={createForm.event_price} onChange={e => setCreateForm({ ...createForm, event_price: e.target.value })} placeholder={t('tables.eventPrice', 'Event price ¥ (override)')} type="number" inputMode="decimal" className={inputCls} />
            )}
          </div>
          <input value={createForm.allowed_mixers} onChange={e => setCreateForm({ ...createForm, allowed_mixers: e.target.value })} placeholder={t('tables.allowedMixers', 'Allowed mixers (comma separated)')} className={inputCls} />
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={createForm.supports_mixers}
                onChange={e => setCreateForm({
                  ...createForm,
                  supports_mixers: e.target.checked,
                  mixer_included_qty: e.target.checked && createForm.mixer_included_qty === '0' ? '4' : createForm.mixer_included_qty,
                  allowed_mixers: e.target.checked && !createForm.allowed_mixers ? DEFAULT_MIXERS : createForm.allowed_mixers,
                })}
                className="accent-[#d3da0c]"
              />
              {t('tables.supportsMixers', 'Supports mixers')}
            </label>
            <label className="flex items-center gap-1.5">
              <span>{t('tables.mixersIncludedCount', 'Included mixers')}:</span>
              <input value={createForm.mixer_included_qty} onChange={e => setCreateForm({ ...createForm, mixer_included_qty: e.target.value })} type="number" className="w-16 bg-[#020b00] border border-white/10 text-white rounded-lg px-2 py-1" />
            </label>
            <label className="flex items-center gap-1.5">
              <span>{t('tables.mixerExtraPrice', 'Extra ¥')}:</span>
              <input value={createForm.mixer_extra_price} onChange={e => setCreateForm({ ...createForm, mixer_extra_price: e.target.value })} type="number" className="w-16 bg-[#020b00] border border-white/10 text-white rounded-lg px-2 py-1" />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={submitCreate} disabled={saving || !createForm.name.trim() || !createForm.price} className="flex-1 h-10 rounded-xl bg-[#d3da0c] text-black text-xs font-bold hover:bg-[#bbc10b] transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('tables.addDrink', 'Add drink')}
            </button>
            <button onClick={() => setShowCreateForm(false)} className="flex-1 h-10 rounded-xl bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition-colors">{t('kit.common.cancel')}</button>
          </div>
        </motion.div>
      )}

      {/* Lists */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-[#111111] rounded-xl animate-pulse" />)}</div>
      ) : (
        <>
          {eventId && eventItems.length > 0 && (
            <DrinkTable
              title={t('tables.eventItems', 'Event-specific items')}
              items={eventItems}
              editingId={editingId}
              editForm={editForm}
              setEditForm={setEditForm}
              saving={saving}
              eventId={eventId}
              onEdit={openEdit}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={submitInlineEdit}
              onDelete={removeItem}
              showEffective
            />
          )}
          <DrinkTable
            title={eventId ? t('tables.inheritedMaster', 'Master menu (inherited)') : t('tables.masterMenu', 'Master menu')}
            items={master}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            saving={saving}
            eventId={eventId}
            onEdit={openEdit}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={submitInlineEdit}
            onDelete={removeItem}
            showEffective={!eventId}
          />
          {master.length === 0 && eventItems.length === 0 && (
            <p className="text-center text-gray-600 text-sm py-8">{t('tables.noDrinks', 'No drinks yet — add your first item or import a menu.')}</p>
          )}
        </>
      )}
    </div>
  );
};

const DrinkTable = ({
  title,
  items,
  editingId,
  editForm,
  setEditForm,
  saving,
  eventId,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  showEffective,
}: {
  title: string;
  items: DrinkItem[];
  editingId: number | null;
  editForm: DrinkFormState;
  setEditForm: (f: DrinkFormState) => void;
  saving: boolean;
  eventId: number | null;
  onEdit: (i: DrinkItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: number) => void;
  onDelete: (id: number) => void;
  showEffective?: boolean;
}) => {
  const { t } = useTranslation();

  // Group items by category
  const grouped = items.reduce<Record<string, DrinkItem[]>>((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  const catOrder = CATEGORIES.filter(c => grouped[c]);
  Object.keys(grouped).forEach(c => { if (!catOrder.includes(c)) catOrder.push(c); });

  const inputCls = 'w-full bg-[#020b00] border border-white/10 text-white px-2.5 py-2 rounded-lg text-xs focus:outline-none focus:border-[#d3da0c]';

  return (
    <div>
      <p className="text-gray-500 text-[0.6875rem] font-semibold uppercase tracking-wide mb-2">{title} ({items.length})</p>
      <div className="space-y-4">
        {catOrder.map(cat => (
          <div key={cat}>
            <p className="text-[#d3da0c]/70 text-[0.625rem] font-bold uppercase tracking-wider mb-1.5 px-1">
              {CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ')}
            </p>
            <div className="space-y-1.5">
              {grouped[cat].map(item => {
                const isEditing = editingId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`bg-[#111111] border rounded-xl px-3 py-2.5 transition-colors ${
                      isEditing ? 'border-[#d3da0c]/60 ring-1 ring-[#d3da0c]/30' : 'border-white/5'
                    }`}
                  >
                    {/* Main row — inline price editor right next to the Edit/Save buttons */}
                    <div className="flex items-center gap-3">
                      <Martini className="w-4 h-4 text-[#d3da0c] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{item.name}</p>
                        <p className="text-gray-500 text-[0.6875rem] flex flex-wrap items-center gap-1">
                          {item.supports_mixers && (
                            <span className="text-[#d3da0c]/80 font-medium">
                              {item.mixer_included_qty || 4} mixers included
                            </span>
                          )}
                          {item.supports_mixers && (item.allowed_mixers?.length || 0) > 0 && (
                            <span>· {item.allowed_mixers.join('/')}</span>
                          )}
                        </p>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#d3da0c] text-xs font-bold">¥</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              autoFocus
                              value={editForm.price}
                              onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter') onSaveEdit(item.id);
                                if (e.key === 'Escape') onCancelEdit();
                              }}
                              className="w-24 bg-[#020b00] border border-[#d3da0c] text-[#d3da0c] font-bold text-sm pl-5 pr-2 py-1.5 rounded-lg focus:outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => onSaveEdit(item.id)}
                            disabled={saving || !editForm.name.trim() || !editForm.price}
                            className="h-8 px-2.5 rounded-lg bg-[#d3da0c] text-black text-xs font-bold hover:bg-[#bbc10b] disabled:opacity-40 flex items-center gap-1"
                            aria-label="save"
                          >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>{t('kit.common.save', 'Save')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEdit}
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                            aria-label="cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="text-right shrink-0 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                            title={t('tables.clickToEditPrice', 'Click to edit price')}
                          >
                            <p className="text-[#d3da0c] text-sm font-semibold">{fmt(showEffective ? item.effective_price : item.price)}</p>
                            {showEffective && item.event_price != null && <p className="text-gray-600 text-[0.625rem]">{fmt(item.price)} master</p>}
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="p-2 rounded-lg text-gray-400 hover:text-[#d3da0c] hover:bg-white/5 flex items-center gap-1 text-xs"
                            aria-label="edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(item.id)}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                            aria-label="delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Inline full details editor right inside the row (no scrolling to top) */}
                    {isEditing && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={editForm.name}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder={t('tables.drinkName', 'Drink name')}
                            className={inputCls}
                          />
                          <select
                            value={editForm.category}
                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                            className={inputCls}
                          >
                            {CATEGORIES.map(c => (
                              <option key={c} value={c} className="bg-[#111111]">
                                {CATEGORY_LABELS[c] || c.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                          {eventId && (
                            <input
                              value={editForm.event_price}
                              onChange={e => setEditForm({ ...editForm, event_price: e.target.value })}
                              placeholder={t('tables.eventPrice', 'Event price ¥ (override)')}
                              type="number"
                              inputMode="decimal"
                              className={inputCls}
                            />
                          )}
                        </div>
                        <input
                          value={editForm.allowed_mixers}
                          onChange={e => setEditForm({ ...editForm, allowed_mixers: e.target.value })}
                          placeholder={t('tables.allowedMixers', 'Allowed mixers (comma separated)')}
                          className={inputCls}
                        />
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.supports_mixers}
                              onChange={e => setEditForm({
                                ...editForm,
                                supports_mixers: e.target.checked,
                                mixer_included_qty: e.target.checked && editForm.mixer_included_qty === '0' ? '4' : editForm.mixer_included_qty,
                                allowed_mixers: e.target.checked && !editForm.allowed_mixers ? DEFAULT_MIXERS : editForm.allowed_mixers,
                              })}
                              className="accent-[#d3da0c]"
                            />
                            {t('tables.supportsMixers', 'Supports mixers')}
                          </label>
                          <label className="flex items-center gap-1.5">
                            <span>{t('tables.mixersIncludedCount', 'Included mixers')}:</span>
                            <input
                              value={editForm.mixer_included_qty}
                              onChange={e => setEditForm({ ...editForm, mixer_included_qty: e.target.value })}
                              type="number"
                              className="w-16 bg-[#020b00] border border-white/10 text-white rounded-lg px-2 py-1"
                            />
                          </label>
                          <label className="flex items-center gap-1.5">
                            <span>{t('tables.mixerExtraPrice', 'Extra ¥')}:</span>
                            <input
                              value={editForm.mixer_extra_price}
                              onChange={e => setEditForm({ ...editForm, mixer_extra_price: e.target.value })}
                              type="number"
                              className="w-16 bg-[#020b00] border border-white/10 text-white rounded-lg px-2 py-1"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DrinkMenuManager;
