/**
 * BottomSheet — mobile-native modal sheet used by the mobile form controls.
 * Slides up from the bottom, respects safe areas, locks background scroll and
 * stays above the fixed bottom navigation (z-50).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sticky area under the header (search box, etc.) */
  header?: ReactNode;
  /** Sticky area at the bottom (confirm button, etc.) */
  footer?: ReactNode;
}

const BottomSheet = ({ open, title, onClose, children, header, footer }: BottomSheetProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Lock background scrolling (the page scrolls inside <main>, not <body>)
  useEffect(() => {
    if (!open) return;
    const main = document.querySelector('main');
    const prevBody = document.body.style.overflow;
    const prevMain = main ? (main as HTMLElement).style.overflow : '';
    document.body.style.overflow = 'hidden';
    if (main) (main as HTMLElement).style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      if (main) (main as HTMLElement).style.overflow = prevMain;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-black/10 bg-white text-[#020b00] dark:border-white/10 dark:bg-[#0d130c] dark:text-white"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div
              className="flex cursor-grab touch-none justify-center pb-1 pt-2"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1 w-10 rounded-full bg-black/20 dark:bg-white/20" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2 pt-1">
              <h2 className="text-base font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 active:bg-black/5 dark:text-gray-400 dark:active:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {header && <div className="px-4 pb-3">{header}</div>}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              {children}
            </div>
            {footer && (
              <div className="border-t border-black/10 px-4 pt-3 dark:border-white/10" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                {footer}
              </div>
            )}
            {!footer && <div style={{ height: 'max(0.5rem, env(safe-area-inset-bottom))' }} />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default BottomSheet;
