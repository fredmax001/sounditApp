import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Users, Mail, Bell, AlertCircle, Loader2, Sparkles, MapPin, Clock, Info, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

interface BroadcastEventItem {
  id: string | number;
  title: string;
  city?: string;
  start_date?: string;
}

interface BroadcastAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: number | string | null;
  eventTitle?: string | null;
}

export default function BroadcastAnnouncementModal({
  isOpen,
  onClose,
  eventId,
  eventTitle
}: BroadcastAnnouncementModalProps) {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  
  const [selectedEventId, setSelectedEventId] = useState<string>(
    eventId ? String(eventId) : ''
  );
  const [myEvents, setMyEvents] = useState<BroadcastEventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  const [target, setTarget] = useState<'event_attendees' | 'followers' | 'both'>(
    eventId ? 'event_attendees' : 'followers'
  );
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendInApp, setSendInApp] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);

  const token = session?.access_token;

  // Sync selectedEventId if eventId prop changes
  useEffect(() => {
    if (eventId) {
      setSelectedEventId(String(eventId));
      setTarget('event_attendees');
    }
  }, [eventId]);

  // Fetch organizer's events for dropdown selection
  useEffect(() => {
    if (!isOpen || !token) return;

    const fetchEventsList = async () => {
      setIsLoadingEvents(true);
      try {
        const res = await fetch(`${API_BASE_URL}/events/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.events || []);
          setMyEvents(list);
          // If no eventId was passed but we have events, pre-select the first event
          if (!eventId && list.length > 0 && !selectedEventId) {
            setSelectedEventId(String(list[0].id));
            setTarget('event_attendees');
          }
        }
      } catch (err) {
        console.error('Failed to fetch organizer events', err);
      } finally {
        setIsLoadingEvents(false);
      }
    };

    fetchEventsList();
  }, [isOpen, token, eventId]);

  // Fetch recipient estimate count when target or selectedEventId changes
  useEffect(() => {
    if (!isOpen || !token) return;

    const fetchRecipientCount = async () => {
      setIsLoadingCount(true);
      try {
        const params = new URLSearchParams({
          target,
          ...(selectedEventId ? { event_id: selectedEventId } : {})
        });
        const res = await fetch(`${API_BASE_URL}/notifications/broadcast/recipient-count?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setRecipientCount(data.total_estimated_recipients ?? 0);
        } else {
          setRecipientCount(0);
        }
      } catch (err) {
        console.error('Failed to fetch recipient count', err);
        setRecipientCount(null);
      } finally {
        setIsLoadingCount(false);
      }
    };

    fetchRecipientCount();
  }, [isOpen, target, selectedEventId, token]);

  if (!isOpen) return null;

  // Active event object
  const activeEvent = myEvents.find((e) => String(e.id) === selectedEventId);
  const activeEventTitle = activeEvent?.title || eventTitle || 'Event';

  // Preset templates for quick filling
  const applyPreset = (type: 'venue' | 'time' | 'notice') => {
    if (type === 'venue') {
      setTitle(t('organizer.broadcast.presetVenueTitle', { event: activeEventTitle }) || `Venue Location Update — ${activeEventTitle}`);
      setMessage(t('organizer.broadcast.presetVenueMessage', 'Dear Attendees,\n\nPlease note that the venue location for our upcoming event has been updated.\n\nNew Venue: [Insert New Venue Name & Address]\nDate & Time: [Confirm Date/Time]\n\nWe look forward to seeing you there!') || '');
    } else if (type === 'time') {
      setTitle(t('organizer.broadcast.presetTimeTitle', { event: activeEventTitle }) || `Schedule Update — ${activeEventTitle}`);
      setMessage(t('organizer.broadcast.presetTimeMessage', 'Dear Attendees,\n\nPlease note an important schedule update for our event.\n\nNew Doors Open Time: [Insert Time]\nMain Performance: [Insert Time]\n\nPlease adjust your arrival plans accordingly.') || '');
    } else if (type === 'notice') {
      setTitle(t('organizer.broadcast.presetNoticeTitle', { event: activeEventTitle }) || `Important Notice — ${activeEventTitle}`);
      setMessage(t('organizer.broadcast.presetNoticeMessage', 'Dear Guests,\n\nWe have an important announcement regarding our upcoming experience.\n\n[Insert Announcement Details]\n\nThank you for your support!') || '');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('Authentication required');
      return;
    }
    if (target !== 'followers' && !selectedEventId) {
      toast.error(t('organizer.broadcast.errorSelectEvent', 'Please select an event to target ticket holders'));
      return;
    }
    if (!title.trim()) {
      toast.error(t('organizer.broadcast.errorMissingTitle', 'Please enter an announcement title'));
      return;
    }
    if (!message.trim()) {
      toast.error(t('organizer.broadcast.errorMissingMessage', 'Please enter message content'));
      return;
    }
    if (!sendEmail && !sendInApp) {
      toast.error(t('organizer.broadcast.errorMissingChannel', 'Please select at least one delivery channel (Email or In-App)'));
      return;
    }

    setIsSending(true);
    try {
      const payload = {
        event_id: selectedEventId ? Number(selectedEventId) : null,
        target,
        title: title.trim(),
        message: message.trim(),
        send_email: sendEmail,
        send_push: sendInApp,
        send_in_app: sendInApp
      };

      const res = await fetch(`${API_BASE_URL}/notifications/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(
          t('organizer.broadcast.successToast', {
            count: data.recipients_count || 0
          }) || `Broadcast sent successfully to ${data.recipients_count || 0} recipients!`
        );
        onClose();
        setTitle('');
        setMessage('');
      } else {
        toast.error(data.detail || data.message || t('organizer.broadcast.failedToast', 'Failed to send broadcast'));
      }
    } catch (err: any) {
      console.error('Broadcast error:', err);
      const errMsg = err.message || t('organizer.broadcast.failedToast', 'Failed to send broadcast');
      toast.error(errMsg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-xl bg-[#121212] border border-white/10 rounded-2xl p-6 shadow-2xl my-8 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-[#d3da0c]/15 text-[#d3da0c] rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </span>
                <h3 className="text-xl font-bold text-white">
                  {t('organizer.broadcast.modalTitle', 'Broadcast Announcement')}
                </h3>
              </div>
              <p className="text-sm text-gray-400">
                {selectedEventId && activeEvent
                  ? `Notify ticket holders & attendees for ${activeEvent.title}`
                  : t('organizer.broadcast.modalSubtitleGeneral', 'Notify your attendees & followers via Email & App')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSend} className="mt-5 space-y-5">
            {/* Event Selector Dropdown */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center justify-between">
                <span>{t('organizer.broadcast.selectEventLabel', 'Select Event to Target')}</span>
                {isLoadingEvents && (
                  <span className="flex items-center gap-1 text-[#d3da0c] text-[11px]">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading events...
                  </span>
                )}
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedEventId(newId);
                  if (newId && target === 'followers') {
                    setTarget('event_attendees');
                  }
                }}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#d3da0c] transition-colors text-sm"
              >
                <option value="" className="bg-[#181818] text-gray-400">
                  🌐 General Broadcast (All Profile Followers)
                </option>
                {myEvents.map((ev) => (
                  <option key={ev.id} value={String(ev.id)} className="bg-[#181818] text-white">
                    🎟️ {ev.title} {ev.city ? `(${ev.city})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                {t('organizer.broadcast.targetAudienceLabel', 'Target Audience')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedEventId) {
                      toast.info(t('organizer.broadcast.selectEventPrompt', 'Please select an event above to target ticket holders'));
                      return;
                    }
                    setTarget('event_attendees');
                  }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                    target === 'event_attendees'
                      ? 'bg-[#d3da0c]/20 border-[#d3da0c] text-[#d3da0c]'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  } ${!selectedEventId ? 'opacity-60 cursor-pointer' : ''}`}
                >
                  <Users className="w-4 h-4" />
                  {t('organizer.broadcast.targetAttendees', 'Ticket Holders')}
                </button>

                <button
                  type="button"
                  onClick={() => setTarget('followers')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                    target === 'followers'
                      ? 'bg-[#d3da0c]/20 border-[#d3da0c] text-[#d3da0c]'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {t('organizer.broadcast.targetFollowers', 'Profile Followers')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedEventId) {
                      toast.info(t('organizer.broadcast.selectEventPrompt', 'Please select an event above to include ticket holders'));
                      return;
                    }
                    setTarget('both');
                  }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all ${
                    target === 'both'
                      ? 'bg-[#d3da0c]/20 border-[#d3da0c] text-[#d3da0c]'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  } ${!selectedEventId ? 'opacity-60 cursor-pointer' : ''}`}
                >
                  <Sparkles className="w-4 h-4" />
                  {t('organizer.broadcast.targetBoth', 'Holders & Followers')}
                </button>
              </div>

              {/* Recipient estimate badge */}
              <div className="mt-2.5 flex items-center gap-2 text-xs text-gray-400 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5">
                <Info className="w-3.5 h-3.5 text-[#d3da0c]" />
                {isLoadingCount ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-[#d3da0c]" />
                    {t('organizer.broadcast.calculatingRecipients', 'Estimating recipients...')}
                  </span>
                ) : (
                  <span>
                    {t('organizer.broadcast.estimatedRecipients', {
                      count: recipientCount !== null ? recipientCount : 0
                    }) || `Estimated Recipients: ${recipientCount !== null ? recipientCount : 0} users`}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Presets */}
            {selectedEventId && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  {t('organizer.broadcast.quickPresetsLabel', 'Quick Presets')}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset('venue')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-yellow-400" />
                    {t('organizer.broadcast.presetVenueBtn', 'Venue Change')}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('time')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    {t('organizer.broadcast.presetTimeBtn', 'Time Update')}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('notice')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    {t('organizer.broadcast.presetNoticeBtn', 'General Notice')}
                  </button>
                </div>
              </div>
            )}

            {/* Title / Subject */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                {t('organizer.broadcast.titleLabel', 'Announcement Title / Subject')} *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('organizer.broadcast.titlePlaceholder', 'e.g. Venue Location Update for The Tour') || ''}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c] transition-colors"
                maxLength={200}
                required
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                {t('organizer.broadcast.messageLabel', 'Message Content')} *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder={t('organizer.broadcast.messagePlaceholder', 'Write your message here... Include all important details like new address, dates, or entrance instructions.') || ''}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c] transition-colors resize-none text-sm"
                maxLength={5000}
                required
              />
              <div className="text-right text-[11px] text-gray-500 mt-1">
                {message.length} / 5000
              </div>
            </div>

            {/* Delivery Channels */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                {t('organizer.broadcast.channelsLabel', 'Delivery Channels')}
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#d3da0c] focus:ring-0 focus:ring-offset-0"
                  />
                  <Mail className="w-4 h-4 text-blue-400" />
                  {t('organizer.broadcast.channelEmail', 'Email Broadcast')}
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={sendInApp}
                    onChange={(e) => setSendInApp(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#d3da0c] focus:ring-0 focus:ring-offset-0"
                  />
                  <Bell className="w-4 h-4 text-amber-400" />
                  {t('organizer.broadcast.channelInApp', 'In-App & Push')}
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 font-medium text-sm hover:bg-white/5 transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>

              <button
                type="submit"
                disabled={isSending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#d3da0c] text-black font-semibold text-sm hover:bg-[#c2c80b] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#d3da0c]/20"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('organizer.broadcast.sendingBtn', 'Sending Broadcast...')}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t('organizer.broadcast.sendBtn', 'Send Broadcast')}
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
