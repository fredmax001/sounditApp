/**
 * IntelligentEmptyState — Pattern #7: Contextual empty states with clear explanations & primary/secondary actions.
 */
import type { LucideIcon } from 'lucide-react';

interface IntelligentEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryLabel?: string;
  onPrimaryClick?: () => void;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
}

export default function IntelligentEmptyState({
  icon: Icon,
  title,
  description,
  primaryLabel,
  onPrimaryClick,
  secondaryLabel,
  onSecondaryClick,
}: IntelligentEmptyStateProps) {
  return (
    <div className="py-16 px-5 text-center flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-2xl bg-[#d3da0c]/10 border border-[#d3da0c]/30 flex items-center justify-center mb-4 shadow-[0_0_24px_rgba(211,218,12,0.12)]">
        <Icon className="w-7 h-7 text-[#8a8f04] dark:text-[#d3da0c]" />
      </div>
      <h3 className="text-base font-extrabold text-[#020b00] dark:text-white tracking-tight">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1.5 max-w-xs leading-relaxed">
        {description}
      </p>
      {(primaryLabel || secondaryLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
          {primaryLabel && onPrimaryClick && (
            <button
              type="button"
              onClick={onPrimaryClick}
              className="px-[1.25em] py-[0.65em] rounded-full bg-[#d3da0c] text-black text-xs font-extrabold hover:brightness-105 active:scale-95 transition-all shadow-md shadow-[#d3da0c]/20"
            >
              {primaryLabel}
            </button>
          )}
          {secondaryLabel && onSecondaryClick && (
            <button
              type="button"
              onClick={onSecondaryClick}
              className="px-[1.25em] py-[0.65em] rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-[#020b00] dark:text-white text-xs font-bold hover:bg-black/10 dark:hover:bg-white/15 transition-all"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
