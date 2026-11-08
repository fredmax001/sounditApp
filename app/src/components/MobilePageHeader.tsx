/**
 * MobilePageHeader — the single, consistent sticky sub-header used by all
 * mobile "kit" pages (Tickets, Favorites, Settings, Orders, …).
 *
 * Replaces per-page hand-rolled headers so back-button size, title style,
 * blur, borders, and vertical rhythm are identical everywhere.
 *
 * Usage:
 *   <MobilePageHeader title={t('kit.tickets.title')} />
 *   <MobilePageHeader title="My" accent="Orders" right={<button …/>} wide />
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MobilePageHeaderProps {
  /** Main title text (rendered before the accent part) */
  title: string;
  /** Optional accent word rendered in lime with underline (e.g. "Orders") */
  accent?: string;
  /** Custom back handler; defaults to history-aware navigate(-1) */
  onBack?: () => void;
  /** Optional right-aligned slot (icon buttons, badges) */
  right?: ReactNode;
  /** Match wider content containers (max-w-4xl instead of max-w-3xl) */
  wide?: boolean;
  /** Extra content rendered below the title row (tabs, filters) */
  children?: ReactNode;
  className?: string;
}

const MobilePageHeader = ({
  title,
  accent,
  onBack,
  right,
  wide = false,
  children,
  className = '',
}: MobilePageHeaderProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBack = onBack ?? (() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  });

  return (
    <section className={`sticky top-0 z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-xl border-b border-black/8 dark:border-white/5 transition-colors ${className}`}>
      <div className={`${wide ? 'max-w-4xl' : 'max-w-3xl'} mx-auto px-4 sm:px-6 lg:px-8 py-3`}>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            aria-label={t('kit.common.back')}
            className="w-11 h-11 -ml-2 shrink-0 rounded-full flex items-center justify-center text-[#020b00] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold font-display text-[#020b00] dark:text-white truncate">
            {title}
            {accent && (
              <>
                {' '}
                <span className="text-[#020b00] dark:text-[#d3da0c] underline decoration-[#d3da0c] decoration-2 underline-offset-4">
                  {accent}
                </span>
              </>
            )}
          </h1>
          {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
        </div>
        {children}
      </div>
    </section>
  );
};

export default MobilePageHeader;
