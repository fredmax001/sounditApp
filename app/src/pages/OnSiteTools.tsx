import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode,
  ClipboardList,
  LogOut,
  Calendar,
  MapPin,
  ScanLine,
  Loader2,
  AlertCircle,
  CheckCircle,
  Users,
  Ticket,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStaffAuthStore } from '@/store/staffAuthStore';

export default function OnSiteTools() {
  const navigate = useNavigate();
  const { token, staff, event, permissions, isLoading, error, login, logout, canScan, canViewCheckedIn } = useStaffAuthStore();

  const [eventUrl, setEventUrl] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isLoggedIn = !!token && !!staff && !!event;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventUrl.trim() || !emailOrPhone.trim() || !password.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    const success = await login(eventUrl.trim(), emailOrPhone.trim(), password.trim());
    if (success) {
      toast.success(`Welcome, ${useStaffAuthStore.getState().staff?.full_name}!`);
    } else {
      toast.error(useStaffAuthStore.getState().error || 'Login failed');
    }
  };

  const handleLogout = () => {
    logout();
    toast.info('Logged out');
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#d3da0c] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ScanLine className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-2xl font-bold text-white">On Site Tools</h1>
            <p className="text-gray-400 text-sm mt-1">Staff login for event management</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Event Link or ID</label>
              <input
                type="text"
                value={eventUrl}
                onChange={(e) => setEventUrl(e.target.value)}
                placeholder="https://sounditent.com/events/10 or Event ID 10"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-[#d3da0c] focus:outline-none transition-colors"
                required
              />
              <p className="text-gray-600 text-xs mt-1">Paste event URL or enter Event ID (e.g. 10)</p>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Email or Phone</label>
              <input
                type="text"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                placeholder="staff@example.com or +86..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-[#d3da0c] focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password set by your admin"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-[#d3da0c] focus:outline-none transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#d3da0c] text-black rounded-xl font-bold hover:bg-[#c2c80b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Access Event Tools'
              )}
            </button>
          </form>

          <p className="text-center text-gray-600 text-xs mt-6">
            Don't have access? Contact your event admin to create a staff account.
          </p>
        </motion.div>
      </div>
    );
  }

  // Dashboard Screen
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="bg-[#111111] border-b border-white/5 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">On Site Tools</h1>
            <p className="text-gray-500 text-xs">{staff?.full_name} • {staff?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Event Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111111] rounded-2xl border border-white/5 overflow-hidden"
        >
          {event?.flyer_image && (
            <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${event.flyer_image})` }} />
          )}
          <div className="p-4">
            <h2 className="text-white font-bold text-lg">{event?.title}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-400">
              {event?.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-[#d3da0c]" />
                  {new Date(event.start_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {event?.venue && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-[#d3da0c]" />
                  {event.venue}
                </span>
              )}
              {event?.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-[#d3da0c]" />
                  {event.city}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {canScan() && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate('/scan')}
                className="flex items-center gap-4 p-5 bg-[#111111] border border-white/5 rounded-2xl hover:border-[#d3da0c]/30 transition-colors text-left group"
              >
                <div className="w-14 h-14 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center group-hover:bg-[#d3da0c]/20 transition-colors">
                  <QrCode className="w-7 h-7 text-[#d3da0c]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg">QR Scanner</h3>
                  <p className="text-gray-400 text-sm">Scan and validate guest tickets</p>
                </div>
                <ScanLine className="w-6 h-6 text-gray-600 group-hover:text-[#d3da0c] transition-colors" />
              </motion.button>
            )}

            {canViewCheckedIn() && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/on-site-tools/guests?event=${event?.id}`)}
                className="flex items-center gap-4 p-5 bg-[#111111] border border-white/5 rounded-2xl hover:border-[#d3da0c]/30 transition-colors text-left group"
              >
                <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <ClipboardList className="w-7 h-7 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg">Checked-in Guests</h3>
                  <p className="text-gray-400 text-sm">View guest list and check-in status</p>
                </div>
                <Users className="w-6 h-6 text-gray-600 group-hover:text-blue-400 transition-colors" />
              </motion.button>
            )}

            {!canScan() && !canViewCheckedIn() && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 bg-[#111111] border border-white/5 rounded-2xl"
              >
                <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                <h3 className="text-white font-bold">No Permissions</h3>
                <p className="text-gray-400 text-sm mt-1">
                  You don't have any tools assigned. Contact your admin.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111111] border border-white/5 rounded-xl p-4 text-center">
            <Ticket className="w-6 h-6 text-[#d3da0c] mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">—</p>
            <p className="text-gray-500 text-xs">Tickets Scanned</p>
          </div>
          <div className="bg-[#111111] border border-white/5 rounded-xl p-4 text-center">
            <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">—</p>
            <p className="text-gray-500 text-xs">Checked In</p>
          </div>
        </div>
      </div>
    </div>
  );
}
