import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  /** Small uppercase chip shown above the title, e.g. "Management" / "Finance" */
  chip?: string;
  /** Right-aligned action buttons/content */
  actions?: ReactNode;
}

/**
 * Shared page header for all admin pages — keeps a consistent hero-band
 * layout (role chip, title, subtitle, actions) across the whole admin panel.
 */
export const AdminPageHeader = ({ title, subtitle, chip, actions }: AdminPageHeaderProps) => (
  <div className="relative overflow-hidden rounded-2xl border border-black/8 dark:border-white/10 bg-gradient-to-br from-[#d3da0c]/12 via-transparent to-transparent p-5 lg:p-6 shadow-xs dark:shadow-none mb-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="min-w-0">
        {chip && (
          <span className="inline-block px-2 py-0.5 rounded-full bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-[10px] font-black uppercase tracking-wider mb-1.5">
            {chip}
          </span>
        )}
        <h1 className="text-2xl font-bold text-[#020b00] dark:text-white">{title}</h1>
        {subtitle && <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  </div>
);

export default AdminPageHeader;
