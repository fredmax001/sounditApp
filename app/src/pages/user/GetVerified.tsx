/**
 * Get Verified (/get-verified)
 * Role selector, Full Legal Name, ID/Passport upload (private), Selfie verification,
 * role-specific documents, and live status (Pending / Approved / Rejected + Resubmit).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ShieldCheck,
  User,
  IdCard,
  ScanFace,
  FileText,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Upload,
  BadgeCheck,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';

const ROLE_OPTIONS = [
  { id: 'user', label: 'Regular User' },
  { id: 'artist', label: 'DJ / Artist' },
  { id: 'organizer', label: 'Event Organizer' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'business', label: 'Business' },
];

interface StatusData {
  status: 'not_applied' | 'pending' | 'approved' | 'rejected' | string;
  submitted_at?: string | null;
  processed_at?: string | null;
  notes?: string | null;
  can_apply: boolean;
}

const GetVerified = () => {
  const navigate = useNavigate();
  const { session, profile, isAuthenticated } = useAuthStore();
  const token = session?.access_token;

  const defaultRole = (() => {
    const r = (profile?.role_type || profile?.role || 'user').toLowerCase();
    if (r === 'dj') return 'artist';
    return ROLE_OPTIONS.some(o => o.id === r) ? r : 'user';
  })();

  const [status, setStatus] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [roleType, setRoleType] = useState(defaultRole);
  const [legalName, setLegalName] = useState(`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim());
  const [idDocUrl, setIdDocUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [extraDocUrl, setExtraDocUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const idRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);

  const needsExtraDoc = roleType !== 'user';
  const extraDocLabel =
    roleType === 'artist' ? 'Portfolio / Press Kit' :
    roleType === 'vendor' ? 'Vendor / Food License' :
    'Business License';

  const loadStatus = async () => {
    if (!token) { setLoadingStatus(false); return; }
    setLoadingStatus(true);
    try {
      const res = await fetch(`${API_BASE_URL}/verification/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const uploadFile = async (file: File, slot: 'id' | 'selfie' | 'extra') => {
    if (!token) return;
    setUploading(slot);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || 'Upload failed');
      const url = data.url || data.file_url;
      if (slot === 'id') setIdDocUrl(url);
      if (slot === 'selfie') setSelfieUrl(url);
      if (slot === 'extra') setExtraDocUrl(url);
      toast.success('Uploaded securely');
    } catch (e) {
      toast.error((e as Error).message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async () => {
    if (!legalName.trim()) { toast.error('Enter your full legal name'); return; }
    if (!idDocUrl) { toast.error('Upload a photo of your ID or passport'); return; }
    if (!selfieUrl) { toast.error('Take or upload a selfie to confirm your identity'); return; }
    if (needsExtraDoc && !extraDocUrl) { toast.error(`Upload your ${extraDocLabel.toLowerCase()}`); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/verification/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          request_type: roleType,
          full_legal_name: legalName.trim(),
          id_document_url: idDocUrl,
          selfie_url: selfieUrl,
          documents: extraDocUrl ? [{ title: extraDocLabel, url: extraDocUrl, type: 'role_document', role_type: roleType }] : [],
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || data?.error?.message || 'Submission failed');
      toast.success('Verification submitted for review');
      setShowForm(false);
      loadStatus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const UploadRow = ({
    icon: Icon, title, subtitle, done, slot, inputRef, capture,
  }: {
    icon: any; title: string; subtitle: string; done: boolean; slot: 'id' | 'selfie' | 'extra';
    inputRef: React.RefObject<HTMLInputElement | null>; capture?: 'user' | 'environment';
  }) => (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-neutral-50 dark:bg-[#0a1408] border border-black/10 dark:border-white/10 hover:border-[#d3da0c] transition-colors text-left"
    >
      <div className="w-11 h-11 rounded-xl bg-[#d3da0c]/15 dark:bg-[#d3da0c]/10 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#8a8f04] dark:text-[#d3da0c]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#020b00] dark:text-white">{title}</p>
        <p className="text-xs text-gray-600 dark:text-gray-400">{subtitle}</p>
      </div>
      {uploading === slot ? (
        <Loader2 className="w-5 h-5 text-[#8a8f04] dark:text-[#d3da0c] animate-spin" />
      ) : done ? (
        <CheckCircle2 className="w-5 h-5 text-[#8a8f04] dark:text-[#d3da0c]" />
      ) : (
        <Upload className="w-4 h-4 text-gray-500" />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(capture ? { capture } : {})}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, slot); e.target.value = ''; }}
      />
    </button>
  );

  const st = status?.status || 'not_applied';
  const formVisible = showForm || st === 'not_applied';

  return (
    <div className="min-h-dvh bg-white dark:bg-[#020B00] text-[#020b00] dark:text-white pb-24 transition-colors duration-200">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#020B00]/95 backdrop-blur-xl border-b border-black/10 dark:border-white/10 safe-area-pt">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold tracking-tight">Get Verified</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-6 space-y-5">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-[#d3da0c]/15 dark:bg-[#d3da0c]/10 border border-[#d3da0c]/40 dark:border-[#d3da0c]/30 flex items-center justify-center shadow-[0_0_40px_rgba(211,218,12,0.25)]">
            <ShieldCheck className="w-10 h-10 text-[#8a8f04] dark:text-[#d3da0c]" />
          </div>
          <h2 className="text-2xl font-black mt-4">Verify Your Account</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-xs mx-auto">
            Build trust, grow your reach and get a verified badge on Sound It.
          </p>
        </motion.div>

        {loadingStatus ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" /></div>
        ) : (
          <>
            {/* Status cards */}
            {st === 'approved' && (
              <div className="p-5 rounded-2xl bg-[#d3da0c]/15 dark:bg-[#d3da0c]/10 border border-[#d3da0c]/40 text-center">
                <BadgeCheck className="w-10 h-10 text-[#8a8f04] dark:text-[#d3da0c] mx-auto" />
                <p className="text-base font-extrabold mt-2">You're Verified</p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Your verified badge is now visible across Sound It.</p>
              </div>
            )}
            {st === 'pending' && (
              <div className="p-5 rounded-2xl bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/15 flex items-start gap-3">
                <Clock className="w-6 h-6 text-[#8a8f04] dark:text-[#d3da0c] shrink-0" />
                <div>
                  <p className="text-sm font-extrabold">Verification Pending</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Submitted {status?.submitted_at ? new Date(status.submitted_at).toLocaleDateString() : 'recently'}.
                    Our team usually reviews requests within 1–3 business days.
                  </p>
                </div>
              </div>
            )}
            {st === 'rejected' && !showForm && (
              <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-3">
                <div className="flex items-start gap-3">
                  <XCircle className="w-6 h-6 text-red-500 dark:text-red-400 shrink-0" />
                  <div>
                    <p className="text-sm font-extrabold">Verification Not Approved</p>
                    {status?.notes && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Reason: {status.notes}</p>}
                  </div>
                </div>
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full h-11 rounded-full bg-[#d3da0c] text-black font-extrabold text-sm"
                >
                  Resubmit Verification
                </button>
              </div>
            )}

            {/* Application form */}
            {formVisible && st !== 'approved' && st !== 'pending' && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-2">Account Type</p>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setRoleType(r.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                          roleType === r.id ? 'bg-[#d3da0c] text-black' : 'bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-neutral-50 dark:bg-[#0a1408] border border-black/10 dark:border-white/10">
                  <div className="w-11 h-11 rounded-xl bg-[#d3da0c]/15 dark:bg-[#d3da0c]/10 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-[#8a8f04] dark:text-[#d3da0c]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#020b00] dark:text-white">Full Legal Name</p>
                    <input
                      value={legalName}
                      onChange={e => setLegalName(e.target.value)}
                      placeholder="As on your ID or passport"
                      className="w-full mt-1 bg-transparent text-sm text-[#020b00] dark:text-gray-200 placeholder:text-gray-500 focus:outline-none"
                    />
                  </div>
                </div>

                <UploadRow icon={IdCard} title="ID / Passport" subtitle="Upload a clear photo (stored privately)" done={!!idDocUrl} slot="id" inputRef={idRef} capture="environment" />
                <UploadRow icon={ScanFace} title="Selfie Verification" subtitle="Take a live selfie to confirm it's you" done={!!selfieUrl} slot="selfie" inputRef={selfieRef} capture="user" />
                {needsExtraDoc && (
                  <UploadRow icon={FileText} title={extraDocLabel} subtitle="Required for professional accounts" done={!!extraDocUrl} slot="extra" inputRef={extraRef} />
                )}

                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Anything else our team should know? (optional)"
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-[#0a1408] border border-black/10 dark:border-white/10 text-sm text-[#020b00] dark:text-white placeholder:text-gray-500 focus:outline-none focus:border-[#d3da0c] resize-none"
                />

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !!uploading}
                  className="w-full h-12 rounded-full bg-[#d3da0c] text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#d3da0c]/25 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Start Verification
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
                <p className="text-[0.6875rem] text-gray-500 text-center">
                  Your documents are only visible to the Sound It verification team.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GetVerified;
