/**
 * NativeGettingStartedChecklist — Pattern #3: Contextual role-based Getting Started Checklist.
 *
 * STRICT PLATFORM GUARD: Renders ONLY inside native iOS / Android Capacitor apps
 * and ONLY for first-time eligible (or incomplete-checklist) native users.
 * Guaranteed null on Desktop Web, Mobile Web, and PWA.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ChevronRight, Compass, Disc3, X } from 'lucide-react';
import { isNativeMobileApp } from '@/lib/platform';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function NativeGettingStartedChecklist() {
  const navigate = useNavigate();
  const { isAuthenticated, profile } = useAuthStore();
  const { data, fetchState, saveProgress, startTour } = useOnboardingStore();

  const isNative = isNativeMobileApp();

  useEffect(() => {
    if (isNative && isAuthenticated && profile?.id) {
      fetchState(profile.id).catch(() => {});
    }
  }, [isNative, isAuthenticated, profile?.id, fetchState]);

  // Hard platform & eligibility guard — NEVER renders on web/PWA or for existing users
  if (!isNative || !isAuthenticated) return null;
  if (data.checklist_dismissed) return null;
  if (!data.is_first_time_eligible && !data.wizard_completed) return null;
  if (!data.checklist || data.checklist.length === 0) return null;

  // Hide automatically once every checklist item is truly completed
  const allDone = data.checklist_progress.total > 0 && data.checklist_progress.completed >= data.checklist_progress.total;
  if (allDone) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-[#071305] border border-[#d3da0c]/30 p-4 sm:p-5 text-white shadow-[0_12px_36px_rgba(0,0,0,0.45)] space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#d3da0c]/15 border border-[#d3da0c]/40 flex items-center justify-center shrink-0">
            <Disc3 className="w-5 h-5 text-[#d3da0c]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
              Getting Started on Sound It
            </h2>
            <p className="text-xs text-gray-400">
              {data.checklist_progress.completed} of {data.checklist_progress.total} completed ({data.checklist_progress.percent}%)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => saveProgress({ checklist_dismissed: true })}
          aria-label="Dismiss checklist"
          className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#d3da0c] to-emerald-400 transition-all duration-300"
          style={{ width: `${Math.max(6, data.checklist_progress.percent)}%` }}
        />
      </div>

      {/* Resume Incomplete Setup Wizard Prompt */}
      {!data.wizard_completed && data.is_first_time_eligible && (
        <button
          type="button"
          onClick={() => navigate(`/onboarding?mode=setup&step=${data.current_step || 0}`)}
          className="w-full px-3.5 py-2.5 rounded-2xl bg-[#d3da0c]/15 border border-[#d3da0c]/40 flex items-center justify-between gap-2 text-left hover:bg-[#d3da0c]/20 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-[#d3da0c]">Finish your personalized setup</p>
            <p className="text-[0.6875rem] text-gray-300 truncate">Pick your interests & notification preferences</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#d3da0c] shrink-0" />
        </button>
      )}

      {/* Checklist Rows */}
      <div className="space-y-2">
        {data.checklist.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.action_url)}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
              item.completed
                ? 'bg-emerald-500/10 border-emerald-500/25 opacity-80'
                : 'bg-white/[0.04] border-white/10 hover:border-[#d3da0c]/40 active:scale-[0.99]'
            }`}
          >
            {item.completed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-[#d3da0c] shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${item.completed ? 'line-through text-gray-400' : 'text-white'}`}>
                {item.title}
              </p>
              <p className="text-[0.6875rem] text-gray-400 truncate mt-0.5">{item.description}</p>
            </div>
            {!item.completed && <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
          </button>
        ))}
      </div>

      {/* Quick Launch Product Tour */}
      {!data.tour_completed && (
        <div className="pt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={startTour}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#d3da0c] hover:underline"
          >
            <Compass className="w-4 h-4" />
            Take quick feature tour
          </button>
        </div>
      )}
    </motion.section>
  );
}
