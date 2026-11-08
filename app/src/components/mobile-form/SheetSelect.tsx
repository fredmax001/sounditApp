/**
 * Mobile form selection controls built on BottomSheet:
 *  - SheetSelect:      single choice, optional search
 *  - SheetMultiSelect: multi choice with search, optional custom entries and
 *                      removable chips for the current selection
 */
import { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import BottomSheet from './BottomSheet';

export interface SheetOption {
  value: string;
  label: string;
  sublabel?: string;
  group?: string;
}

const triggerClass =
  'flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-black/10 bg-neutral-50 px-4 py-3 text-left text-base text-[#020b00] transition-colors active:border-[#d3da0c] dark:border-white/10 dark:bg-white/5 dark:text-white';

const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative">
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      autoComplete="off"
      autoCorrect="off"
      className="h-12 w-full min-w-0 rounded-xl border border-black/10 bg-neutral-50 pl-10 pr-3 text-base text-[#020b00] placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
    />
  </div>
);

const matches = (o: SheetOption, q: string) =>
  !q || o.label.toLowerCase().includes(q) || (o.sublabel || '').toLowerCase().includes(q);

/** Group options by `group` preserving order; returns [groupName|'' , options][] */
const groupOptions = (options: SheetOption[]) => {
  const order: string[] = [];
  const map = new Map<string, SheetOption[]>();
  options.forEach((o) => {
    const g = o.group || '';
    if (!map.has(g)) {
      map.set(g, []);
      order.push(g);
    }
    map.get(g)!.push(o);
  });
  return order.map((g) => [g, map.get(g)!] as const);
};

interface SingleProps {
  label: string;
  value: string;
  options: SheetOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  allowClear?: boolean;
  required?: boolean;
  searchPlaceholder?: string;
}

export const SheetSelect = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  searchable = true,
  allowClear = false,
  required,
  searchPlaceholder = 'Search',
}: SingleProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => options.filter((o) => matches(o, q)), [options, q]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className={`min-w-0 flex-1 truncate ${current ? '' : 'text-gray-500'}`}>{current?.label || placeholder}</span>
        <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" />
      </button>
      <BottomSheet
        open={open}
        title={label}
        onClose={close}
        header={searchable && options.length > 6 ? <SearchBox value={query} onChange={setQuery} placeholder={searchPlaceholder} /> : undefined}
      >
        {allowClear && value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              close();
            }}
            className="flex min-h-12 w-full items-center rounded-xl px-3 text-left text-sm text-gray-500 active:bg-black/5 dark:active:bg-white/10"
          >
            Clear selection
          </button>
        )}
        {filtered.length === 0 && <p className="px-3 py-8 text-center text-sm text-gray-500">No results</p>}
        {groupOptions(filtered).map(([group, items]) => (
          <div key={group || 'all'}>
            {group && <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{group}</p>}
            {items.map((o) => {
              const selected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    close();
                  }}
                  className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left active:bg-black/5 dark:active:bg-white/10 ${
                    selected ? 'text-[#020b00] dark:text-[#d3da0c]' : ''
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base">{o.label}</span>
                    {o.sublabel && <span className="block truncate text-xs text-gray-500">{o.sublabel}</span>}
                  </span>
                  {selected && <Check className="h-5 w-5 shrink-0 text-[#d3da0c]" />}
                </button>
              );
            })}
          </div>
        ))}
      </BottomSheet>
    </div>
  );
};

interface MultiProps {
  label: string;
  values: string[];
  options: SheetOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Let the user add values that are not in `options` */
  allowCustom?: boolean;
  /** Maximum chips shown inline before collapsing to "+N" */
  maxInlineChips?: number;
  /** Render a chip label for a value (defaults to option label or the value) */
  chipPrefix?: string;
  emptyText?: string;
}

export const SheetMultiSelect = ({
  label,
  values,
  options,
  onChange,
  placeholder = 'Select',
  searchPlaceholder = 'Search',
  allowCustom = false,
  chipPrefix = '',
  emptyText = 'No results',
}: MultiProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => options.filter((o) => matches(o, q)), [options, q]);
  const labelFor = (v: string) => options.find((o) => o.value === v)?.label || v;
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  const customValue = query.trim();
  const canAddCustom =
    allowCustom && customValue.length > 0 && !options.some((o) => o.label.toLowerCase() === customValue.toLowerCase()) &&
    !values.some((v) => v.toLowerCase() === customValue.toLowerCase());

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="min-w-0 flex-1 truncate text-gray-500">
          {values.length > 0 ? `${values.length} selected` : placeholder}
        </span>
        <Plus className="h-5 w-5 shrink-0 text-gray-500" />
      </button>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#d3da0c]/15 py-1 pl-3 pr-1 text-sm font-medium text-[#020b00] dark:text-[#d3da0c]"
            >
              <span className="truncate">
                {chipPrefix}
                {labelFor(v)}
              </span>
              <button
                type="button"
                onClick={() => toggle(v)}
                aria-label={`Remove ${labelFor(v)}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full active:bg-black/10 dark:active:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <BottomSheet
        open={open}
        title={label}
        onClose={close}
        header={<SearchBox value={query} onChange={setQuery} placeholder={searchPlaceholder} />}
        footer={
          <button
            type="button"
            onClick={close}
            className="min-h-12 w-full rounded-xl bg-[#d3da0c] text-base font-semibold text-[#020b00] active:opacity-80"
          >
            Done{values.length > 0 ? ` (${values.length})` : ''}
          </button>
        }
      >
        {canAddCustom && (
          <button
            type="button"
            onClick={() => {
              onChange([...values, customValue]);
              setQuery('');
            }}
            className="flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left text-base text-[#020b00] active:bg-black/5 dark:text-[#d3da0c] dark:active:bg-white/10"
          >
            <Plus className="h-5 w-5 shrink-0" />
            <span className="truncate">Add “{customValue}”</span>
          </button>
        )}
        {filtered.length === 0 && !canAddCustom && <p className="px-3 py-8 text-center text-sm text-gray-500">{emptyText}</p>}
        {groupOptions(filtered).map(([group, items]) => (
          <div key={group || 'all'}>
            {group && <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{group}</p>}
            {items.map((o) => {
              const selected = values.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => toggle(o.value)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left active:bg-black/5 dark:active:bg-white/10"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                      selected ? 'border-[#d3da0c] bg-[#d3da0c]' : 'border-black/25 dark:border-white/25'
                    }`}
                  >
                    {selected && <Check className="h-4 w-4 text-[#020b00]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base">{o.label}</span>
                    {o.sublabel && <span className="block truncate text-xs text-gray-500">{o.sublabel}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </BottomSheet>
    </div>
  );
};
