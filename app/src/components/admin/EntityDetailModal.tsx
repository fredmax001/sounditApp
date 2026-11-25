import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  X, User, Music, Store, Building2, CheckCircle2,
  AlertCircle, ExternalLink, Mail, Phone, MapPin,
  Calendar, DollarSign, Ticket, Heart, Shield,
  Award, Lock, Unlock, Loader2, Check,
  Package, Globe, Copy, CheckCheck, Star
} from 'lucide-react';

export type EntityType = 'user' | 'artist' | 'vendor' | 'business';

interface EntityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: EntityType;
  entityId: number | string | null;
  onUpdate?: () => void;
  onUpdated?: () => void;
}

export default function EntityDetailModal({
  isOpen,
  onClose,
  type,
  entityId,
  onUpdate,
  onUpdated
}: EntityDetailModalProps) {
  const triggerUpdate = onUpdate || onUpdated;
  const { t } = useTranslation();
  const { session, isSuperAdmin } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const authHeaders = useCallback(() => ({
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json'
  }), [session?.access_token]);

  const loadEntity = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      let endpoint = '';
      if (type === 'user') endpoint = `${API_BASE_URL}/admin/users/${entityId}`;
      else if (type === 'artist') endpoint = `${API_BASE_URL}/admin/artists/${entityId}`;
      else if (type === 'vendor') endpoint = `${API_BASE_URL}/admin/vendors/${entityId}`;
      else if (type === 'business') endpoint = `${API_BASE_URL}/admin/businesses/${entityId}`;

      const res = await fetch(endpoint, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        toast.error('Failed to load profile details');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [entityId, type, authHeaders]);

  useEffect(() => {
    if (isOpen && entityId) {
      loadEntity();
    } else {
      setData(null);
    }
  }, [isOpen, entityId, loadEntity]);

  const copyToClipboard = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Copied ${field} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Actions
  const handleToggleVerification = async () => {
    if (!data) return;
    const targetUserId = type === 'user' ? data.id : data.user_id;
    if (!targetUserId) return;
    setActionLoading('verify');
    try {
      const isCurrentlyVerified = !!data.is_verified;
      const res = await fetch(`${API_BASE_URL}/admin/users/${targetUserId}/verify`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ verified: !isCurrentlyVerified })
      });
      if (res.ok) {
        toast.success(!isCurrentlyVerified ? 'Verification granted' : 'Verification removed');
        await loadEntity();
        triggerUpdate?.();
      } else {
        toast.error('Failed to update verification');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSuspension = async () => {
    if (!data) return;
    const targetUserId = type === 'user' ? data.id : data.user_id;
    if (!targetUserId) return;
    const isSuspended = data.status === 'suspended' || data.status === 'inactive';
    const action = isSuspended ? 'activate' : 'suspend';
    setActionLoading('status');
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${targetUserId}/${action}`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) {
        toast.success(isSuspended ? 'Account activated' : 'Account suspended');
        await loadEntity();
        triggerUpdate?.();
      } else {
        toast.error(`Failed to ${action} account`);
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleVendorApproval = async (approve: boolean) => {
    if (type !== 'vendor' || !data) return;
    setActionLoading('approval');
    try {
      const endpoint = approve
        ? `${API_BASE_URL}/admin/vendors/${data.id}/approve`
        : `${API_BASE_URL}/admin/vendors/${data.id}/unapprove`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) {
        toast.success(approve ? 'Vendor approved' : 'Vendor unapproved');
        await loadEntity();
        triggerUpdate?.();
      } else {
        toast.error('Failed to update approval');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFeatureToggle = async () => {
    if (!data) return;
    setActionLoading('feature');
    try {
      let endpoint = '';
      if (type === 'artist') endpoint = `${API_BASE_URL}/admin/artists/${data.id}/feature`;
      else if (type === 'vendor') endpoint = `${API_BASE_URL}/admin/vendors/${data.id}/feature`;
      else if (type === 'business') endpoint = `${API_BASE_URL}/admin/businesses/${data.id}/feature`;
      if (!endpoint) return;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.ok) {
        toast.success('Featured status updated');
        await loadEntity();
        triggerUpdate?.();
      } else {
        toast.error('Failed to update featured status');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  // Resolve Titles & Public URLs
  let publicUrl = '';
  let entityTitle = '';
  let entitySubtitle = '';
  let avatarImg = '';

  if (data) {
    if (type === 'user') {
      entityTitle = `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email;
      entitySubtitle = data.role ? `${data.role.toUpperCase()} Account` : 'User';
      publicUrl = `/profiles/${data.slug || data.id}`;
      avatarImg = data.avatar_url;
    } else if (type === 'artist') {
      entityTitle = data.stage_name || data.user_name || 'Artist';
      entitySubtitle = data.genre ? `DJ / Producer • ${data.genre}` : 'DJ / Music Artist';
      publicUrl = `/artists/${data.slug || data.id}`;
      avatarImg = data.avatar_url;
    } else if (type === 'vendor') {
      entityTitle = data.business_name || 'Vendor Store';
      entitySubtitle = data.category ? `Vendor • ${data.category}` : 'Vendor Partner';
      publicUrl = `/vendors/${data.slug || data.id}`;
      avatarImg = data.logo_url;
    } else if (type === 'business') {
      entityTitle = data.organization_name || 'Business Venue';
      entitySubtitle = 'Event Organizer / Business';
      publicUrl = `/business/${data.slug || data.id}`;
      avatarImg = data.logo_url;
    }
  }

  const isSuspended = data?.status === 'suspended' || data?.status === 'inactive';
  const isVerified = Boolean(data?.is_verified || data?.verification_badge);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 36 }}
          className="bg-white dark:bg-[#111111] border-t sm:border border-black/10 dark:border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Mobile Drag Handle */}
          <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-neutral-50 dark:bg-white/5 shrink-0">
            <div className="w-10 h-1 rounded-full bg-black/15 dark:bg-white/20" />
          </div>

          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-black/8 dark:border-white/10 bg-neutral-50 dark:bg-white/5 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#d3da0c]/20 text-yellow-800 dark:text-[#d3da0c] shrink-0">
                {type} details
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                ID #{entityId}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
              <p className="text-sm text-gray-500">Loading complete entity card...</p>
            </div>
          ) : !data ? (
            <div className="py-20 text-center px-4">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-base font-semibold text-[#020b00] dark:text-white">Profile details not found</p>
            </div>
          ) : (
            <div className="p-4 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-5 sm:space-y-6 overflow-y-auto flex-1">
              {/* Profile Card Lockup */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-50 dark:bg-[#161616] border border-black/5 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-black/10 dark:bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 border border-black/10 dark:border-white/10 relative">
                    {avatarImg ? (
                      <img src={avatarImg} alt="" className="w-full h-full object-cover" />
                    ) : type === 'artist' ? (
                      <Music className="w-8 h-8 text-[#d3da0c]" />
                    ) : type === 'vendor' ? (
                      <Store className="w-8 h-8 text-orange-400" />
                    ) : type === 'business' ? (
                      <Building2 className="w-8 h-8 text-blue-400" />
                    ) : (
                      <User className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-[#020b00] dark:text-white">
                        {entityTitle}
                      </h2>
                      {isVerified && (
                        <span className="p-0.5 rounded-full bg-[#d3da0c] text-black" title="Verified Account">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {entitySubtitle}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[0.6875rem] font-bold uppercase tracking-wider ${
                        isSuspended
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                          : 'bg-green-500/15 text-green-600 dark:text-green-400'
                      }`}>
                        {isSuspended ? 'Suspended' : 'Active'}
                      </span>
                      {data.is_approved !== undefined && (
                        <span className={`px-2 py-0.5 rounded-md text-[0.6875rem] font-bold uppercase tracking-wider ${
                          data.is_approved
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}>
                          {data.is_approved ? 'Approved' : 'Pending Approval'}
                        </span>
                      )}
                      {data.is_featured && (
                        <span className="px-2 py-0.5 rounded-md text-[0.6875rem] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          Featured
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {publicUrl && (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#d3da0c] text-black font-bold text-xs hover:bg-[#c2c80b] transition-all shadow-sm flex-shrink-0"
                  >
                    <span>View Public Page</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {type === 'user' && (
                  <>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-[#d3da0c]" /> Total Spend
                      </p>
                      <p className="text-lg font-bold text-[#020b00] dark:text-white mt-1">
                        ¥{(data.stats?.total_spent || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Ticket className="w-3.5 h-3.5 text-blue-400" /> Tickets Bought
                      </p>
                      <p className="text-lg font-bold text-[#020b00] dark:text-white mt-1">
                        {data.stats?.tickets_count || 0}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-purple-400" /> Bookings
                      </p>
                      <p className="text-lg font-bold text-[#020b00] dark:text-white mt-1">
                        {data.stats?.bookings_count || 0}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-pink-400" /> Following
                      </p>
                      <p className="text-lg font-bold text-[#020b00] dark:text-white mt-1">
                        {data.stats?.following_count || 0}
                      </p>
                    </div>
                  </>
                )}

                {type === 'artist' && (
                  <>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-pink-400" /> Followers
                      </p>
                      <p className="text-lg font-bold text-[#020b00] dark:text-white mt-1">
                        {data.followers_count || 0}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-purple-400" /> Events
                      </p>
                      <p className="text-lg font-bold text-[#020b00] dark:text-white mt-1">
                        {data.events_count || 0}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Music className="w-3.5 h-3.5 text-[#d3da0c]" /> Genre
                      </p>
                      <p className="text-sm font-bold text-[#020b00] dark:text-white mt-1 truncate">
                        {data.genre || 'Open Format'}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" /> Base City
                      </p>
                      <p className="text-sm font-bold text-[#020b00] dark:text-white mt-1 capitalize truncate">
                        {data.city || 'China'}
                      </p>
                    </div>
                  </>
                )}

                {type === 'vendor' && (
                  <>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-[#d3da0c]" /> Total Sales
                      </p>
                      <p className="text-lg font-bold text-[#020b00] dark:text-white mt-1">
                        ¥{(data.total_sales || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-blue-400" /> Products
                      </p>
                      <p className="text-lg font-bold text-[#020b00] dark:text-white mt-1">
                        {data.products_count || 0}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Store className="w-3.5 h-3.5 text-orange-400" /> Category
                      </p>
                      <p className="text-sm font-bold text-[#020b00] dark:text-white mt-1 capitalize truncate">
                        {data.category || data.vendor_type || 'Merchandise'}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-yellow-400" /> Rating
                      </p>
                      <p className="text-lg text-[#020b00] dark:text-white mt-1 flex items-center gap-1.5">
                        <span>{data.rating || '5.0'}</span>
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      </p>
                    </div>
                  </>
                )}

                {type === 'business' && (
                  <>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-[#d3da0c]" /> Total Revenue
                      </p>
                      <p className="text-lg font-bold text-[#020b00] dark:text-white mt-1">
                        ¥{(data.total_revenue || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-400" /> Events Hosted
                      </p>
                      <p className="text-lg font-bold text-[#020b00] dark:text-white mt-1">
                        {data.events_count || 0}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-purple-400" /> City
                      </p>
                      <p className="text-sm font-bold text-[#020b00] dark:text-white mt-1 capitalize truncate">
                        {data.city || 'China'}
                      </p>
                    </div>
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-green-400" /> Verification
                      </p>
                      <p className="text-sm font-bold text-[#020b00] dark:text-white mt-1">
                        {isVerified ? 'Verified' : 'Standard'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Identity & Contact Details */}
              <div className="space-y-3 p-5 rounded-2xl bg-neutral-50/60 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Identity & Contact Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {data.email && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/5">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-[#020b00] dark:text-white truncate">{data.email}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(data.email, 'email')}
                        className="p-1 hover:text-[#d3da0c] text-gray-400 transition-colors ml-2"
                      >
                        {copiedField === 'email' ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}

                  {data.phone && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/5">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-[#020b00] dark:text-white truncate">{data.phone}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(data.phone, 'phone')}
                        className="p-1 hover:text-[#d3da0c] text-gray-400 transition-colors ml-2"
                      >
                        {copiedField === 'phone' ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}

                  {(data.city || data.preferred_city) && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/5">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-500 text-xs">City:</span>
                      <span className="text-[#020b00] dark:text-white font-medium capitalize">
                        {data.city || data.preferred_city}
                      </span>
                    </div>
                  )}

                  {data.created_at && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/5">
                      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-500 text-xs">Registered:</span>
                      <span className="text-[#020b00] dark:text-white font-medium">
                        {new Date(data.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {data.bio && (
                  <div className="pt-2">
                    <p className="text-xs text-gray-500 mb-1">Bio / Description:</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed bg-white dark:bg-[#161616] p-3 rounded-xl border border-black/5 dark:border-white/5">
                      {data.bio}
                    </p>
                  </div>
                )}
              </div>

              {/* Linked Sub-Profiles (for user role) */}
              {type === 'user' && (data.artist_profile || data.business_profile || data.organizer_profile || data.vendor_profile) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Linked Creator & Business Spaces
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.artist_profile && (
                      <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-[#161616] border border-black/5 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-[#d3da0c]/15 text-[#d3da0c]">
                            <Music className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#020b00] dark:text-white">
                              {data.artist_profile.stage_name}
                            </p>
                            <p className="text-xs text-gray-500">DJ • {data.artist_profile.genre || 'Music'}</p>
                          </div>
                        </div>
                        <a
                          href={`/artists/${data.artist_profile.slug || data.artist_profile.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/10 hover:text-[#d3da0c] transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}

                    {(data.business_profile || data.organizer_profile) && (
                      <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-[#161616] border border-black/5 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-500">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#020b00] dark:text-white">
                              {data.organizer_profile?.organization_name || data.business_profile?.organization_name || 'Business'}
                            </p>
                            <p className="text-xs text-gray-500">Event Organizer</p>
                          </div>
                        </div>
                        <a
                          href={`/business/${data.organizer_profile?.slug || data.business_profile?.slug || data.organizer_profile?.id || data.business_profile?.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/10 hover:text-blue-400 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}

                    {data.vendor_profile && (
                      <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-[#161616] border border-black/5 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-orange-500/15 text-orange-500">
                            <Store className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#020b00] dark:text-white">
                              {data.vendor_profile.business_name}
                            </p>
                            <p className="text-xs text-gray-500">Vendor • {data.vendor_profile.category || 'Store'}</p>
                          </div>
                        </div>
                        <a
                          href={`/vendors/${data.vendor_profile.slug || data.vendor_profile.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/10 hover:text-orange-400 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Streaming Links (for artist) */}
              {type === 'artist' && (data.spotify_url || data.soundcloud_url || data.apple_music_url || data.instagram_url) && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Social & Music Streaming Links
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {data.spotify_url && (
                      <a href={data.spotify_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1DB954]/10 text-[#1DB954] text-xs font-medium hover:bg-[#1DB954]/20 transition-colors">
                        <span>Spotify</span> <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {data.soundcloud_url && (
                      <a href={data.soundcloud_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF5500]/10 text-[#FF5500] text-xs font-medium hover:bg-[#FF5500]/20 transition-colors">
                        <span>SoundCloud</span> <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {data.apple_music_url && (
                      <a href={data.apple_music_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FA243C]/10 text-[#FA243C] text-xs font-medium hover:bg-[#FA243C]/20 transition-colors">
                        <span>Apple Music</span> <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {data.instagram_url && (
                      <a href={data.instagram_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors">
                        <span>Instagram</span> <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Actions Bar */}
              <div className="pt-4 border-t border-black/8 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleToggleVerification}
                    disabled={actionLoading === 'verify'}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                      isVerified
                        ? 'bg-neutral-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-neutral-200'
                        : 'bg-[#d3da0c] text-black hover:bg-[#c2c80b]'
                    }`}
                  >
                    {actionLoading === 'verify' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
                    {isVerified ? 'Revoke Verification' : 'Grant Verification'}
                  </button>

                  <button
                    onClick={handleToggleSuspension}
                    disabled={actionLoading === 'status'}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                      isSuspended
                        ? 'bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    {actionLoading === 'status' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSuspended ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    {isSuspended ? 'Activate Account' : 'Suspend Account'}
                  </button>

                  {type === 'vendor' && (
                    <button
                      onClick={() => handleVendorApproval(!data.is_approved)}
                      disabled={actionLoading === 'approval'}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                        data.is_approved
                          ? 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/25'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {actionLoading === 'approval' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {data.is_approved ? 'Revoke Approval' : 'Approve Vendor'}
                    </button>
                  )}

                  {(type === 'artist' || type === 'vendor' || type === 'business') && (
                    <button
                      onClick={handleFeatureToggle}
                      disabled={actionLoading === 'feature'}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                        data.is_featured
                          ? 'bg-neutral-100 dark:bg-white/10 text-gray-700 dark:text-gray-300'
                          : 'bg-purple-500/20 text-purple-700 dark:text-purple-400 hover:bg-purple-500/30'
                      }`}
                    >
                      {actionLoading === 'feature' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {data.is_featured ? 'Unfeature' : 'Feature on Platform'}
                    </button>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold text-xs hover:bg-neutral-200 dark:hover:bg-white/15 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
