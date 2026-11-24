import React, { useState } from 'react';
import { Flag, Ban, MoreHorizontal, X, ShieldAlert, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';

interface SafetyActionsMenuProps {
  entityType: 'user' | 'post' | 'reel' | 'comment' | 'event';
  entityId: number | string;
  targetUserId?: number | string;
  targetName?: string;
  onBlocked?: (userId: number) => void;
  className?: string;
}

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Hate speech or abuse',
  'Inappropriate or explicit content',
  'Scam, fraud, or impersonation',
  'Other',
];

export const SafetyActionsMenu: React.FC<SafetyActionsMenuProps> = ({
  entityType,
  entityId,
  targetUserId,
  targetName,
  onBlocked,
  className = '',
}) => {
  const { profile, session, isAuthenticated } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentUserId = profile?.id ? Number(profile.id) : null;
  const resolvedTargetUserId = targetUserId
    ? Number(targetUserId)
    : entityType === 'user'
    ? Number(entityId)
    : null;

  if (currentUserId && resolvedTargetUserId && currentUserId === resolvedTargetUserId) {
    return null;
  }

  const getToken = () =>
    session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please sign in to report content');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/social/report`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: Number(entityId),
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.error?.message || 'Could not submit report');
      }
      toast.success(data.message || 'Report submitted. Our team will review it within 24 hours.');
      setReportModalOpen(false);
      setDetails('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlockUser = async () => {
    if (!resolvedTargetUserId) return;
    if (!isAuthenticated) {
      toast.error('Please sign in to block accounts');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/social/users/${resolvedTargetUserId}/block`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ also_report: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.error?.message || 'Could not block user');
      }
      toast.success(
        targetName
          ? `Blocked ${targetName}. Their content is now hidden.`
          : 'Account blocked. Their content is now hidden.'
      );
      setMenuOpen(false);
      if (onBlocked) onBlocked(resolvedTargetUserId);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to block account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setMenuOpen((prev) => !prev);
        }}
        aria-label="Safety and moderation options"
        className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-neutral-200 dark:hover:bg-white/20 border border-black/10 dark:border-white/10 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-[90]"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 mt-2 w-48 rounded-2xl bg-[#111510] border border-white/15 shadow-2xl py-1.5 z-[95]"
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                if (!isAuthenticated) {
                  toast.error('Please sign in to report content');
                  return;
                }
                setReportModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-amber-300 hover:bg-white/5 transition-colors"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span>Report {entityType === 'user' ? 'Account' : 'Content'}</span>
            </button>
            {resolvedTargetUserId && (
              <button
                type="button"
                disabled={submitting}
                onClick={handleBlockUser}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-red-400 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5 shrink-0" />
                <span>Block {targetName ? targetName.slice(0, 16) : 'Account'}</span>
              </button>
            )}
          </div>
        </>
      )}

      {reportModalOpen && (
        <div
          className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setReportModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#0F140D] border border-white/15 p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] sm:pb-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Report {entityType === 'user' ? 'Account' : 'Content'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">
                  Why are you reporting this?
                </label>
                <div className="space-y-1.5">
                  {REPORT_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                        selectedReason === reason
                          ? 'bg-[#d3da0c]/15 border-[#d3da0c]/60 text-white'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name="report_reason"
                        value={reason}
                        checked={selectedReason === reason}
                        onChange={() => setSelectedReason(reason)}
                        className="accent-[#d3da0c]"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Additional details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Provide any context to help our moderation team..."
                  className="w-full rounded-xl bg-black/50 border border-white/15 px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#d3da0c] text-black hover:bg-[#c4cf0a] disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafetyActionsMenu;
