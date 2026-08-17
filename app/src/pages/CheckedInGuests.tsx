import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, User, Search, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useStaffAuthStore } from '@/store/staffAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

interface CheckedInGuest {
  id: string;
  ticket_number: string;
  user_name: string;
  tier_name: string;
  checked_in_at: string;
  status: 'checked_in' | 'not_checked_in';
}

export default function CheckedInGuests() {
  const { token, event, canViewCheckedIn } = useStaffAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [guests, setGuests] = useState<CheckedInGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!token || !event) return;
    if (!canViewCheckedIn()) {
      toast.error('You do not have permission to view checked-in guests');
      return;
    }

    const fetchGuests = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/payments/tickets?event_id=${event.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load guests');
        const data = await res.json();
        // Map to our format
        const mapped: CheckedInGuest[] = (data.tickets || []).map((t: any) => ({
          id: String(t.id),
          ticket_number: t.ticket_number || t.code || '—',
          user_name: t.user_name || t.holder_name || 'Guest',
          tier_name: t.tier_name || t.tier || 'General',
          checked_in_at: t.checked_in_at,
          status: t.checked_in_at ? 'checked_in' : 'not_checked_in',
        }));
        setGuests(mapped);
      } catch {
        toast.error('Failed to load guest list');
      } finally {
        setLoading(false);
      }
    };

    fetchGuests();
  }, [token, event, canViewCheckedIn]);

  const filtered = guests.filter(
    (g) =>
      g.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      g.user_name.toLowerCase().includes(search.toLowerCase())
  );

  const checkedInCount = guests.filter((g) => g.status === 'checked_in').length;

  if (!token || !event) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-400">Please log in from On Site Tools</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="bg-[#111111] border-b border-white/5 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-white font-bold text-lg">Checked-in Guests</h1>
            <p className="text-gray-500 text-xs">
              {checkedInCount} / {guests.length} checked in
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ticket number..."
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-[#d3da0c] focus:outline-none transition-colors"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No guests found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((guest) => (
              <motion.div
                key={guest.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 p-3 bg-[#111111] border border-white/5 rounded-xl"
              >
                {guest.status === 'checked_in' ? (
                  <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{guest.user_name}</p>
                  <p className="text-gray-500 text-xs truncate">{guest.ticket_number} • {guest.tier_name}</p>
                </div>
                {guest.status === 'checked_in' && guest.checked_in_at && (
                  <span className="text-green-400 text-xs shrink-0">
                    {new Date(guest.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
