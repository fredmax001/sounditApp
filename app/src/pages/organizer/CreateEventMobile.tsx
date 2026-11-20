/**
 * CreateEventMobile — phone-first Create Event experience.
 *
 * Rendered by CreateEvent.tsx when the mobile layout is active. All state,
 * validation, uploads and API calls stay in CreateEvent.tsx; this component only
 * provides the mobile presentation (accordion sections, bottom-sheet selectors,
 * native pickers, ticket cards and a sticky action bar).
 */
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
  Calendar, Check, ChevronDown, Clock, CreditCard, ImageIcon, Loader2, MapPin, Music, Plus, QrCode, Share2,
  Shield, Tag, Ticket, Trash2, Upload, Users, X, Wand2,
} from 'lucide-react';
import { SheetMultiSelect, SheetSelect, type SheetOption } from '@/components/mobile-form/SheetSelect';
import BottomSheet from '@/components/mobile-form/BottomSheet';

export interface MobileTier {
  id: string;
  name: string;
  price: string;
  quantity: string;
  description: string;
  saleStartDate: string;
  saleEndDate: string;
  maxPerPerson: string;
}

export interface MobileFormData {
  title: string;
  titleCN: string;
  description: string;
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  venue: string;
  address: string;
  city: string;
  capacity: string;
  image: string;
  photoAlbumUrl?: string;
  tags: string[];
  eventType: string;
  refundPolicy: string;
  refundsAllowed: boolean;
  requireId: boolean;
  showRemainingTickets: boolean;
  ticketPrice: string;
  promoterEnabled: boolean;
  commissionRate: string;
  discountPercent: string;
  maxDiscountAmount: string;
}

export interface MobileArtist {
  id: number;
  name?: string;
  stage_name?: string;
  artist_type?: string | null;
  genre?: string | null;
}

type FileChange = (e: React.ChangeEvent<HTMLInputElement>) => void;

export interface CreateEventMobileProps {
  formData: MobileFormData;
  setFormData: Dispatch<SetStateAction<MobileFormData>>;
  ticketTiers: MobileTier[];
  setTicketTiers: Dispatch<SetStateAction<MobileTier[]>>;
  addTicketTier: () => void;
  removeTicketTier: (id: string) => void;
  handleTicketTierChange: (id: string, field: keyof MobileTier, value: string) => void;
  maxTiers: number;

  eventTypes: string[];
  refundPolicies: string[];
  cities: string[];
  genres: string[];

  artists: MobileArtist[];
  selectedDjs: number[];
  setSelectedDjs: Dispatch<SetStateAction<number[]>>;

  onFlyerSelect: FileChange;
  onFlyerExtract: FileChange;
  onFlyerRemove: () => void;
  isUploadingImage: boolean;
  isExtracting: boolean;

  galleryPreviews: string[];
  onGallerySelect: FileChange;
  onGalleryRemove: (index: number) => void;

  wechatQrPreview: string;
  alipayQrPreview: string;
  onQrSelect: (type: 'wechat' | 'alipay') => FileChange;
  onQrRemove: (type: 'wechat' | 'alipay') => void;
  paymentInstructions: string;
  setPaymentInstructions: (v: string) => void;

  onSubmit: (status: 'draft' | 'approved') => void;
  onCancel: () => void;
  isSubmitting: boolean;
  hasBusinessProfile: boolean;
  t: (key: string, fallback?: string) => string;
}

/* ───────────────────────── small building blocks ───────────────────────── */

const inputClass =
  'block h-12 w-full min-w-0 appearance-none rounded-xl border border-black/10 bg-neutral-50 px-4 text-base text-[#020b00] placeholder-gray-500 transition-colors focus:border-[#d3da0c] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white [&::-webkit-date-and-time-value]:min-h-[1.5em] [&::-webkit-date-and-time-value]:text-left';

const FieldLabel = ({ children, required, hint }: { children: ReactNode; required?: boolean; hint?: string }) => (
  <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
    <span>
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </span>
    {hint && <span className="text-xs font-normal text-gray-500">{hint}</span>}
  </span>
);

