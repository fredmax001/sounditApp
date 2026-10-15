import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Eye, EyeOff, KeyRound, Loader2, Lock, ScanLine, ShieldCheck, Trash2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

type Modal =
  | { kind: 'password' }
  | { kind: 'delete' }
  | { kind: '2fa-setup'; secret: string; otpauthUrl: string }
  | { kind: '2fa-disable' }
  | { kind: 'pin-set' }
  | { kind: 'pin-change' }
  | { kind: 'pin-disable' }
  | null;

const SecuritySettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, logout } = useAuthStore();

  const [modal, setModal] = useState<Modal>(null);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [code, setCode] = useState('');
  const [pinForm, setPinForm] = useState({ password: '', currentPin: '', newPin: '', confirmPin: '' });
  const [showPins, setShowPins] = useState(false);

  const token = () => session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');

  const api = async (path: string, body?: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || data?.detail || `HTTP ${res.status}`);
    return data;
  };

  useEffect(() => {
    (async () => {
      try {
        const [fa, pin] = await Promise.all([api('/auth/2fa/status'), api('/auth/pin/status')]);
        setTwoFaEnabled(!!fa.enabled);
        setPinEnabled(!!pin.enabled);
      } catch { /* leave defaults */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open2faSetup = async () => {
    setIsSaving(true);
    try {
      const data = await api('/auth/2fa/setup', {});
      setCode('');
      setModal({ kind: '2fa-setup', secret: data.secret, otpauthUrl: data.otpauth_url });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const enable2fa = async () => {
    setIsSaving(true);
    try {
      await api('/auth/2fa/enable', { code: code.trim() });
      setTwoFaEnabled(true);
      setModal(null);
      toast.success(t('kit.security.enabledMsg'));
    } catch (e) {
      toast.error((e as Error).message || t('kit.security.wrongCode'));
    } finally {
      setIsSaving(false);
    }
  };

  const disable2fa = async () => {
    setIsSaving(true);
    try {
      await api('/auth/2fa/disable', { code: code.trim() });
      setTwoFaEnabled(false);
      setModal(null);
      toast.success(t('kit.security.disabledMsg'));
    } catch (e) {
      toast.error((e as Error).message || t('kit.security.wrongCode'));
    } finally {
      setIsSaving(false);
    }
  };

  const validatePin = (p: string) => /^\d{4,8}$/.test(p);

  const submitPin = async (kind: 'pin-set' | 'pin-change' | 'pin-disable') => {
    if (kind === 'pin-set') {
      if (!validatePin(pinForm.newPin)) return toast.error(t('kit.security.pinInvalid'));
      if (pinForm.newPin !== pinForm.confirmPin) return toast.error(t('kit.security.pinMismatch'));
    }
    if (kind === 'pin-change') {
      if (!validatePin(pinForm.newPin)) return toast.error(t('kit.security.pinInvalid'));
      if (pinForm.newPin !== pinForm.confirmPin) return toast.error(t('kit.security.pinMismatch'));
    }
    setIsSaving(true);
    try {
      if (kind === 'pin-set') {
        await api('/auth/pin/set', { pin: pinForm.newPin, password: pinForm.password });
        setPinEnabled(true);
        toast.success(t('kit.security.pinSetOk'));
      } else if (kind === 'pin-change') {
        await api('/auth/pin/change', { current_pin: pinForm.currentPin, new_pin: pinForm.newPin });
        toast.success(t('kit.security.pinChanged'));
      } else {
        await api('/auth/pin/disable', { pin: pinForm.currentPin });
        setPinEnabled(false);
        toast.success(t('kit.security.pinDisabledMsg'));
      }
      setModal(null);
      setPinForm({ password: '', currentPin: '', newPin: '', confirmPin: '' });
    } catch (e) {
      toast.error((e as Error).message || t('kit.security.pinWrong'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const tk = token();
    if (!tk) return toast.error(t('user.favorites.youMustBeLoggedIn'));
    if (passwordData.newPassword !== passwordData.confirmPassword) return toast.error(t('settings.passwordsDoNotMatch', 'New passwords do not match'));
    if (passwordData.newPassword.length < 8) return toast.error(t('settings.passwordTooShort', 'Password must be at least 8 characters'));
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ current_password: passwordData.currentPassword, new_password: passwordData.newPassword })
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error?.error?.message || error?.detail || 'Failed');
      }
      toast.success(t('settings.passwordChanged', 'Password changed successfully'));
      setModal(null);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return toast.error(t('kit.security.deleteConfirmLabel'));
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error?.error?.message || 'Failed');
      }
      toast.success(t('kit.security.deleted'));
      logout();
      navigate('/');
    } catch (e) {
      toast.error((e as Error).message || t('kit.security.deleteFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const passwordInput = (key: 'currentPassword' | 'newPassword' | 'confirmPassword', showKey: 'current' | 'new' | 'confirm', placeholder: string) => (
    <div className="relative">
      <input
        type={showPasswords[showKey] ? 'text' : 'password'}
        value={passwordData[key]}
        onChange={e => setPasswordData(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none pr-10"
      />
      <button onClick={() => setShowPasswords(prev => ({ ...prev, [showKey]: !prev[showKey] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white" aria-label={placeholder}>
        {showPasswords[showKey] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );

  const pinInput = (key: 'password' | 'currentPin' | 'newPin' | 'confirmPin', placeholder: string, numeric = false) => (
    <input
      type={showPins ? 'text' : 'password'}
      inputMode={numeric ? 'numeric' : undefined}
      pattern={numeric ? '[0-9]*' : undefined}
      value={pinForm[key]}
      onChange={e => setPinForm(prev => ({ ...prev, [key]: numeric ? e.target.value.replace(/\D/g, '') : e.target.value }))}
      placeholder={placeholder}
      className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
    />
  );

  const ModalShell = ({ children, danger }: { children: React.ReactNode; danger?: boolean }) => createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4" onClick={() => setModal(null)}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className={`bg-[#111111] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md border-t sm:border max-h-[85vh] overflow-y-auto ${danger ? 'border-red-500/20' : 'border-white/10'}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>,
    document.body);

  const StatusBadge = ({ enabled }: { enabled: boolean }) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${enabled ? 'bg-[#d3da0c]/15 text-[#d3da0c] border border-[#d3da0c]/30' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
      {enabled ? t('kit.security.statusEnabled') : t('kit.security.statusDisabled')}
    </span>
  );

  return (
    <div className="min-h-screen pb-12">
      <section className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2">
          <button onClick={() => navigate('/settings')} aria-label={t('kit.common.back')} className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-white hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-display text-white">{t('kit.security.title')}</h1>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* Two-Factor Auth */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{t('kit.security.twoFactor')}</p>
                <StatusBadge enabled={twoFaEnabled} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{t('kit.security.twoFactorDesc')}</p>
            </div>
            <button
              onClick={() => { setCode(''); twoFaEnabled ? setModal({ kind: '2fa-disable' }) : open2faSetup(); }}
              disabled={isSaving}
              className={`px-4 min-h-[40px] rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${twoFaEnabled ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20' : 'bg-[#d3da0c] text-black hover:bg-[#bbc10b]'}`}
            >
              {twoFaEnabled ? t('kit.security.disable') : t('kit.security.enable')}
            </button>
          </div>
        </motion.div>

        {/* Quick Login PIN */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="bg-[#111111] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{t('kit.security.pin')}</p>
                <StatusBadge enabled={pinEnabled} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{t('kit.security.pinDesc')}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setPinForm({ password: '', currentPin: '', newPin: '', confirmPin: '' }); setShowPins(false); setModal({ kind: pinEnabled ? 'pin-change' : 'pin-set' }); }}
                className="px-4 min-h-[40px] rounded-xl bg-[#d3da0c] text-black text-xs font-bold hover:bg-[#bbc10b] transition-colors"
              >
                {pinEnabled ? t('kit.security.pinChangeTitle') : t('kit.security.pinSetTitle')}
              </button>
              {pinEnabled && (
                <button
                  onClick={() => { setPinForm({ password: '', currentPin: '', newPin: '', confirmPin: '' }); setModal({ kind: 'pin-disable' }); }}
                  className="px-3 min-h-[40px] rounded-xl bg-red-500/10 text-red-400 text-xs font-semibold border border-red-500/30 hover:bg-red-500/20 transition-colors"
                >
                  {t('kit.security.disable')}
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Change password */}
        <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} onClick={() => setModal({ kind: 'password' })} className="w-full flex items-center gap-3 bg-[#111111] border border-white/5 rounded-2xl p-4 text-left active:border-[#d3da0c]/30 transition-colors min-h-[44px]">
          <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[#d3da0c]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{t('kit.security.changePassword')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('kit.security.changePasswordDesc')}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
        </motion.button>

        {/* Delete account */}
        <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }} onClick={() => setModal({ kind: 'delete' })} className="w-full flex items-center gap-3 bg-[#111111] border border-red-500/15 rounded-2xl p-4 text-left active:border-red-500/30 transition-colors min-h-[44px]">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-400">{t('kit.security.deleteAccount')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('kit.security.deleteAccountDesc')}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-red-500/60 shrink-0" />
        </motion.button>
      </div>

      {/* Password modal */}
      {modal?.kind === 'password' && (
        <ModalShell>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-white">{t('kit.security.changePassword')}</h3>
            <button onClick={() => setModal(null)} className="p-1.5 bg-white/5 rounded-full text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            {passwordInput('currentPassword', 'current', t('settings.currentPassword', 'Current Password'))}
            {passwordInput('newPassword', 'new', t('settings.newPassword', 'New Password'))}
            {passwordInput('confirmPassword', 'confirm', t('settings.confirmPassword', 'Confirm New Password'))}
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setModal(null)} className="flex-1 min-h-[44px] bg-white/5 text-white text-sm rounded-xl hover:bg-white/10 transition-colors">{t('kit.common.cancel')}</button>
            <button onClick={handleChangePassword} disabled={isSaving || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword} className="flex-1 min-h-[44px] bg-[#d3da0c] text-black text-sm font-semibold rounded-xl hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('kit.security.changePassword')}
            </button>
          </div>
        </ModalShell>
      )}

      {/* 2FA setup modal */}
      {modal?.kind === '2fa-setup' && (
        <ModalShell>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">{t('kit.security.setupTitle')}</h3>
            <button onClick={() => setModal(null)} className="p-1.5 bg-white/5 rounded-full text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm text-gray-400 mb-4">{t('kit.security.setupDesc')}</p>
          <div className="bg-white rounded-2xl p-4 w-fit mx-auto mb-3">
            <QRCodeSVG value={modal.otpauthUrl} size={180} level="M" />
          </div>
          <p className="text-center text-[11px] text-gray-500 font-mono break-all mb-4">{modal.secret}</p>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('kit.security.codeLabel')}
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center text-lg tracking-[0.5em] placeholder-gray-600 placeholder:text-sm placeholder:tracking-normal focus:border-[#d3da0c] focus:outline-none mb-4"
          />
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="flex-1 min-h-[44px] bg-white/5 text-white text-sm rounded-xl hover:bg-white/10 transition-colors">{t('kit.common.cancel')}</button>
            <button onClick={enable2fa} disabled={isSaving || code.length !== 6} className="flex-1 min-h-[44px] bg-[#d3da0c] text-black text-sm font-bold rounded-xl hover:bg-[#bbc10b] transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('kit.security.enable')}
            </button>
          </div>
        </ModalShell>
      )}

      {/* 2FA disable modal */}
      {modal?.kind === '2fa-disable' && (
        <ModalShell danger>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">{t('kit.security.disableTitle')}</h3>
            <button onClick={() => setModal(null)} className="p-1.5 bg-white/5 rounded-full text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm text-gray-400 mb-4">{t('kit.security.disableDesc')}</p>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('kit.security.codeLabel')}
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center text-lg tracking-[0.5em] placeholder-gray-600 placeholder:text-sm placeholder:tracking-normal focus:border-[#d3da0c] focus:outline-none mb-4"
          />
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="flex-1 min-h-[44px] bg-white/5 text-white text-sm rounded-xl hover:bg-white/10 transition-colors">{t('kit.common.cancel')}</button>
            <button onClick={disable2fa} disabled={isSaving || code.length !== 6} className="flex-1 min-h-[44px] bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('kit.security.disable')}
            </button>
          </div>
        </ModalShell>
      )}

      {/* PIN set/change/disable modals */}
      {(modal?.kind === 'pin-set' || modal?.kind === 'pin-change' || modal?.kind === 'pin-disable') && (
        <ModalShell danger={modal.kind === 'pin-disable'}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">
              {modal.kind === 'pin-set' ? t('kit.security.pinSetTitle') : modal.kind === 'pin-change' ? t('kit.security.pinChangeTitle') : t('kit.security.pinDisableTitle')}
            </h3>
            <button onClick={() => setModal(null)} className="p-1.5 bg-white/5 rounded-full text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <div className="space-y-3">
            {modal.kind === 'pin-set' && pinInput('password', t('kit.security.password'))}
            {modal.kind !== 'pin-set' && pinInput('currentPin', t('kit.security.pinCurrent'), true)}
            {modal.kind !== 'pin-disable' && (
              <>
                {pinInput('newPin', t('kit.security.pinNew'), true)}
                {pinInput('confirmPin', t('kit.security.pinConfirm'), true)}
              </>
            )}
          </div>

          <label className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <input type="checkbox" checked={showPins} onChange={e => setShowPins(e.target.checked)} className="accent-[#d3da0c]" />
            <span className="flex items-center gap-1"><ScanLine className="w-3.5 h-3.5" />{t('settings.showPasswords', 'Show')}</span>
          </label>

          <div className="flex gap-3 mt-4">
            <button onClick={() => setModal(null)} className="flex-1 min-h-[44px] bg-white/5 text-white text-sm rounded-xl hover:bg-white/10 transition-colors">{t('kit.common.cancel')}</button>
            <button
              onClick={() => submitPin(modal.kind as 'pin-set' | 'pin-change' | 'pin-disable')}
              disabled={isSaving}
              className={`flex-1 min-h-[44px] text-sm font-bold rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 ${modal.kind === 'pin-disable' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[#d3da0c] text-black hover:bg-[#bbc10b]'}`}
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {modal.kind === 'pin-disable' ? t('kit.security.disable') : modal.kind === 'pin-change' ? t('kit.security.pinChangeTitle') : t('kit.security.pinSetTitle')}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Delete account modal */}
      {modal?.kind === 'delete' && (
        <ModalShell danger>
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-white text-center mb-1">{t('kit.security.deleteConfirmTitle')}</h3>
          <p className="text-gray-400 text-sm text-center mb-4">{t('kit.security.deleteConfirmDesc')}</p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:border-red-500 focus:outline-none mb-4"
          />
          <div className="flex gap-3">
            <button onClick={() => setModal(null)} className="flex-1 min-h-[44px] bg-white/5 text-white text-sm rounded-xl hover:bg-white/10 transition-colors">{t('kit.common.cancel')}</button>
            <button onClick={handleDeleteAccount} disabled={isSaving || deleteConfirmText !== 'DELETE'} className="flex-1 min-h-[44px] bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('kit.security.deleteAccount')}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

export default SecuritySettings;
