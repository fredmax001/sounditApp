import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Loader2, Martini, Pencil, Plus, Trash2, Upload, X, Check, Tag,
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

const CATEGORIES = [
  'cocktail_signature', 'cocktail_classic', 'mocktail', 'coffee', 'tea', 'juice',
  'beer_craft', 'beer_bottle', 'whiskey', 'bourbon', 'japanese_whiskey', 'brandy',
  'tequila', 'vodka', 'gin', 'rum', 'soft', 'mixer', 'non_alcoholic', 'food', 'other',
];

const token = () => localStorage.getItem('auth-token') || localStorage.getItem('token');
const fmt = (n: number | null | undefined) => (n == null ? '—' : `¥${Number(n).toLocaleString()}`);

const DrinkMenuManager = ({ eventId }: { eventId: number | null }) => {
  const { t } = useTranslation();
  const [master, setMaster] = useState<DrinkItem[]>([]);
  const [eventItems, setEventItems] = useState<DrinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DrinkItem | null>(null);
  const [saving, setSaving] = useState(false);

  // import review state
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    name: '', category: 'cocktail_signature', description: '', price: '',
    event_price: '', supports_mixers: false, allowed_mixers: '', mixer_included_qty: '0', mixer_extra_price: '0',
  });

  const fetchDrinks = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDrinks(); }, [eventId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', category: 'cocktail_signature', description: '', price: '', event_price: '', supports_mixers: false, allowed_mixers: '', mixer_included_qty: '0', mixer_extra_price: '0' });
    setShowForm(true);
  };

  const openEdit = (item: DrinkItem) => {
    setEditing(item);
    setForm({
      name: item.name, category: item.category, description: item.description || '',
      price: String(item.price), event_price: item.event_price != null ? String(item.event_price) : '',
      supports_mixers: item.supports_mixers,
      allowed_mixers: (item.allowed_mixers || []).join(', '),
      mixer_included_qty: String(item.mixer_included_qty || 0),
      mixer_extra_price: String(item.mixer_extra_price || 0),
    });
    setShowForm(true);
  };

  const submitForm = async () => {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        category: form.category,
        description: form.description || null,
        price: parseFloat(form.price) || 0,
        event_id: eventId,
        event_price: form.event_price ? parseFloat(form.event_price) : null,
        supports_mixers: form.supports_mixers,
        allowed_mixers: form.allowed_mixers.split(',').map(s => s.trim()).filter(Boolean),
        mixer_included_qty: parseInt(form.mixer_included_qty) || 0,
        mixer_extra_price: parseFloat(form.mixer_extra_price) || 0,
      };
      const res = editing
        ? await fetch(`${API_BASE_URL}/tables/business/drinks/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) })
        : await fetch(`${API_BASE_URL}/tables/business/drinks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('save failed');
      setShowForm(false);
      fetchDrinks();
    } catch {
      toast.error(t('kit.editProfile.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (id: number) => {
    await fetch(`${API_BASE_URL}/tables/business/drinks/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    fetchDrinks();
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
        body: JSON.stringify(selected.filter(i => i.price != null).map(i => ({
          name: i.name, category: i.category || 'other', description: i.description || null,
          price: i.price || 0, event_id: eventId,
        }))),
      });
      if (!res.ok) throw new Error('confirm failed');
      setParsedItems(null);
      fetchDrinks();
      toast.success(t('tables.importDone', 'Menu imported'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-[#0A0A0A] border border-white/10 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#d3da0c]';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-gray-400 text-xs">
          {eventId
            ? t('tables.eventMenuHint', 'Event menu: items and prices for this event. Master items are inherited unless overridden.')
            : t('tables.masterMenuHint', 'Master menu: your reusable drink list. Open an event to set event-specific prices.')}
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
                  className="bg-[#0A0A0A] border border-white/10 text-gray-400 rounded-lg px-1.5 py-1 text-[10px]">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" defaultValue={item.price ?? ''} placeholder="¥" onChange={e => { const next = [...parsedItems]; next[idx] = { ...next[idx], price: e.target.value ? parseFloat(e.target.value) : null }; setParsedItems(next); }}
                  className="w-16 bg-[#0A0A0A] border border-white/10 text-white rounded-lg px-1.5 py-1 text-[11px]" />
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

      {/* Create/edit form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('tables.drinkName', 'Drink name')} className={inputCls} />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls}>
              {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#111111]">{c.replace(/_/g, ' ')}</option>)}
            </select>
            <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder={t('tables.masterPrice', 'Master price ¥')} type="number" inputMode="decimal" className={inputCls} />
            {eventId && (
              <input value={form.event_price} onChange={e => setForm({ ...form, event_price: e.target.value })} placeholder={t('tables.eventPrice', 'Event price ¥ (override)')} type="number" inputMode="decimal" className={inputCls} />
            )}
          </div>
          <input value={form.allowed_mixers} onChange={e => setForm({ ...form, allowed_mixers: e.target.value })} placeholder={t('tables.allowedMixers', 'Allowed mixers (comma separated)')} className={inputCls} />
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.supports_mixers} onChange={e => setForm({ ...form, supports_mixers: e.target.checked })} className="accent-[#d3da0c]" />
              {t('tables.supportsMixers', 'Supports mixers')}
            </label>
            <input value={form.mixer_included_qty} onChange={e => setForm({ ...form, mixer_included_qty: e.target.value })} type="number" placeholder={t('tables.mixersIncludedCount', 'Included qty')} className="w-20 bg-[#0A0A0A] border border-white/10 text-white rounded-lg px-2 py-1" />
            <input value={form.mixer_extra_price} onChange={e => setForm({ ...form, mixer_extra_price: e.target.value })} type="number" placeholder={t('tables.mixerExtraPrice', 'Extra ¥')} className="w-20 bg-[#0A0A0A] border border-white/10 text-white rounded-lg px-2 py-1" />
          </div>
          <div className="flex gap-2">
            <button onClick={submitForm} disabled={saving || !form.name.trim() || !form.price} className="flex-1 h-10 rounded-xl bg-[#d3da0c] text-black text-xs font-bold hover:bg-[#bbc10b] transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? t('kit.common.save') : t('tables.addDrink', 'Add drink')}
            </button>
            <button onClick={() => setShowForm(false)} className="flex-1 h-10 rounded-xl bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition-colors">{t('kit.common.cancel')}</button>
          </div>
        </motion.div>
      )}

      {/* Lists */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-[#111111] rounded-xl animate-pulse" />)}</div>
      ) : (
        <>
          {eventId && eventItems.length > 0 && (
            <DrinkTable title={t('tables.eventItems', 'Event-specific items')} items={eventItems} onEdit={openEdit} onDelete={removeItem} showEffective />
          )}
          <DrinkTable
            title={eventId ? t('tables.inheritedMaster', 'Master menu (inherited)') : t('tables.masterMenu', 'Master menu')}
            items={master}
            onEdit={openEdit}
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

const DrinkTable = ({ title, items, onEdit, onDelete, showEffective }: {
  title: string; items: DrinkItem[]; onEdit: (i: DrinkItem) => void; onDelete: (id: number) => void; showEffective?: boolean;
}) => (
  <div>
    <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide mb-2">{title} ({items.length})</p>
    <div className="space-y-1.5">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-3 bg-[#111111] border border-white/5 rounded-xl px-3 py-2.5">
          <Martini className="w-4 h-4 text-[#d3da0c] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm truncate">{item.name}</p>
            <p className="text-gray-500 text-[11px] flex items-center gap-1">
              <Tag className="w-3 h-3" />{item.category.replace(/_/g, ' ')}
              {item.supports_mixers && (item.allowed_mixers?.length || 0) > 0 && <span> · {item.allowed_mixers.join('/')}</span>}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[#d3da0c] text-sm font-semibold">{fmt(showEffective ? item.effective_price : item.price)}</p>
            {showEffective && item.event_price != null && <p className="text-gray-600 text-[10px]">{fmt(item.price)} master</p>}
          </div>
          <button onClick={() => onEdit(item)} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5" aria-label="edit"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(item.id)} className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10" aria-label="delete"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  </div>
);

export default DrinkMenuManager;
