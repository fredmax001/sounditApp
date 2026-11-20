import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Users, UserCheck, ShieldCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FollowButton from './FollowButton';
import VerificationBadge from '@/components/VerificationBadge';

interface FollowUserItem {
  id: number;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  is_verified?: boolean;
  bio?: string | null;
  is_following?: boolean;
  follows_back?: boolean;
}

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number | string;
  userName?: string;
  initialTab?: 'followers' | 'following';
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const FollowersModal: React.FC<FollowersModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName = 'User',
  initialTab = 'followers'
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [followers, setFollowers] = useState<FollowUserItem[]>([]);
  const [following, setFollowing] = useState<FollowUserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [counts, setCounts] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Load followers/following and counts
  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const [followersRes, followingRes, countsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/social/users/${userId}/followers`, { headers }).catch(() => null),
          fetch(`${API_BASE_URL}/social/users/${userId}/following`, { headers }).catch(() => null),
          fetch(`${API_BASE_URL}/social/users/${userId}/follow-counts`, { headers }).catch(() => null)
        ]);

        if (isMounted) {
          if (followersRes && followersRes.ok) {
            const data = await followersRes.json();
            setFollowers(Array.isArray(data) ? data : data.followers || []);
          }
          if (followingRes && followingRes.ok) {
            const data = await followingRes.json();
            setFollowing(Array.isArray(data) ? data : data.following || []);
          }
          if (countsRes && countsRes.ok) {
            const data = await countsRes.json();
            setCounts({
              followers: data.followers_count || 0,
              following: data.following_count || 0
            });
          }
        }
      } catch (err) {
        console.error('Failed to load social relations:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, userId]);

  const activeList = activeTab === 'followers' ? followers : following;

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return activeList;
    const q = searchQuery.toLowerCase().trim();
    return activeList.filter((u) => {
      const matchUsername = (u.username || '').toLowerCase().includes(q);
      const matchFirst = (u.first_name || '').toLowerCase().includes(q);
      const matchLast = (u.last_name || '').toLowerCase().includes(q);
      const matchDisplay = (u.display_name || '').toLowerCase().includes(q);
      return matchUsername || matchFirst || matchLast || matchDisplay;
    });
  }, [activeList, searchQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-[120] p-0 sm:p-4 overflow-y-auto">
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.98 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative z-10 bg-[#0e110d] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col h-[75dvh] max-h-[82dvh] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4"
        >
          {/* Drag handle */}
          <div className="pt-3 pb-1">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-white/10 shrink-0">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white truncate max-w-[17.5rem]">
                {userName}
              </h3>
              <p className="text-xs text-gray-400">
                Community & Network
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-5 pt-3 shrink-0">
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#141812] border border-white/10 rounded-2xl">
              <button
                onClick={() => setActiveTab('followers')}
                className={`py-2.5 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'followers'
                    ? 'bg-[#d3da0c] text-black shadow-md'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Followers ({counts.followers || followers.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('following')}
                className={`py-2.5 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'following'
                    ? 'bg-[#d3da0c] text-black shadow-md'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Following ({counts.following || following.length})</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-5 pt-3 pb-2 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab}...`}
                className="w-full pl-10 pr-4 py-2 bg-[#141812] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Users List */}
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2 min-h-0">
            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#d3da0c]" />
              </div>
            ) : filteredList.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center px-4">
                <Users className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-xs font-bold text-gray-400">
                  {searchQuery ? 'No accounts matched your search' : `No ${activeTab} yet`}
                </p>
                <p className="text-[0.6875rem] text-gray-500 mt-1">
                  Connect and interact to build this community.
                </p>
              </div>
            ) : (
              filteredList.map((user) => {
                const displayName = user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
                const avatar = user.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${user.username}`;
                const relationshipState = user.is_following ? 'following' : user.follows_back ? 'follow_back' : 'follow';

                return (
                  <div
                    key={user.id}
                    onClick={() => {
                      onClose();
                      navigate(`/profiles/${user.username}`);
                    }}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-[#141812] border border-white/5 hover:border-white/15 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={avatar}
                        alt={displayName}
                        className="w-11 h-11 rounded-full object-cover border border-white/10 shrink-0 bg-black"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-bold text-white truncate group-hover:text-[#d3da0c] transition-colors">
                            {displayName}
                          </p>
                          {user.is_verified && (
                            <VerificationBadge size="xs" className="shrink-0" />
                          )}
                        </div>
                        <p className="text-[0.6875rem] text-gray-400 truncate">
                          @{user.username}
                        </p>
                        {user.role && user.role !== 'user' && (
                          <span className="inline-block px-1.5 py-0.2 text-[0.5625rem] font-black uppercase tracking-wider rounded bg-white/10 text-gray-300 mt-0.5">
                            {user.role}
                          </span>
                        )}
                      </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <FollowButton
                        targetUserId={user.id}
                        targetUsername={user.username}
                        initialState={relationshipState}
                        size="sm"
                        variant="subtle"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default FollowersModal;