const Switch = ({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex min-h-14 w-full items-center justify-between gap-4 py-2 text-left"
  >
    <span className="min-w-0">
      <span className="block text-sm font-medium text-[#020b00] dark:text-white">{label}</span>
      {description && <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{description}</span>}
    </span>
    <span
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#d3da0c]' : 'bg-black/20 dark:bg-white/20'}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </span>
  </button>
);

interface SectionProps {
  id: string;
  icon: React.ElementType;
  title: string;
  summary?: string;
  done?: boolean;
  open: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

const Section = ({ id, icon: Icon, title, summary, done, open, onToggle, children }: SectionProps) => (
  <section className="min-w-0 overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-[#111111]">
    <button
      type="button"
      onClick={() => onToggle(id)}
      aria-expanded={open}
      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#d3da0c]/15">
        <Icon className="h-5 w-5 text-[#7a8000] dark:text-[#d3da0c]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold text-[#020b00] dark:text-white">{title}</span>
        {summary && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{summary}</span>}
      </span>
      {done && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d3da0c]">
          <Check className="h-3 w-3 text-[#020b00]" />
        </span>
      )}
      <ChevronDown className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="min-w-0 space-y-4 border-t border-black/8 px-4 pb-4 pt-4 dark:border-white/8">{children}</div>}
  </section>
);

const todayStr = () => new Date().toISOString().split('T')[0];

const toOptions = (list: string[]): SheetOption[] => list.map((v) => ({ value: v, label: v }));

/* ───────────────────────────── main component ───────────────────────────── */

