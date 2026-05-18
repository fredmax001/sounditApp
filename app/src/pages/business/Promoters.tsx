import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Copy, Check, Loader2, Share2, Trash2,
  QrCode, TrendingUp, Eye, DollarSign, X, Download, Calendar, ChevronRight,
  Plus, UserPlus, Megaphone, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { WEB_ORIGIN } from '@/lib/appUrl';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface Event {
  id: string;
  title: string;
  flyer_image?: string;
  start_date?: string;
  promoter_enabled?: boolean;
}

interface EventPromoter {
  id: number;
  event_id: number;
  promoter_id: number;
  referral_code: string;
  commission_rate: number | null;
  discount_percent: number | null;
  status: string;
  clicks: number;
  conversions: number;
  tickets_sold: number;
  revenue_generated: number;
  commission_earned: number;
  promoter_name: string | null;
  promoter_avatar: string | null;
}

interface EventWithPromoters {
  event: Event;
  promoters: EventPromoter[];
  loading: boolean;
}

export default function BusinessPromoters() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');

  const [events, setEvents] = useState<EventWithPromoters[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState<{ code: string; eventId: string; name: string | null } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Create & assign modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [newPromoterUserId, setNewPromoterUserId] = useState('');
  const [newPromoterName, setNewPromoterName] = useState('');
  const [newCommissionRate, setNewCommissionRate] = useState('');
  const [newDiscountPercent, setNewDiscountPercent] = useState('');
  const [creating, setCreating] = useState(false);
  const [enablingEventId, setEnablingEventId] = useState<string | null>(null);

  useEffect(() => {
    fetchEventsWithPromoters();
  }, []);

  const fetchEventsWithPromoters = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/events/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // FIX: /events/me returns an array directly, not { events: [...] }
      const myEvents: Event[] = Array.isArray(data) ? data : (data.events || []);

      const eventsWithPromoters: EventWithPromoters[] = await Promise.all(
        myEvents.map(async (event) => {
          if (!event.promoter_enabled) {
            return { event, promoters: [], loading: false };
          }
          try {
            const pres = await fetch(`${API_BASE_URL}/promoters/events/${event.id}/promoters`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const pdata = await pres.json();
            return { event, promoters: pres.ok ? (pdata || []) : [], loading: false };
          } catch {
            return { event, promoters: [], loading: false };
          }
        })
      );

      setEvents(eventsWithPromoters);
    } catch {
      toast.error(t('business.promoters.loadError') || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const enablePromotersForEvent = async (eventId: string) => {
    setEnablingEventId(eventId);
    try {
      const res = await fetch(`${API_BASE_URL}/promoters/events/${eventId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promoter_enabled: true,
          default_commission_rate: 10,
          default_discount_percent: 5,
          max_discount_amount: null,
        }),
      });
      if (res.ok) {
        toast.success(t('business.promoters.enabled') || 'Promoter program enabled');
        // Refresh to pick up the change
        fetchEventsWithPromoters();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || t('business.promoters.enableError') || 'Failed to enable promoters');
      }
    } catch {
      toast.error(t('business.promoters.enableError') || 'Failed to enable promoters');
    } finally {
      setEnablingEventId(null);
    }
  };

  const createAndAssignPromoter = async () => {
    if (!selectedEventId) {
      toast.error(t('organizer.eventPromoters.selectEvent') || 'Please select an event');
      return;
    }
    if (!newPromoterUserId.trim()) {
      toast.error(t('organizer.eventPromoters.userIdRequired') || 'Please enter a user ID');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/promoters/events/${selectedEventId}/promoters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promoter_user_id: parseInt(newPromoterUserId),
          promoter_name: newPromoterName.trim() || null,
          commission_rate: newCommissionRate ? parseFloat(newCommissionRate) : null,
          discount_percent: newDiscountPercent ? parseFloat(newDiscountPercent) : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('organizer.eventPromoters.promoterAdded') || 'Promoter added');
        setShowCreateModal(false);
        setSelectedEventId('');
        setNewPromoterUserId('');
        setNewPromoterName('');
        setNewCommissionRate('');
        setNewDiscountPercent('');
        fetchEventsWithPromoters();
      } else {
        toast.error(data.detail || t('organizer.eventPromoters.promoterAddError') || 'Failed to add promoter');
      }
    } catch {
      toast.error(t('organizer.eventPromoters.promoterAddError') || 'Failed to add promoter');
    } finally {
      setCreating(false);
    }
  };

  const removePromoter = async (eventId: string, assignmentId: number) => {
    if (!confirm(t('organizer.eventPromoters.removeConfirm') || 'Remove this promoter from the event?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/promoters/events/${eventId}/promoters/${assignmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success(t('organizer.eventPromoters.promoterRemoved') || 'Promoter removed');
        fetchEventsWithPromoters();
      } else {
        toast.error(t('organizer.eventPromoters.promoterRemoveError') || 'Failed to remove promoter');
      }
    } catch {
      toast.error(t('organizer.eventPromoters.promoterRemoveError') || 'Failed to remove promoter');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success(t('organizer.eventPromoters.codeCopied') || 'Code copied');
  };

  const shareUrl = (eventId: string, code: string) => {
    const url = `${WEB_ORIGIN}/events/${eventId}?ref=${code}`;
    navigator.clipboard.writeText(url);
    toast.success(t('organizer.eventPromoters.shareLinkCopied') || 'Share link copied');
  };

  const downloadQr = (code: string, name?: string | null) => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-${code}${name ? '-' + name : ''}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const enabledEvents = events.filter(ep => ep.event.promoter_enabled);
  const disabledEvents = events.filter(ep => !ep.event.promoter_enabled);
  const totalPromoters = enabledEvents.reduce((sum, ep) => sum + ep.promoters.length, 0);
  const totalClicks = enabledEvents.reduce((sum, ep) => sum + ep.promoters.reduce((s, p) => s + (p.clicks || 0), 0), 0);
  const totalSales = enabledEvents.reduce((sum, ep) => sum + ep.promoters.reduce((s, p) => s + (p.tickets_sold || 0), 0), 0);
  const totalRevenue = enabledEvents.reduce((sum, ep) => sum + ep.promoters.reduce((s, p) => s + (p.revenue_generated || 0), 0), 0);

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-6 pb-4 px-4 lg:p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/business')}
            className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
          >
            <ChevronRight className="w-5 h-5 text-gray-400 rotate-180" />
          </button>
          <div>
            <h1 className="text-base lg:text-2xl font-display text-white">{t('business.promoters.title') || 'Promoters & Influencers'}</h1>
            <p className="text-gray-400 text-xs lg:text-sm">{t('business.promoters.subtitle') || 'Create promoters and assign them to your events'}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] flex items-center gap-2 text-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('business.promoters.createPromoter') || 'Create Promoter'}</span>
          <span className="sm:hidden">{t('business.promoters.create') || 'Create'}</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 lg:gap-4 mb-6">
        {[
          { label: t('business.promoters.promoter') || 'Promoters', value: totalPromoters, icon: Users, color: 'text-blue-400' },
          { label: t('business.promoters.clicks') || 'Clicks', value: totalClicks, icon: Eye, color: 'text-purple-400' },
          { label: t('business.promoters.sales') || 'Sales', value: totalSales, icon: TrendingUp, color: 'text-green-400' },
          { label: t('business.promoters.revenue') || 'Revenue', value: `¥${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-[#d3da0c]' },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-[#111111] border border-white/5 rounded-lg p-2 lg:rounded-xl lg:p-4"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`p-1 bg-white/5 rounded ${stat.color}`}>
                <stat.icon className="w-3 h-3 lg:w-4 lg:h-4" />
              </div>
              <span className="text-gray-400 text-[9px] font-medium whitespace-nowrap lg:text-xs">{stat.label}</span>
            </div>
            <p className="text-sm font-bold text-white lg:text-xl">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Events with promoters enabled */}
      <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-[#d3da0c]" />
        {t('business.promoters.activePrograms') || 'Active Promoter Programs'}
      </h2>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#d3da0c] mx-auto" /></div>
      ) : enabledEvents.length === 0 ? (
        <div className="bg-[#111111] border border-white/5 rounded-xl p-8 text-center mb-8">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-bold mb-2">{t('business.promoters.noPrograms') || 'No promoter programs enabled'}</h3>
          <p className="text-gray-400 text-sm mb-4">{t('business.promoters.noProgramsDesc') || 'Enable promoters on your events to start tracking referral sales.'}</p>
        </div>
      ) : (
        <div className="space-y-6 mb-8">
          {enabledEvents.map(({ event, promoters: eventPromoters }) => (
            <div key={event.id} className="bg-[#111111] border border-white/5 rounded-xl p-3 lg:p-5">
              {/* Event header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center shrink-0">
                  {event.flyer_image ? (
                    <img src={event.flyer_image} alt={event.title} className="w-full h-full object-cover" />
                  ) : (
                    <Calendar className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-semibold text-sm truncate">{event.title}</h3>
                  <p className="text-gray-400 text-[10px] truncate">
                    {event.start_date ? new Date(event.start_date).toLocaleDateString() : 'No date'}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/dashboard/business/events/${event.id}/promoters`)}
                  className="text-[#d3da0c] text-xs font-bold hover:underline shrink-0"
                >
                  {t('business.promoters.manage') || 'Manage'} →
                </button>
              </div>

              {/* Promoters table */}
              {eventPromoters.length === 0 ? (
                <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">{t('business.promoters.noPromotersAssigned') || 'No promoters assigned yet'}</p>
                  <button
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setShowCreateModal(true);
                    }}
                    className="text-xs text-[#d3da0c] font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> {t('business.promoters.add') || 'Add'}
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-gray-500 text-[10px] uppercase border-b border-white/5">
                        <th className="text-left py-2 px-1">{t('business.promoters.promoter') || 'Promoter'}</th>
                        <th className="text-left py-2 px-1">{t('business.promoters.code') || 'Code'}</th>
                        <th className="text-right py-2 px-1">{t('business.promoters.clicks') || 'Clicks'}</th>
                        <th className="text-right py-2 px-1">{t('business.promoters.sales') || 'Sales'}</th>
                        <th className="text-right py-2 px-1">{t('business.promoters.revenue') || 'Revenue'}</th>
                        <th className="text-right py-2 px-1">{t('business.promoters.actions') || 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventPromoters.map((promoter) => (
                        <tr key={promoter.id} className="border-b border-white/5 text-xs">
                          <td className="py-2 px-1">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-gray-400">
                                {promoter.promoter_name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <span className="text-white truncate max-w-[80px] lg:max-w-[140px]">{promoter.promoter_name || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="py-2 px-1">
                            <span className="font-mono text-[#d3da0c] text-[10px]">{promoter.referral_code}</span>
                          </td>
                          <td className="py-2 px-1 text-right text-gray-400">{promoter.clicks || 0}</td>
                          <td className="py-2 px-1 text-right text-white font-medium">{promoter.tickets_sold || 0}</td>
                          <td className="py-2 px-1 text-right text-white font-medium">¥{(promoter.revenue_generated || 0).toLocaleString()}</td>
                          <td className="py-2 px-1">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => copyCode(promoter.referral_code)}
                                className="p-1 bg-white/5 rounded hover:bg-white/10"
                                title={t('business.promoters.copyCode') || 'Copy code'}
                              >
                                {copiedCode === promoter.referral_code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
                              </button>
                              <button
                                onClick={() => shareUrl(String(event.id), promoter.referral_code)}
                                className="p-1 bg-white/5 rounded hover:bg-white/10"
                                title={t('business.promoters.copyLink') || 'Copy link'}
                              >
                                <Share2 className="w-3 h-3 text-gray-400" />
                              </button>
                              <button
                                onClick={() => setShowQrModal({ code: promoter.referral_code, eventId: String(event.id), name: promoter.promoter_name })}
                                className="p-1 bg-white/5 rounded hover:bg-white/10"
                                title={t('business.promoters.showQr') || 'Show QR'}
                              >
                                <QrCode className="w-3 h-3 text-gray-400" />
                              </button>
                              <button
                                onClick={() => removePromoter(String(event.id), promoter.id)}
                                className="p-1 bg-white/5 rounded hover:bg-red-500/20"
                                title={t('business.promoters.remove') || 'Remove'}
                              >
                                <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Events without promoters enabled */}
      {disabledEvents.length > 0 && (
        <>
          <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            {t('business.promoters.otherEvents') || 'Other Events'}
          </h2>
          <div className="space-y-3">
            {disabledEvents.map(({ event }) => (
              <div key={event.id} className="bg-[#111111] border border-white/5 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center shrink-0">
                  {event.flyer_image ? (
                    <img src={event.flyer_image} alt={event.title} className="w-full h-full object-cover" />
                  ) : (
                    <Calendar className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-semibold text-sm truncate">{event.title}</h3>
                  <p className="text-gray-400 text-[10px] truncate">
                    {event.start_date ? new Date(event.start_date).toLocaleDateString() : 'No date'}
                  </p>
                </div>
                <button
                  onClick={() => enablePromotersForEvent(event.id)}
                  disabled={enablingEventId === event.id}
                  className="px-3 py-1.5 bg-white/5 text-white text-xs font-bold rounded-lg hover:bg-[#d3da0c] hover:text-black transition-all disabled:opacity-50 flex items-center gap-1 shrink-0"
                >
                  {enablingEventId === event.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Megaphone className="w-3 h-3" />
                  )}
                  {t('business.promoters.enable') || 'Enable'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowQrModal(null)}>
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">{t('business.promoters.referralQr') || 'Referral QR'}</h3>
              <button onClick={() => setShowQrModal(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div ref={qrRef} className="bg-white p-4 rounded-xl flex items-center justify-center">
              <QRCodeSVG value={`${WEB_ORIGIN}/events/${showQrModal.eventId}?ref=${showQrModal.code}`} size={200} />
            </div>
            <p className="text-gray-400 text-xs text-center mt-3">{showQrModal.name || 'Promoter'} — {showQrModal.code}</p>
            <button
              onClick={() => downloadQr(showQrModal.code, showQrModal.name)}
              className="w-full mt-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download QR
            </button>
          </div>
        </div>
      )}

      {/* Create & Assign Promoter Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111111] border border-white/10 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#d3da0c]" />
                  {t('business.promoters.createPromoter') || 'Create & Assign Promoter'}
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Event selector */}
                <div>
                  <label className="text-gray-400 text-xs block mb-1.5">{t('business.promoters.selectEvent') || 'Select Event'}</label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                  >
                    <option value="" className="bg-[#111111]">— {t('business.promoters.chooseEvent') || 'Choose an event'} —</option>
                    {events.map(({ event }) => (
                      <option key={event.id} value={event.id} className="bg-[#111111]">
                        {event.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* User ID */}
                <div>
                  <label className="text-gray-400 text-xs block mb-1.5">{t('organizer.eventPromoters.userId') || 'User ID'}</label>
                  <input
                    type="number"
                    value={newPromoterUserId}
                    onChange={(e) => setNewPromoterUserId(e.target.value)}
                    placeholder={t('organizer.eventPromoters.userIdPlaceholder') || 'Enter user ID number'}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                  />
                  <p className="text-gray-500 text-[10px] mt-1">{t('business.promoters.userIdHelp') || 'The user must already have an account on the platform.'}</p>
                </div>

                {/* Promoter name */}
                <div>
                  <label className="text-gray-400 text-xs block mb-1.5">
                    {t('business.promoters.promoterName') || 'Promoter Name'}
                    <span className="text-gray-600 ml-1">({t('organizer.eventPromoters.optional') || 'Optional'})</span>
                  </label>
                  <input
                    type="text"
                    value={newPromoterName}
                    onChange={(e) => setNewPromoterName(e.target.value)}
                    placeholder={t('business.promoters.promoterNamePlaceholder') || 'e.g. DJ Fred Max'}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                  />
                </div>

                {/* Commission & Discount */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1.5">{t('organizer.eventPromoters.customCommission') || 'Commission (%)'}</label>
                    <input
                      type="number"
                      value={newCommissionRate}
                      onChange={(e) => setNewCommissionRate(e.target.value)}
                      placeholder={t('organizer.eventPromoters.customCommissionPlaceholder') || 'Default'}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1.5">{t('organizer.eventPromoters.customDiscount') || 'Discount (%)'}</label>
                    <input
                      type="number"
                      value={newDiscountPercent}
                      onChange={(e) => setNewDiscountPercent(e.target.value)}
                      placeholder={t('organizer.eventPromoters.customDiscountPlaceholder') || 'Default'}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-white/5 text-white rounded-lg text-sm font-bold hover:bg-white/10"
                >
                  {t('organizer.eventPromoters.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={createAndAssignPromoter}
                  disabled={creating || !selectedEventId || !newPromoterUserId}
                  className="flex-1 py-2.5 bg-[#d3da0c] text-black rounded-lg text-sm font-bold hover:bg-[#bbc10b] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('business.promoters.assign') || 'Assign Promoter'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
