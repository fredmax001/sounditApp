import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  /** Small uppercase category label shown above the title, e.g. "Platform" / "Finance" */
  chip?: string;
  /** Right-aligned action buttons/content */
  actions?: ReactNode;
}

/**
 * Shared editorial page header for all admin pages — clean, flat, well-aligned
 * desktop & mobile header bar with uniform typography weight.
 */
export const AdminPageHeader = ({ title, subtitle, chip, actions }: AdminPageHeaderProps) => (
  <div className="w-full max-w-full min-w-0 pb-5 mb-6 border-b border-black/8 dark:border-white/[0.08]">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 min-w-0">
      <div className="min-w-0 flex-1">
        {chip && (
          <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-[#8a8f04] dark:text-[#d3da0c] mb-1">
            {chip}
          </p>
        )}
        <h1 className="text-2xl sm:text-[1.625rem] text-[#020b00] dark:text-white tracking-tight leading-tight break-words">
          {title}
        </h1>
        {subtitle && (
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto sm:flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  </div>
);

export default AdminPageHeader;