const CreateEventMobile = (p: CreateEventMobileProps) => {
  const {
    formData, setFormData, ticketTiers, setTicketTiers, addTicketTier, removeTicketTier, handleTicketTierChange,
    artists, selectedDjs, setSelectedDjs, t,
  } = p;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ flyer: true, basics: true });
  const [openTier, setOpenTier] = useState<string | null>(ticketTiers[0]?.id ?? null);
  const [capacityManual, setCapacityManual] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const prevTierCount = useRef(ticketTiers.length);

  const toggleSection = (id: string) => setOpenSections((s) => ({ ...s, [id]: !s[id] }));
  const setField = <K extends keyof MobileFormData>(key: K, value: MobileFormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  /* Auto-grow description */
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 112), 360)}px`;
  }, [formData.description, openSections.basics]);

  /* Expand a newly-added ticket card */
  useEffect(() => {
    if (ticketTiers.length > prevTierCount.current) {
      setOpenTier(ticketTiers[ticketTiers.length - 1].id);
    }
    prevTierCount.current = ticketTiers.length;
  }, [ticketTiers]);

  /* ── ticket / capacity synchronisation ── */
  const totalTickets = useMemo(
    () => ticketTiers.reduce((sum, tier) => sum + (parseInt(tier.quantity, 10) > 0 ? parseInt(tier.quantity, 10) : 0), 0),
    [ticketTiers],
  );
  const lowestPrice = useMemo(() => {
    const prices = ticketTiers.map((tier) => parseFloat(tier.price)).filter((n) => !isNaN(n) && n >= 0);
    return prices.length ? Math.min(...prices) : null;
  }, [ticketTiers]);
  const capacityNum = parseInt(formData.capacity, 10) || 0;

  useEffect(() => {
    if (capacityManual) return;
    const next = totalTickets > 0 ? String(totalTickets) : '';
    if (next !== formData.capacity) setFormData((prev) => ({ ...prev, capacity: next }));
  }, [totalTickets, capacityManual, formData.capacity, setFormData]);

  useEffect(() => {
    const next = lowestPrice === null ? '' : String(lowestPrice);
    if (next !== formData.ticketPrice) setFormData((prev) => ({ ...prev, ticketPrice: next }));
  }, [lowestPrice, formData.ticketPrice, setFormData]);

  const overAllocated = capacityManual && capacityNum > 0 && totalTickets > capacityNum;
  const saleDateIssue = ticketTiers.find((tier) => tier.saleStartDate && tier.saleEndDate && tier.saleEndDate < tier.saleStartDate);
  const blockingIssue = overAllocated
    ? `Ticket quantities (${totalTickets}) exceed capacity (${capacityNum}).`
    : saleDateIssue
      ? `${saleDateIssue.name || 'A ticket'}: sales end before they start.`
      : '';

  const tierIssue = (tier: MobileTier) =>
    !tier.name.trim() || isNaN(parseFloat(tier.price)) || parseFloat(tier.price) < 0 || !(parseInt(tier.quantity, 10) > 0);

  /* ── line-up data ── */
  const hasTypes = artists.some((a) => !!a.artist_type);
  const artistName = (a: MobileArtist) => a.stage_name || a.name || `#${a.id}`;
  const isDj = (a: MobileArtist) => (a.artist_type || '').toLowerCase() === 'dj';
  const djList = hasTypes ? artists.filter(isDj) : artists;
  const performerList = hasTypes ? artists.filter((a) => !isDj(a)) : [];
  const toArtistOptions = (list: MobileArtist[]): SheetOption[] =>
    list.map((a) => ({
      value: String(a.id),
      label: artistName(a),
      sublabel: [hasTypes && !isDj(a) ? a.artist_type : null, a.genre].filter(Boolean).join(' · ') || undefined,
    }));
  const selectedIn = (list: MobileArtist[]) =>
    selectedDjs.filter((id) => list.some((a) => a.id === id)).map(String);
  const updateSelection = (list: MobileArtist[]) => (vals: string[]) =>
    setSelectedDjs((prev) => [
      ...prev.filter((id) => !list.some((a) => a.id === id)),
      ...vals.map(Number),
    ]);

  /* ── completion / summaries ── */
  const basicsDone = !!formData.title.trim();
  const whenDone = !!(formData.date && formData.time && formData.venue.trim() && formData.city);
  const ticketsDone = ticketTiers.length > 0 && ticketTiers.every((tier) => !tierIssue(tier));
  const flyerDone = !!formData.image;
  const requiredDone = [flyerDone, basicsDone, whenDone, ticketsDone].filter(Boolean).length;

  const previewDate = (() => {
    if (!formData.date || !formData.time) return '';
    const d = new Date(`${formData.date}T${formData.time}`);
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  })();

  const onFocusCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLInputElement;
    if (!['INPUT', 'TEXTAREA'].includes(el.tagName)) return;
    if (['date', 'time', 'file', 'checkbox'].includes(el.type)) return;
    window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  };

  const submitDisabled = p.isSubmitting || !p.hasBusinessProfile || !!blockingIssue;

  const copyLabel = (label: string, fallback: string) => t(label, fallback);

  const renderQrTile = (type: 'wechat' | 'alipay', label: string, preview: string) => (
    <div key={type} className="min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <div className="overflow-hidden rounded-xl border border-dashed border-black/20 dark:border-white/20">
        <label className="relative flex aspect-square w-full cursor-pointer items-center justify-center bg-black/5 dark:bg-white/5">
          {preview ? (
            <img src={preview} alt={`${label} preview`} className="h-full w-full bg-white object-contain p-1" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-gray-500">
              <QrCode className="h-8 w-8" />
              <span className="text-xs">{copyLabel('organizer.createEvent.uploadQr', 'Upload QR')}</span>
            </span>
          )}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { p.onQrSelect(type)(e); e.target.value = ''; }} />
        </label>
        {preview && (
          <div className="grid grid-cols-2 divide-x divide-black/10 border-t border-black/10 dark:divide-white/10 dark:border-white/10">
            <label className="flex min-h-11 cursor-pointer items-center justify-center text-sm font-medium text-[#020b00] dark:text-white">
              Replace
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { p.onQrSelect(type)(e); e.target.value = ''; }} />
            </label>
            <button type="button" onClick={() => p.onQrRemove(type)} className="min-h-11 text-sm font-medium text-red-500">
              Remove
            </button>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">PNG or JPG, max 2MB</p>
    </div>
  );

  return (
    <div
      className="mx-auto w-full max-w-xl overflow-x-clip px-3 pt-3 pb-6"
      onFocusCapture={onFocusCapture}
    >
      {/* Progress (the page title lives in the app header) */}
      <div className="mb-3 px-1">
        <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{requiredDone} of 4 required steps</span>
          <span>{ticketTiers.length} ticket{ticketTiers.length === 1 ? '' : 's'}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div className="h-full rounded-full bg-[#d3da0c] transition-all" style={{ width: `${(requiredDone / 4) * 100}%` }} />
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        {/* ───────── Flyer ───────── */}
        <Section
          id="flyer" icon={ImageIcon} title={t('organizer.createEvent.eventFlyer', 'Event flyer')}
          summary={flyerDone ? 'Flyer added' : 'Required'} done={flyerDone}
          open={!!openSections.flyer} onToggle={toggleSection}
        >
          {formData.image ? (
            <div className="overflow-hidden rounded-xl border border-black/10 bg-black dark:border-white/10">
              <img src={formData.image} alt="Event flyer preview" className="mx-auto max-h-[55dvh] w-full object-contain" />
            </div>
          ) : (
            <label className="flex min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/20 px-4 text-center text-gray-500 active:border-[#d3da0c] dark:border-white/20">
              {p.isUploadingImage ? <Loader2 className="h-8 w-8 animate-spin" /> : <Upload className="h-8 w-8" />}
              <span className="text-base font-medium text-[#020b00] dark:text-white">
                {p.isUploadingImage ? t('organizer.createEvent.uploading', 'Uploading…') : t('organizer.createEvent.uploadFlyerHint', 'Upload flyer')}
              </span>
              <span className="text-xs">JPEG or PNG, max 5MB</span>
              <input type="file" accept="image/*" className="sr-only" disabled={p.isUploadingImage} onChange={(e) => { p.onFlyerSelect(e); e.target.value = ''; }} />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-black/10 text-sm font-semibold text-[#020b00] active:bg-black/5 dark:border-white/10 dark:text-white dark:active:bg-white/10">
              <Upload className="h-4 w-4" />
              {formData.image ? 'Replace' : 'Choose photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { p.onFlyerSelect(e); e.target.value = ''; }} />
            </label>
            <button
              type="button"
              onClick={p.onFlyerRemove}
              disabled={!formData.image}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/10 text-sm font-semibold text-red-500 disabled:opacity-40 dark:border-white/10"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          </div>
          <label className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#020b00] text-sm font-bold text-[#d3da0c] active:opacity-80 dark:bg-[#d3da0c] dark:text-[#020b00]">
            {p.isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {p.isExtracting ? t('organizer.createEvent.extracting', 'Reading flyer…') : t('organizer.createEvent.autoFillFromFlyer', 'Autofill from flyer')}
            <input type="file" accept="image/*" className="sr-only" disabled={p.isExtracting} onChange={(e) => { p.onFlyerExtract(e); e.target.value = ''; }} />
          </label>
        </Section>

        {/* ───────── Basics ───────── */}
        <Section
          id="basics" icon={Tag} title={t('organizer.createEvent.generalInfo', 'General information')}
          summary={formData.title || 'Name, type and description'} done={basicsDone}
          open={!!openSections.basics} onToggle={toggleSection}
        >
          <label className="block">
            <FieldLabel required>{t('organizer.createEvent.eventNameEN', 'Event name')}</FieldLabel>
            <input
              className={inputClass} type="text" value={formData.title} enterKeyHint="next" autoComplete="off"
              onChange={(e) => setField('title', e.target.value)} placeholder="e.g., Neon Nights"
            />
          </label>
          <label className="block">
            <FieldLabel>{t('organizer.createEvent.eventNameZH', 'Event name (Chinese)')}</FieldLabel>
            <input
              className={inputClass} type="text" value={formData.titleCN} enterKeyHint="next" autoComplete="off"
              onChange={(e) => setField('titleCN', e.target.value)} placeholder="例如：霓虹之夜"
            />
          </label>
          <SheetSelect
            label={t('organizer.createEvent.eventType', 'Event type')} value={formData.eventType}
            options={toOptions(p.eventTypes)} onChange={(v) => setField('eventType', v)}
            placeholder={t('organizer.createEvent.selectType', 'Select type')} allowClear
          />
          <SheetMultiSelect
            label={t('organizer.createEvent.musicStyle', 'Music style')} values={formData.tags}
            options={toOptions(p.genres)} onChange={(v) => setField('tags', v)}
            placeholder="Search and select styles" searchPlaceholder="Search styles" allowCustom
          />
          <label className="block">
            <FieldLabel hint={`${formData.description.length} characters`}>{t('organizer.createEvent.descriptionLabel', 'Description')}</FieldLabel>
            <textarea
              ref={descRef} value={formData.description} rows={4}
              onChange={(e) => setField('description', e.target.value)}
              placeholder={t('organizer.createEvent.descriptionPlaceholder', 'Tell people what to expect')}
              className="block min-h-28 w-full min-w-0 resize-none rounded-xl border border-black/10 bg-neutral-50 px-4 py-3 text-base leading-relaxed text-[#020b00] placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </label>
        </Section>

        {/* ───────── Date & location ───────── */}
        <Section
          id="when" icon={Calendar} title="Date & location"
          summary={previewDate ? `${previewDate}${formData.city ? ` · ${formData.city}` : ''}` : 'When and where'}
          done={whenDone} open={!!openSections.when} onToggle={toggleSection}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0">
              <FieldLabel required>{t('organizer.createEvent.startDate', 'Start date')}</FieldLabel>
              <input className={inputClass} type="date" value={formData.date} min={todayStr()} onChange={(e) => setField('date', e.target.value)} />
            </label>
            <label className="block min-w-0">
              <FieldLabel required>{t('organizer.createEvent.startTime', 'Start time')}</FieldLabel>
              <input className={inputClass} type="time" value={formData.time} onChange={(e) => setField('time', e.target.value)} />
            </label>
            <label className="block min-w-0">
              <FieldLabel>{t('organizer.createEvent.endDate', 'End date')}</FieldLabel>
              <input className={inputClass} type="date" value={formData.endDate} min={formData.date || todayStr()} onChange={(e) => setField('endDate', e.target.value)} />
            </label>
            <label className="block min-w-0">
              <FieldLabel>{t('organizer.createEvent.endTime', 'End time')}</FieldLabel>
              <input className={inputClass} type="time" value={formData.endTime} onChange={(e) => setField('endTime', e.target.value)} />
            </label>
          </div>
          {Boolean(formData.endDate) !== Boolean(formData.endTime) && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Add both an end date and end time, or leave both empty.</p>
          )}
          <label className="block">
            <FieldLabel required>{t('organizer.createEvent.venueName', 'Venue')}</FieldLabel>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                className={`${inputClass} pl-12`} type="text" value={formData.venue} autoComplete="off"
                onChange={(e) => setField('venue', e.target.value)} placeholder="e.g., Warehouse District"
              />
            </div>
          </label>
          <label className="block">
            <FieldLabel>{t('organizer.createEvent.addressLabel', 'Address')}</FieldLabel>
            <input
              className={inputClass} type="text" value={formData.address} autoComplete="street-address"
              onChange={(e) => setField('address', e.target.value)} placeholder={t('organizer.createEvent.addressPlaceholder', 'Street address')}
            />
          </label>
          <SheetSelect
            label="City" required value={formData.city} options={toOptions(p.cities)}
            onChange={(v) => setField('city', v)} placeholder="Select a city" searchPlaceholder="Search cities"
          />
        </Section>

        {/* ───────── Line-up ───────── */}
        <Section
          id="lineup" icon={Music} title={t('organizer.createEvent.musicLineup', 'Line-up')}
          summary={selectedDjs.length ? `${selectedDjs.length} selected` : 'Optional'} done={selectedDjs.length > 0}
          open={!!openSections.lineup} onToggle={toggleSection}
        >
          {artists.length === 0 ? (
            <p className="text-sm text-gray-500">No artist profiles on the platform yet.</p>
          ) : (
            <>
              <SheetMultiSelect
                label={hasTypes ? 'DJs' : 'DJs & artists'} values={selectedIn(djList)} options={toArtistOptions(djList)}
                onChange={updateSelection(djList)} placeholder="Search and select"
                searchPlaceholder="Search by name" emptyText="No matching profiles"
              />
              {performerList.length > 0 && (
                <SheetMultiSelect
                  label="Artists & performers" values={selectedIn(performerList)} options={toArtistOptions(performerList)}
                  onChange={updateSelection(performerList)} placeholder="Search and select"
                  searchPlaceholder="Search by name" emptyText="No matching profiles"
                />
              )}
            </>
          )}
        </Section>

        {/* ───────── Photos & Cloud Album ───────── */}
        <Section
          id="photos" icon={ImageIcon} title={t('organizer.createEvent.photos', 'Photos & Cloud Album')}
          summary={
            p.galleryPreviews.length && formData.photoAlbumUrl?.trim()
              ? `${p.galleryPreviews.length} photos · Cloud link`
              : p.galleryPreviews.length
              ? `${p.galleryPreviews.length} photo${p.galleryPreviews.length === 1 ? '' : 's'}`
              : formData.photoAlbumUrl?.trim()
              ? 'Cloud album linked'
              : 'Upload photos or cloud link'
          }
          done={p.galleryPreviews.length > 0 || Boolean(formData.photoAlbumUrl?.trim())} open={!!openSections.photos} onToggle={toggleSection}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {p.galleryPreviews.map((src, i) => (
                <div key={`${i}-${src.slice(-12)}`} className="relative aspect-square overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                  <img src={src} alt={`Gallery photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button" onClick={() => p.onGalleryRemove(i)} aria-label={`Remove photo ${i + 1}`}
                    className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1.5"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-3.5 w-3.5" /></span>
                  </button>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-black/20 text-gray-500 active:border-[#d3da0c] dark:border-white/20">
                <Plus className="h-6 w-6" />
                <span className="text-xs">Add photos</span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { p.onGallerySelect(e); e.target.value = ''; }} />
              </label>
            </div>

            <div>
              <FieldLabel>Cloud Photo Album Link (Google Drive, Baidu, WeChat, iCloud, Dropbox)</FieldLabel>
              <input
                className={inputClass}
                type="url"
                inputMode="url"
                value={formData.photoAlbumUrl || ''}
                onChange={(e) => setField('photoAlbumUrl', e.target.value)}
                placeholder="https://drive.google.com/... or cloud album URL"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Attendees can open this link on the event page to view & download event photos.
              </span>
            </div>
          </div>
        </Section>

        {/* ───────── Tickets ───────── */}
        <Section
          id="tickets" icon={Ticket} title={t('organizer.createEvent.tickets', 'Tickets')}
          summary={`${ticketTiers.length} categor${ticketTiers.length === 1 ? 'y' : 'ies'} · ${totalTickets} tickets`}
          done={ticketsDone} open={!!openSections.tickets} onToggle={toggleSection}
        >
          <div className="space-y-2">
            {ticketTiers.map((tier, index) => {
              const open = openTier === tier.id;
              const invalid = tierIssue(tier);
              return (
                <div key={tier.id} className="min-w-0 overflow-hidden rounded-xl border border-black/10 bg-neutral-50 dark:border-white/10 dark:bg-white/5">
                  <button
                    type="button" onClick={() => setOpenTier(open ? null : tier.id)} aria-expanded={open}
                    className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left"
                  >
                    <Ticket className="h-4 w-4 shrink-0 text-[#7a8000] dark:text-[#d3da0c]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#020b00] dark:text-white">
                        {tier.name || `${t('organizer.createEvent.ticket', 'Ticket')} ${index + 1}`}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {tier.price !== '' ? `¥${tier.price}` : 'Set price'} · {tier.quantity !== '' ? `${tier.quantity} available` : 'Set quantity'}
                      </span>
                    </span>
                    {invalid && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="Incomplete" />}
                    <ChevronDown className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="min-w-0 space-y-3 border-t border-black/8 p-3 dark:border-white/8">
                      <label className="block">
                        <FieldLabel required>Ticket name</FieldLabel>
                        <input
                          className={inputClass} type="text" value={tier.name} autoComplete="off"
                          onChange={(e) => handleTicketTierChange(tier.id, 'name', e.target.value)}
                          placeholder={t('organizer.createEvent.ticketCategory', 'e.g., Early Bird')}
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block min-w-0">
                          <FieldLabel required>Price (¥)</FieldLabel>
                          <input
                            className={inputClass} type="number" inputMode="decimal" min="0" step="0.01" value={tier.price}
                            onChange={(e) => handleTicketTierChange(tier.id, 'price', e.target.value)} placeholder="0"
                          />
                        </label>
                        <label className="block min-w-0">
                          <FieldLabel required>Quantity</FieldLabel>
                          <input
                            className={inputClass} type="number" inputMode="numeric" min="1" step="1" value={tier.quantity}
                            onChange={(e) => handleTicketTierChange(tier.id, 'quantity', e.target.value)} placeholder="100"
                          />
                        </label>
                        <label className="block min-w-0">
                          <FieldLabel>Sales start</FieldLabel>
                          <input
                            className={inputClass} type="date" value={tier.saleStartDate} min={todayStr()}
                            onChange={(e) => handleTicketTierChange(tier.id, 'saleStartDate', e.target.value)}
                          />
                        </label>
                        <label className="block min-w-0">
                          <FieldLabel>Sales end</FieldLabel>
                          <input
                            className={inputClass} type="date" value={tier.saleEndDate} min={tier.saleStartDate || todayStr()}
                            onChange={(e) => handleTicketTierChange(tier.id, 'saleEndDate', e.target.value)}
                          />
                        </label>
                      </div>
                      <label className="block">
                        <FieldLabel>{t('organizer.createEvent.maxPerPerson', 'Max per person')}</FieldLabel>
                        <input
                          className={inputClass} type="number" inputMode="numeric" min="1" step="1" value={tier.maxPerPerson}
                          onChange={(e) => handleTicketTierChange(tier.id, 'maxPerPerson', e.target.value)}
                        />
                      </label>
                      <button
                        type="button" onClick={() => removeTicketTier(tier.id)} disabled={ticketTiers.length <= 1}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-red-500 active:bg-red-500/10 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" /> Remove this ticket
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button" onClick={addTicketTier} disabled={ticketTiers.length >= p.maxTiers}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/20 text-sm font-semibold text-gray-700 active:border-[#d3da0c] disabled:opacity-50 dark:border-white/20 dark:text-gray-300"
          >
            <Plus className="h-5 w-5" />
            {t('organizer.createEvent.addTicketCategory', 'Add ticket category')}
          </button>

          {/* Capacity — kept in sync with ticket quantities */}
          <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium text-[#020b00] dark:text-white">
                <Users className="h-4 w-4 text-[#7a8000] dark:text-[#d3da0c]" />
                {t('organizer.createEvent.capacityLabel', 'Total capacity')}
              </span>
              <span className="text-lg font-bold text-[#020b00] dark:text-white">{capacityNum || 0}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {capacityManual
                ? `${totalTickets} of ${capacityNum || 0} tickets allocated${capacityNum > totalTickets ? ` · ${capacityNum - totalTickets} unallocated` : ''}`
                : `Calculated from ticket quantities (${totalTickets})`}
            </p>
            <Switch checked={capacityManual} onChange={(v) => setCapacityManual(v)} label="Set capacity manually" description="Cap total attendance below or above your ticket quantities" />
            {capacityManual && (
              <input
                className={inputClass} type="number" inputMode="numeric" min="1" step="1" value={formData.capacity}
                onChange={(e) => setField('capacity', e.target.value)} placeholder="100" aria-label="Total capacity"
              />
            )}
            {overAllocated && <p className="mt-2 text-xs font-medium text-red-500">{blockingIssue}</p>}
          </div>
        </Section>

        {/* ───────── Payment ───────── */}
        <Section
          id="payment" icon={CreditCard} title={t('organizer.createEvent.paymentSetup', 'Payment setup')}
          summary={p.wechatQrPreview || p.alipayQrPreview ? 'QR code added' : 'WeChat and Alipay QR'}
          done={!!(p.wechatQrPreview || p.alipayQrPreview)} open={!!openSections.payment} onToggle={toggleSection}
        >
          <div className="grid grid-cols-2 gap-3">
            {renderQrTile('wechat', 'WeChat Pay', p.wechatQrPreview)}
            {renderQrTile('alipay', 'Alipay', p.alipayQrPreview)}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-black/5 px-4 py-3 text-sm dark:bg-white/5">
            <span className="text-gray-600 dark:text-gray-400">Base ticket price</span>
            <span className="font-semibold text-[#020b00] dark:text-white">{formData.ticketPrice === '' ? '—' : `¥${formData.ticketPrice}`}</span>
          </div>
          <label className="block">
            <FieldLabel>{t('organizer.createEvent.paymentInstructionsLabel', 'Payment instructions')}</FieldLabel>
            <textarea
              value={p.paymentInstructions} rows={3} onChange={(e) => p.setPaymentInstructions(e.target.value)}
              placeholder={t('organizer.createEvent.paymentInstructionsPlaceholder', 'e.g. Include your name and event name in the transfer note')}
              className="block w-full min-w-0 resize-none rounded-xl border border-black/10 bg-neutral-50 px-4 py-3 text-base text-[#020b00] placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </label>
        </Section>

        {/* ───────── Policies & security ───────── */}
        <Section
          id="security" icon={Shield} title={t('organizer.createEvent.securityVerification', 'Policies & security')}
          summary={formData.refundPolicy} open={!!openSections.security} onToggle={toggleSection}
        >
          <SheetSelect
            label={t('organizer.createEvent.refundPolicy', 'Refund policy')} value={formData.refundPolicy}
            options={toOptions(p.refundPolicies)} onChange={(v) => setField('refundPolicy', v)} searchable={false}
          />
          <div className="divide-y divide-black/8 dark:divide-white/8">
            <Switch
              checked={formData.refundsAllowed} onChange={(v) => setField('refundsAllowed', v)}
              label={t('organizer.createEvent.allowRefunds', 'Allow cancellations & refunds')}
              description={t('organizer.createEvent.allowRefundsDesc', 'Buyers can cancel their orders and request refunds')}
            />
            <Switch
              checked={formData.requireId} onChange={(v) => setField('requireId', v)}
              label={t('organizer.createEvent.requireIdDocument', 'Require ID at entry')}
              description={t('organizer.createEvent.requireIdDescription', '')}
            />
            <Switch
              checked={formData.showRemainingTickets} onChange={(v) => setField('showRemainingTickets', v)}
              label={t('organizer.createEvent.showTicketsRemaining', 'Show tickets remaining')}
              description={t('organizer.createEvent.showTicketsRemainingDescription', '')}
            />
            <Switch
              checked={formData.promoterEnabled} onChange={(v) => setField('promoterEnabled', v)}
              label={t('organizer.createEvent.enablePromoters', 'Enable promoter program')}
              description={t('organizer.createEvent.enablePromotersDescription', 'Promoters share your event and earn commission')}
            />
          </div>
          {formData.promoterEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <FieldLabel>Commission %</FieldLabel>
                <input className={inputClass} type="number" inputMode="decimal" min="0" max="100" step="0.1" value={formData.commissionRate} onChange={(e) => setField('commissionRate', e.target.value)} />
              </label>
              <label className="block min-w-0">
                <FieldLabel>Referral discount %</FieldLabel>
                <input className={inputClass} type="number" inputMode="decimal" min="0" max="100" step="0.1" value={formData.discountPercent} onChange={(e) => setField('discountPercent', e.target.value)} />
              </label>
              <label className="col-span-2 block min-w-0">
                <FieldLabel hint="Optional">Max discount amount</FieldLabel>
                <input className={inputClass} type="number" inputMode="decimal" min="0" step="0.01" value={formData.maxDiscountAmount} onChange={(e) => setField('maxDiscountAmount', e.target.value)} placeholder="No cap" />
              </label>
            </div>
          )}
        </Section>

        {/* ───────── Preview ───────── */}
        <Section
          id="preview" icon={Share2} title={t('organizer.createEvent.eventPreview', 'Preview')}
          summary="Updates as you type" open={!!openSections.preview} onToggle={toggleSection}
        >
          <div className="overflow-hidden rounded-xl border border-black/10 bg-neutral-50 dark:border-white/10 dark:bg-[#020b00]">
            {formData.image ? (
              <img src={formData.image} alt="" className="h-44 w-full object-cover" />
            ) : (
              <div className="flex h-32 w-full items-center justify-center bg-black/5 dark:bg-white/5">
                <ImageIcon className="h-9 w-9 text-black/20 dark:text-white/20" />
              </div>
            )}
            <div className="space-y-2 p-4">
              <h4 className="text-lg font-semibold leading-tight text-[#020b00] dark:text-white">
                {formData.title || t('organizer.createEvent.eventTitle', 'Event title')}
              </h4>
              {previewDate && (
                <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="h-4 w-4 shrink-0 text-[#7a8000] dark:text-[#d3da0c]" /> {previewDate}
                </p>
              )}
              {(formData.venue || formData.city) && (
                <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="h-4 w-4 shrink-0 text-[#7a8000] dark:text-[#d3da0c]" />
                  <span className="min-w-0 break-words">{formData.venue}{formData.city ? `, ${formData.city}` : ''}</span>
                </p>
              )}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {formData.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="rounded-md bg-black/5 px-2 py-1 text-xs text-gray-700 dark:bg-white/10 dark:text-gray-300">{tag}</span>
                  ))}
                </div>
              )}
              {selectedDjs.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {artists.filter((a) => selectedDjs.includes(a.id)).map(artistName).join(' · ')}
                </p>
              )}
              <div className="space-y-1 border-t border-black/8 pt-3 dark:border-white/8">
                {ticketTiers.map((tier) => (
                  <div key={tier.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-[#020b00] dark:text-white">{tier.name || 'Ticket'}</span>
                    <span className="shrink-0 font-semibold text-[#020b00] dark:text-[#d3da0c]">
                      {tier.price === '' ? '—' : parseFloat(tier.price) === 0 ? 'Free' : `¥${tier.price}`}
                    </span>
                  </div>
                ))}
                <p className="pt-1 text-xs text-gray-500">Capacity {capacityNum || 0}</p>
              </div>
            </div>
          </div>
        </Section>

        {!p.hasBusinessProfile && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
            {t('organizer.createEvent.businessProfileMissing', 'Business profile required to publish events.')}
          </div>
        )}
      </div>

      {/* ───────── Form actions (in-flow below all cards so it never overlaps content) ───────── */}
      <div className="mt-5 mb-[calc(2rem+env(safe-area-inset-bottom,0px))] rounded-2xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-[#111111]">
        {blockingIssue && !overAllocated && <p className="mb-2 text-xs font-medium text-red-500">{blockingIssue}</p>}
        <div className="flex items-stretch gap-2">
          <button
            type="button" onClick={() => setConfirmCancel(true)} disabled={p.isSubmitting}
            className="min-h-12 shrink-0 rounded-xl px-3 text-sm font-semibold text-gray-600 active:bg-black/5 disabled:opacity-50 dark:text-gray-300 dark:active:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button" onClick={() => p.onSubmit('draft')} disabled={submitDisabled}
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-black/15 bg-white text-sm font-semibold text-[#020b00] active:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white"
          >
            {t('organizer.createEvent.saveDraft', 'Save draft')}
          </button>
          <button
            type="button" onClick={() => p.onSubmit('approved')} disabled={submitDisabled}
            className="flex min-h-12 min-w-0 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[#d3da0c] text-sm font-bold text-[#020b00] active:opacity-80 disabled:opacity-50"
          >
            {p.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : t('organizer.createEvent.publish', 'Publish event')}
          </button>
        </div>
      </div>

      <BottomSheet open={confirmCancel} title="Discard this event?" onClose={() => setConfirmCancel(false)}>
        <p className="px-3 pb-4 text-sm text-gray-600 dark:text-gray-400">Anything you entered on this page will be lost.</p>
        <div className="grid grid-cols-2 gap-3 px-3 pb-3">
          <button type="button" onClick={() => setConfirmCancel(false)} className="min-h-12 rounded-xl border border-black/15 text-sm font-semibold dark:border-white/15">
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmCancel(false);
              p.onCancel();
            }}
            className="min-h-12 rounded-xl bg-red-500 text-sm font-semibold text-white"
          >
            Discard
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};

export default CreateEventMobile;
