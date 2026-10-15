import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ContactRound, Copy, Link2, Send, Share2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { WEB_ORIGIN } from '@/lib/appUrl';
import { API_BASE_URL } from '@/config/api';

const InviteFriends = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const [shared, setShared] = useState(false);
  const [contacts, setContacts] = useState<Array<{ name: string; tel?: string; invited: boolean }>>([]);
  const [pickerSupported] = useState(() => typeof navigator !== 'undefined' && 'contacts' in navigator && typeof (navigator as any).contacts?.select === 'function');

  const inviteUrl = WEB_ORIGIN;
  const shareText = t('kit.invite.shareText');

  const pickContacts = async () => {
    try {
      const props = ['name', 'tel'] as any;
      const opts = { multiple: true } as any;
      const selected: Array<{ name?: string[]; tel?: string[] }> = await (navigator as any).contacts.select(props, opts);
      const mapped = selected.map(c => ({
        name: (c.name && c.name[0]) || c.tel?.[0] || '—',
        tel: c.tel?.[0],
        invited: false,
      }));
      setContacts(mapped);
      if (mapped.length === 0) toast.error(t('kit.invite.shareFailed'));
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        toast.error(t('kit.invite.shareFailed'));
      }
    }
  };

  const inviteContact = async (index: number) => {
    const contact = contacts[index];
    const text = `${shareText}\n${inviteUrl}`;
    try {
      if (contact.tel) {
        // Direct invite channel when we have the number
        window.open(`sms:${contact.tel}?&body=${encodeURIComponent(text)}`, '_blank');
      } else if (navigator.share) {
        await navigator.share({ title: 'Sound It', text, url: inviteUrl });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success(t('kit.invite.linkCopied'));
      }
      setContacts(prev => prev.map((c, i) => i === index ? { ...c, invited: true } : c));
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') toast.error(t('kit.invite.shareFailed'));
    }
  };

  const profileUrl = (() => {
    try {
      const raw = session?.user?.id;
      return raw ? `${WEB_ORIGIN}/profile/${raw}` : inviteUrl;
    } catch {
      return inviteUrl;
    }
  })();

  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Sound It', text: shareText, url: inviteUrl });
        setShared(true);
        setTimeout(() => setShared(false), 3000);
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${inviteUrl}`);
        toast.success(t('kit.invite.linkCopied'));
        setShared(true);
        setTimeout(() => setShared(false), 3000);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        toast.error(t('kit.invite.shareFailed'));
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${inviteUrl}`);
      toast.success(t('kit.invite.linkCopied'));
    } catch {
      toast.error(t('kit.invite.shareFailed'));
    }
  };

  const shareChannels = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: <Send className="w-5 h-5 text-[#d3da0c]" />,
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${inviteUrl}`)}`,
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: <Share2 className="w-5 h-5 text-[#d3da0c]" />,
      href: `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      id: 'x',
      label: 'X',
      icon: <Share2 className="w-5 h-5 text-[#d3da0c]" />,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(inviteUrl)}`,
    },
    {
      id: 'sms',
      label: 'SMS',
      icon: <Link2 className="w-5 h-5 text-[#d3da0c]" />,
      href: `sms:?&body=${encodeURIComponent(`${shareText}\n${inviteUrl}`)}`,
    },
  ];

  return (
    <div className="min-h-screen pb-12">
      <section className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2">
          <button
            onClick={() => navigate('/settings')}
            aria-label={t('kit.common.back')}
            className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-white hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-display text-white">{t('kit.invite.title')}</h1>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center py-6">
          <div className="w-24 h-24 rounded-full bg-[#d3da0c]/10 border border-[#d3da0c]/30 flex items-center justify-center mb-5">
            <Users className="w-10 h-10 text-[#d3da0c]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{t('kit.invite.heading')}</h2>
          <p className="text-gray-400 text-sm max-w-xs">{t('kit.invite.desc')}</p>
        </motion.div>

        {/* Invite button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onClick={handleNativeShare}
          className={`w-full min-h-[52px] rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-colors ${shared ? 'bg-white/10 text-[#d3da0c]' : 'bg-[#d3da0c] text-black hover:bg-[#bbc10b]'}`}
        >
          {shared ? (
            <>
              <Check className="w-5 h-5" />
              {t('kit.invite.invited')}
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              {t('kit.invite.invite')}
            </>
          )}
        </motion.button>

        {/* Invite from device contacts (Contacts Picker API — Android/Chrome) */}
        {pickerSupported && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 }}
            onClick={pickContacts}
            className="w-full min-h-[48px] rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 bg-white/5 text-white hover:bg-white/10 transition-colors"
          >
            <ContactRound className="w-5 h-5 text-[#d3da0c]" />
            {t('kit.invite.fromContacts', 'Invite from contacts')}
          </motion.button>
        )}

        {contacts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden">
            <div className="divide-y divide-white/5">
              {contacts.map((contact, idx) => (
                <div key={idx} className="w-full flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-[#d3da0c]">{(contact.name || '?')[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{contact.name}</p>
                    {contact.tel && <p className="text-xs text-gray-500 truncate">{contact.tel}</p>}
                  </div>
                  <button
                    onClick={() => inviteContact(idx)}
                    disabled={contact.invited}
                    className={`px-4 min-h-[36px] rounded-xl text-xs font-bold transition-colors ${contact.invited ? 'bg-white/10 text-[#d3da0c]' : 'bg-[#d3da0c] text-black hover:bg-[#bbc10b]'}`}
                  >
                    {contact.invited ? t('kit.invite.invited') : t('kit.invite.invite')}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Share via rows */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden"
        >
          <h2 className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('kit.invite.via')}</h2>
          <div className="divide-y divide-white/5">
            {shareChannels.map(channel => (
              <a
                key={channel.id}
                href={channel.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[44px] hover:bg-white/5 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">{channel.icon}</div>
                <span className="text-sm font-medium text-white flex-1">{channel.label}</span>
                <Share2 className="w-4 h-4 text-gray-600" />
              </a>
            ))}
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[44px] hover:bg-white/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Copy className="w-5 h-5 text-[#d3da0c]" />
              </div>
              <span className="text-sm font-medium text-white flex-1">{t('kit.invite.copyLink')}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default InviteFriends;
