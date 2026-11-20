/**
 * UploadProgressHUD — Pattern #8: Upload & Publishing Progress Notifications.
 * Branded floating HUD sitting cleanly above the bottom navigation bar.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, UploadCloud, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUploadProgressStore } from '@/store/uploadProgressStore';

export default function UploadProgressHUD() {
  const { tasks, dismissTask } = useUploadProgressStore();
  const navigate = useNavigate();

  if (tasks.length === 0) return null;

  return (
    <div
      className="fixed inset-x-3 sm:left-auto sm:right-4 sm:w-[min(92vw,22rem)] z-[95] space-y-2 pointer-events-none"
      style={{
        bottom: 'calc(var(--bottom-nav-height, 0px) + env(safe-area-inset-bottom, 0px) + 0.75rem)',
      }}
    >
      <AnimatePresence>
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="pointer-events-auto rounded-2xl bg-[#071204]/95 backdrop-blur-xl border border-white/15 p-3.5 shadow-2xl text-white"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  task.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : task.status === 'error'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-[#d3da0c]/15 text-[#d3da0c] border border-[#d3da0c]/30'
                }`}
              >
                {task.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : task.status === 'error' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <UploadCloud className="w-5 h-5 animate-pulse" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold truncate">{task.title}</p>
                  <span className="text-[0.6875rem] font-extrabold text-[#d3da0c] shrink-0">
                    {task.status === 'error' ? 'Failed' : `${task.progress}%`}
                  </span>
                </div>
                <p className="text-[0.6875rem] text-gray-400 truncate mt-0.5">
                  {task.status === 'error' ? task.errorMessage || 'Upload failed' : task.subtitle || 'Uploading...'}
                </p>

                {task.status !== 'error' && (
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        task.status === 'completed' ? 'bg-emerald-400' : 'bg-[#d3da0c]'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}

                {task.status === 'completed' && task.actionUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      dismissTask(task.id);
                      navigate(task.actionUrl!);
                    }}
                    className="mt-2 inline-flex items-center gap-0.5 text-[0.6875rem] font-bold text-[#d3da0c] hover:underline"
                  >
                    {task.actionLabel || 'View'} <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismissTask(task.id)}
                aria-label="Dismiss progress"
                className="p-1 text-gray-500 hover:text-white rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
