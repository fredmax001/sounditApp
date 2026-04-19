import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    XCircle,
    Star,
    Eye,
    EyeOff,
    Search,
    ArrowUpRight,
    TrendingUp,
    MapPin,
    Calendar,
    Loader2,
} from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const ReviewEvents = () => {
    const { t } = useTranslation();
    const { events, fetchEvents } = useEventStore();
    const { session } = useAuthStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());
    const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadEvents();
    }, [fetchEvents]);

    const loadEvents = async () => {
        setIsLoading(true);
        try {
            await fetchEvents();
        } catch {
            toast.error(t('admin.reviewEvents.failedToLoadEvents'));
        } finally {
            setIsLoading(false);
        }
    };

    const filteredEvents = events.filter(e => {
        const matchesSearch = !searchQuery ||
            e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.city.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const isFeatured = (id: string) => featuredIds.has(id);
    const isDisabled = (id: string) => disabledIds.has(id);

    const handleApproveEvent = async (eventId: string) => {
        setActionLoading(`approve-${eventId}`);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success(t('admin.reviewEvents.eventApproved'));
                setDisabledIds(prev => {
                    const next = new Set(prev);
                    next.delete(eventId);
                    return next;
                });
                loadEvents();
            } else {
                const err = await res.json();
                toast.error(err.detail || t('admin.reviewEvents.failedToApproveEvent'));
            }
        } catch {
            toast.error(t('admin.reviewEvents.networkError'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectEvent = async (eventId: string) => {
        const reason = prompt(t('admin.reviewEvents.rejectionReasonPrompt'));
        if (reason === null) return;

        setActionLoading(`reject-${eventId}`);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}/reject`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason: reason || undefined })
            });

            if (res.ok) {
                toast.success(t('admin.reviewEvents.eventRejected'));
                loadEvents();
            } else {
                const err = await res.json();
                toast.error(err.detail || t('admin.reviewEvents.failedToRejectEvent'));
            }
        } catch {
            toast.error(t('admin.reviewEvents.networkError'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleFeatureEvent = async (eventId: string) => {
        const isCurrentlyFeatured = isFeatured(eventId);
        setFeaturedIds(prev => {
            const next = new Set(prev);
            if (isCurrentlyFeatured) next.delete(eventId);
            else next.add(eventId);
            return next;
        });

        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}/feature`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_featured: !isCurrentlyFeatured })
            });

            if (res.ok) {
                toast(isCurrentlyFeatured ? 'Removed from featured' : 'Promoted to featured banner', {
                    icon: <Star className="w-4 h-4 text-[#d3da0c]" />
                });
            } else {
                // Revert optimistic update on failure
                setFeaturedIds(prev => {
                    const next = new Set(prev);
                    if (isCurrentlyFeatured) next.add(eventId);
                    else next.delete(eventId);
                    return next;
                });
                const err = await res.json();
                toast.error(err.detail || t('admin.reviewEvents.failedToUpdateFeaturedStatus'));
            }
        } catch {
            setFeaturedIds(prev => {
                const next = new Set(prev);
                if (isCurrentlyFeatured) next.add(eventId);
                else next.delete(eventId);
                return next;
            });
            toast.error(t('admin.reviewEvents.networkError'));
        }
    };

    const handleToggleVisibility = async (eventId: string) => {
        const isCurrentlyDisabled = isDisabled(eventId);
        setActionLoading(`visibility-${eventId}`);

        // Optimistic UI update
        setDisabledIds(prev => {
            const next = new Set(prev);
            if (isCurrentlyDisabled) next.delete(eventId);
            else next.add(eventId);
            return next;
        });

        try {
            const token = session?.access_token;
            const endpoint = isCurrentlyDisabled
                ? `${API_BASE_URL}/admin/events/${eventId}/approve`
                : `${API_BASE_URL}/admin/events/${eventId}/cancel`;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                toast(isCurrentlyDisabled ? t('admin.reviewEvents.eventNowVisible') : t('admin.reviewEvents.eventHidden'));
                loadEvents();
            } else {
                // Revert optimistic update on failure
                setDisabledIds(prev => {
                    const next = new Set(prev);
                    if (isCurrentlyDisabled) next.add(eventId);
                    else next.delete(eventId);
                    return next;
                });
                const err = await res.json();
                toast.error(err.detail || t('admin.reviewEvents.failedToUpdateVisibility'));
            }
        } catch {
            setDisabledIds(prev => {
                const next = new Set(prev);
                if (isCurrentlyDisabled) next.add(eventId);
                else next.delete(eventId);
                return next;
            });
            toast.error(t('admin.reviewEvents.networkError'));
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display text-white mb-2">{t('admin.reviewEvents.title')}</h1>
                    <p className="text-gray-400">{t('admin.reviewEvents.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <span className="text-white text-xs font-bold">{t('admin.reviewEvents.featuredCount', { count: featuredIds.size })}</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder={t('admin.reviewEvents.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'approved' | 'rejected')}
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                >
                    <option value="all" className="bg-[#111111]">{t('admin.reviewEvents.allStatus')}</option>
                    <option value="pending" className="bg-[#111111]">{t('admin.reviewEvents.statusPending')}</option>
                    <option value="approved" className="bg-[#111111]">{t('admin.reviewEvents.statusApproved')}</option>
                    <option value="rejected" className="bg-[#111111]">{t('admin.reviewEvents.statusRejected')}</option>
                </select>
                <button
                    onClick={loadEvents}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                    <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {t('admin.reviewEvents.refresh')}
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="text-center py-20">
                    <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-white font-semibold text-lg mb-2">
                        {searchQuery || statusFilter !== 'all' ? t('admin.reviewEvents.noMatchingEvents') : t('admin.reviewEvents.noEventsFound')}
                    </h3>
                    <p className="text-gray-500">
                        {searchQuery || statusFilter !== 'all' ? t('admin.reviewEvents.tryAdjustingFilters') : t('admin.reviewEvents.eventsWillAppearHere')}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredEvents.map((event) => (
                            <motion.div
                                key={event.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`glass rounded-2xl p-4 flex flex-col md:flex-row items-center gap-6 border transition-all ${isDisabled(event.id) ? 'border-red-500/30 opacity-60 grayscale' : 'border-white/5'
                                    }`}
                            >
                                <div className="relative">
                                    <img
                                        src={event.flyer_image || '/placeholder-event.jpg'}
                                        alt={event.title}
                                        className="w-24 h-24 rounded-xl object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = '/placeholder-event.jpg';
                                        }}
                                    />
                                    {isFeatured(event.id) && (
                                        <div className="absolute -top-2 -right-2 p-1.5 bg-[#d3da0c] text-black rounded-lg shadow-lg">
                                            <Star className="w-4 h-4 fill-current" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-white font-semibold truncate text-lg">{event.title}</h3>
                                        <ArrowUpRight className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <div className="flex items-center gap-4 text-gray-500 text-xs">
                                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.city}</span>
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(event.start_date).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-3">
                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${event.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                                            event.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                                event.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                                                    'bg-blue-500/10 text-blue-500'
                                            }`}>
                                            {t(`admin.reviewEvents.status.${event.status || 'draft'}`)}
                                        </span>
                                        <span className="text-gray-500 text-[10px] flex items-center gap-1">
                                            {t('admin.reviewEvents.organizedByLabel')} <span className="text-white font-medium">{event.business?.business_name || t('admin.reviewEvents.unknown')}</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 border-l border-white/5 pl-6">
                                    <button
                                        onClick={() => handleFeatureEvent(event.id)}
                                        disabled={actionLoading === `feature-${event.id}`}
                                        className={`p-3 rounded-xl transition-all disabled:opacity-50 ${isFeatured(event.id) ? 'bg-[#d3da0c] text-black shadow-[0_0_15px_rgba(211, 218, 12,0.3)]' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-[#d3da0c]'
                                            }`}
                                        title={t('admin.reviewEvents.featureOnHomepageTitle')}
                                    >
                                        {actionLoading === `feature-${event.id}` ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Star className={`w-5 h-5 ${isFeatured(event.id) ? 'fill-current' : ''}`} />
                                        )}
                                    </button>

                                    <button
                                        onClick={() => handleToggleVisibility(event.id)}
                                        disabled={actionLoading === `visibility-${event.id}`}
                                        className={`p-3 rounded-xl transition-all disabled:opacity-50 ${isDisabled(event.id) ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                                            }`}
                                        title={isDisabled(event.id) ? t('admin.reviewEvents.showEventTitle') : t('admin.reviewEvents.hideEventTitle')}
                                    >
                                        {actionLoading === `visibility-${event.id}` ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            isDisabled(event.id) ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />
                                        )}
                                    </button>

                                    <div className="h-10 w-px bg-white/5 mx-2" />

                                    <div className="flex gap-2">
                                        {event.status !== 'approved' && (
                                            <button
                                                onClick={() => handleApproveEvent(event.id)}
                                                disabled={actionLoading === `approve-${event.id}`}
                                                className="p-3 bg-green-500/10 text-green-500 rounded-xl hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                                title={t('admin.reviewEvents.approveEventTitle')}
                                            >
                                                {actionLoading === `approve-${event.id}` ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="w-5 h-5" />
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleRejectEvent(event.id)}
                                            disabled={actionLoading === `reject-${event.id}` || event.status === 'rejected'}
                                            className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                            title="Reject Event"
                                        >
                                            {actionLoading === `reject-${event.id}` ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <XCircle className="w-5 h-5" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default ReviewEvents;
