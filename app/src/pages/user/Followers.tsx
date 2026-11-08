import MobilePageHeader from '@/components/MobilePageHeader';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    Users,
    Search,
    Loader2,
    UserMinus,
    UserPlus,
    Music,
    Store,
    Building2,
    Heart,
    ChevronLeft,
    Check,
    MapPin,
    ShieldCheck,
    ExternalLink,
    Compass,
    Radio,
    X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

export interface FollowedItem {
    id: number;
    user_id?: number;
    name: string;
    type: 'artist' | 'vendor' | 'organizer' | 'user';
    slug?: string;
    avatar_url?: string | null;
    logo_url?: string | null;
    city?: string | null;
    genre?: string | null;
    vendor_type?: string | null;
    organization_name?: string | null;
    business_name?: string | null;
    follower_count?: number;
    followers_count?: number;
    is_verified?: boolean;
    is_following?: boolean;
    joinedDate?: string | null;
}

type TabType = 'following' | 'followers' | 'discover';
type CategoryFilter = 'all' | 'artist' | 'organizer' | 'vendor' | 'user';

const Followers = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { profile, session, isAuthenticated } = useAuthStore();
    const [activeTab, setActiveTab] = useState<TabType>('following');
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [followers, setFollowers] = useState<FollowedItem[]>([]);
    const [following, setFollowing] = useState<FollowedItem[]>([]);
    const [suggested, setSuggested] = useState<FollowedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || (profile as unknown as { role_type?: string })?.role_type === 'admin';

    const fetchSocialData = useCallback(async () => {
        if (!session?.access_token) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const token = session.access_token;
            const headers = { 'Authorization': `Bearer ${token}` };

            // 1. Fetch Following
            const followingPromise = fetch(`${API_BASE_URL}/social/following`, { headers })
                .then(async (res) => {
                    if (!res.ok) return [];
                    const data = await res.json();
                    const combined: FollowedItem[] = [
                        ...(data.artists || []).map((a: FollowedItem & { stage_name?: string }) => ({
                            id: a.id,
                            user_id: a.user_id,
                            name: a.stage_name || a.name || 'Artist',
                            type: 'artist' as const,
                            slug: a.slug,
                            avatar_url: a.avatar_url,
                            city: a.city,
                            genre: a.genre,
                            followers_count: a.followers_count ?? a.follower_count ?? 0,
                            is_verified: a.is_verified ?? false,
                            is_following: true,
                        })),
                        ...(data.organizers || []).map((o: FollowedItem & { organization_name?: string }) => ({
                            id: o.id,
                            user_id: o.user_id,
                            name: o.organization_name || o.name || 'Venue / Business',
                            type: 'organizer' as const,
                            slug: o.slug,
                            avatar_url: o.logo_url || o.avatar_url,
                            city: o.city,
                            genre: 'Venue & Events',
                            followers_count: o.followers_count ?? 0,
                            is_verified: o.is_verified ?? false,
                            is_following: true,
                        })),
                        ...(data.vendors || []).map((v: FollowedItem & { business_name?: string }) => ({
                            id: v.id,
                            user_id: v.user_id,
                            name: v.business_name || v.name || 'Vendor',
                            type: 'vendor' as const,
                            slug: v.slug,
                            avatar_url: v.logo_url || v.avatar_url,
                            city: v.city,
                            genre: v.vendor_type || 'Merchant',
                            followers_count: v.followers_count ?? 0,
                            is_verified: v.is_verified ?? false,
                            is_following: true,
                        })),
                    ];
                    return combined;
                })
                .catch(() => [] as FollowedItem[]);

            // 2. Fetch Followers
            const followersPromise = fetch(`${API_BASE_URL}/social/followers`, { headers })
                .then(async (res) => {
                    if (res.ok) {
                        const data = await res.json();
                        return Array.isArray(data) ? (data as FollowedItem[]) : [];
                    }
                    // Fallback to /business/followers
                    const fallbackRes = await fetch(`${API_BASE_URL}/business/followers`, { headers });
                    if (fallbackRes.ok) {
                        const fallbackData = await fallbackRes.json();
                        const list = Array.isArray(fallbackData) ? fallbackData : (fallbackData.followers || []);
                        return list.map((f: { id?: number | string; name?: string; first_name?: string; last_name?: string; joinedDate?: string }) => ({
                            id: Number(f.id || 0),
                            name: f.name || `${f.first_name || ''} ${f.last_name || ''}`.trim() || 'Supporter',
                            type: 'user' as const,
                            joinedDate: f.joinedDate,
                            is_following: false,
                        }));
                    }
                    return [] as FollowedItem[];
                })
                .catch(() => [] as FollowedItem[]);

            // 3. Fetch Suggested Connections
            const suggestedPromise = fetch(`${API_BASE_URL}/social/suggested`, { headers })
                .then(async (res) => {
                    if (res.ok) {
                        const data = await res.json();
                        return Array.isArray(data) ? (data as FollowedItem[]) : [];
                    }
                    return [] as FollowedItem[];
                })
                .catch(() => [] as FollowedItem[]);

            const [followingList, followersList, suggestedList] = await Promise.all([
                followingPromise,
                followersPromise,
                suggestedPromise,
            ]);

            setFollowing(followingList);
            setFollowers(followersList);
            setSuggested(suggestedList);
        } catch (error) {
            console.error('Failed to fetch social network data:', error);
            toast.error(t('user.followers.failedToLoadFollowersData') || 'Failed to load network data');
        } finally {
            setIsLoading(false);
        }
    }, [session, t]);

    useEffect(() => {
        fetchSocialData();
    }, [fetchSocialData]);

    // Handle Unfollow
    const handleUnfollow = async (item: FollowedItem) => {
        if (!session?.access_token) {
            toast.error(t('user.followers.loginToUnfollow') || 'Please log in');
            return;
        }

        const actionKey = `${item.type}-${item.id}`;
        setActionLoadingId(actionKey);

        // Optimistic update
        setFollowing((prev) => prev.filter((f) => !(f.id === item.id && f.type === item.type)));
        setFollowers((prev) =>
            prev.map((f) => (f.id === item.id && f.type === item.type ? { ...f, is_following: false } : f))
        );

        try {
            const endpoint =
                item.type === 'artist'
                    ? `${API_BASE_URL}/social/artists/${item.id}/follow`
                    : item.type === 'vendor'
                    ? `${API_BASE_URL}/social/vendors/${item.id}/follow`
                    : item.type === 'organizer'
                    ? `${API_BASE_URL}/social/organizers/${item.id}/follow`
                    : `${API_BASE_URL}/social/users/${item.user_id || item.id}/follow`;

            const res = await fetch(endpoint, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (res.ok) {
                toast.success(t('user.followers.unfollowed') || `Unfollowed ${item.name}`);
            } else {
                throw new Error('Failed to unfollow');
            }
        } catch {
            toast.error(t('user.followers.failedToUnfollowUser') || 'Failed to unfollow');
            fetchSocialData(); // Rollback on failure
        } finally {
            setActionLoadingId(null);
        }
    };

    // Handle Follow
    const handleFollow = async (item: FollowedItem) => {
        if (!session?.access_token) {
            toast.info('Please log in to follow creators');
            navigate('/login');
            return;
        }

        const actionKey = `${item.type}-${item.id}`;
        setActionLoadingId(actionKey);

        // Optimistic update
        const updatedItem = { ...item, is_following: true };
        setFollowing((prev) => [updatedItem, ...prev.filter((f) => !(f.id === item.id && f.type === item.type))]);
        setFollowers((prev) =>
            prev.map((f) => (f.id === item.id && f.type === item.type ? { ...f, is_following: true } : f))
        );
        setSuggested((prev) => prev.filter((s) => !(s.id === item.id && s.type === item.type)));

        try {
            const endpoint =
                item.type === 'artist'
                    ? `${API_BASE_URL}/social/artists/${item.id}/follow`
                    : item.type === 'vendor'
                    ? `${API_BASE_URL}/social/vendors/${item.id}/follow`
                    : item.type === 'organizer'
                    ? `${API_BASE_URL}/social/organizers/${item.id}/follow`
                    : `${API_BASE_URL}/social/users/${item.user_id || item.id}/follow`;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (res.ok) {
                toast.success(`Following ${item.name}`);
            } else {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to follow');
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to follow');
            fetchSocialData(); // Rollback
        } finally {
            setActionLoadingId(null);
        }
    };

    const getLink = (item: FollowedItem) => {
        const slugOrId = item.slug || item.id;
        switch (item.type) {
            case 'artist':
                return `/artists/${slugOrId}`;
            case 'vendor':
                return `/vendors/${slugOrId}`;
            case 'organizer':
                return `/profiles/${slugOrId}`;
            default:
                return `/profiles/${slugOrId}`;
        }
    };

    // Filter and search
    const activeList = useMemo(() => {
        if (activeTab === 'following') return following;
        if (activeTab === 'followers') return followers;
        return suggested;
    }, [activeTab, following, followers, suggested]);

    const filteredItems = useMemo(() => {
        return activeList.filter((item) => {
            const matchesCategory = categoryFilter === 'all' || item.type === categoryFilter;
            const searchLower = searchQuery.toLowerCase().trim();
            const matchesSearch =
                !searchLower ||
                item.name.toLowerCase().includes(searchLower) ||
                (item.genre && item.genre.toLowerCase().includes(searchLower)) ||
                (item.city && item.city.toLowerCase().includes(searchLower));
            return matchesCategory && matchesSearch;
        });
    }, [activeList, categoryFilter, searchQuery]);

    const roleBadge = (type: FollowedItem['type']) => {
        switch (type) {
            case 'artist':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d3da0c]/15 text-[#020b00] dark:text-[#d3da0c] border border-[#d3da0c]/30">
                        DJ / Artist
                    </span>
                );
            case 'organizer':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                        <Building2 className="w-2.5 h-2.5 text-blue-400" /> Business / Venue
                    </span>
                );
            case 'vendor':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/30">
                        <Store className="w-2.5 h-2.5 text-pink-400" /> Merchant / Vendor
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-200 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                        <Users className="w-2.5 h-2.5" /> Community
                    </span>
                );
        }
    };

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-[#020b00] text-[#020b00] dark:text-white pb-28 transition-colors">
            {/* Header */}
            <MobilePageHeader
              wide
              title="Social"
              accent="Network"
              right={
                <div className="relative w-36 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search connections..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-[#020b00] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[#020b00] dark:focus:border-[#d3da0c]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-black dark:hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              }
            >
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:block hidden -mt-1 mb-1">
                Connect with verified DJs, venues, organizers, and merchants across China.
              </p>
            </MobilePageHeader>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Admin Notice */}
                {isAdmin && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 shrink-0" />
                        <span>
                            <strong>Administrator Account:</strong> Admin accounts are kept private and cannot follow other accounts or be listed publicly.
                        </span>
                    </div>
                )}

                {/* Metrics Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                        onClick={() => { setActiveTab('following'); setCategoryFilter('all'); }}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                            activeTab === 'following'
                                ? 'bg-white dark:bg-[#111111] border-[#020b00] dark:border-[#d3da0c] shadow-sm'
                                : 'bg-white/80 dark:bg-[#111111]/70 border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Following</span>
                            <UserCheckIcon className="w-4 h-4 text-[#020b00] dark:text-[#d3da0c]" />
                        </div>
                        <div className="mt-2 text-2xl font-bold font-display text-[#020b00] dark:text-white">
                            {following.length}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">Accounts you follow</p>
                    </button>

                    <button
                        onClick={() => { setActiveTab('followers'); setCategoryFilter('all'); }}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                            activeTab === 'followers'
                                ? 'bg-white dark:bg-[#111111] border-[#020b00] dark:border-[#d3da0c] shadow-sm'
                                : 'bg-white/80 dark:bg-[#111111]/70 border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Followers</span>
                            <Users className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="mt-2 text-2xl font-bold font-display text-[#020b00] dark:text-white">
                            {followers.length}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">People following you</p>
                    </button>

                    <button
                        onClick={() => { setActiveTab('discover'); setCategoryFilter('all'); }}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                            activeTab === 'discover'
                                ? 'bg-white dark:bg-[#111111] border-[#020b00] dark:border-[#d3da0c] shadow-sm'
                                : 'bg-white/80 dark:bg-[#111111]/70 border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Discover</span>
                            <Compass className="w-4 h-4 text-pink-500" />
                        </div>
                        <div className="mt-2 text-2xl font-bold font-display text-[#020b00] dark:text-white">
                            {suggested.length}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">Recommended creators</p>
                    </button>

                    <div className="p-4 rounded-2xl border bg-white/80 dark:bg-[#111111]/70 border-black/5 dark:border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Reach</span>
                        </div>
                        <div className="mt-2 text-2xl font-bold font-display text-[#020b00] dark:text-white">
                            {following.reduce((acc, curr) => acc + (curr.followers_count || 0), 0) + followers.length}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">Combined audience</p>
                    </div>
                </div>

                {/* Primary Segmented Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/8 dark:border-white/8 pb-3">
                    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                        <button
                            onClick={() => setActiveTab('following')}
                            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
                                activeTab === 'following'
                                    ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs'
                                    : 'bg-white dark:bg-[#111111] text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white border border-black/5 dark:border-white/5'
                            }`}
                        >
                            <span>Following</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                activeTab === 'following'
                                    ? 'bg-[#d3da0c] text-black dark:bg-black dark:text-[#d3da0c]'
                                    : 'bg-black/10 dark:bg-white/10'
                            }`}>
                                {following.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('followers')}
                            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
                                activeTab === 'followers'
                                    ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs'
                                    : 'bg-white dark:bg-[#111111] text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white border border-black/5 dark:border-white/5'
                            }`}
                        >
                            <span>Followers</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                activeTab === 'followers'
                                    ? 'bg-[#d3da0c] text-black dark:bg-black dark:text-[#d3da0c]'
                                    : 'bg-black/10 dark:bg-white/10'
                            }`}>
                                {followers.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('discover')}
                            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
                                activeTab === 'discover'
                                    ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs'
                                    : 'bg-white dark:bg-[#111111] text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white border border-black/5 dark:border-white/5'
                            }`}
                        >
                            <Compass className="w-3.5 h-3.5" />
                            <span>Discover & Connect</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                activeTab === 'discover'
                                    ? 'bg-[#d3da0c] text-black dark:bg-black dark:text-[#d3da0c]'
                                    : 'bg-black/10 dark:bg-white/10'
                            }`}>
                                {suggested.length}
                            </span>
                        </button>
                    </div>

                    {/* Role Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
                        {[
                            { id: 'all', label: 'All Roles' },
                            { id: 'artist', label: 'DJs & Artists' },
                            { id: 'organizer', label: 'Venues & Businesses' },
                            { id: 'vendor', label: 'Vendors' },
                        ].map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setCategoryFilter(cat.id as CategoryFilter)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                                    categoryFilter === cat.id
                                        ? 'bg-[#020b00] text-white dark:bg-white dark:text-black font-semibold'
                                        : 'bg-neutral-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="text-center py-20 bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl shadow-xs">
                        <div className="w-10 h-10 mx-auto mb-3 border-2 border-[#020b00] dark:border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
                        <p className="text-gray-500 text-sm">Loading connections...</p>
                    </div>
                )}

                {/* Connections Grid */}
                {!isLoading && filteredItems.length > 0 && (
                    <motion.div
                        layout
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        <AnimatePresence>
                            {filteredItems.map((item) => {
                                const actionKey = `${item.type}-${item.id}`;
                                const isActionLoading = actionLoadingId === actionKey;
                                const isFollowing = activeTab === 'following' || item.is_following;

                                return (
                                    <motion.div
                                        key={actionKey}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.2 }}
                                        className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-black/20 dark:hover:border-white/20 transition-all shadow-xs"
                                    >
                                        <div className="flex items-start gap-3.5">
                                            {/* Avatar */}
                                            <div
                                                onClick={() => navigate(getLink(item))}
                                                className="relative cursor-pointer shrink-0"
                                            >
                                                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#d3da0c]/15 border border-black/10 dark:border-white/10 flex items-center justify-center">
                                                    {item.avatar_url ? (
                                                        <img
                                                            src={item.avatar_url}
                                                            alt={item.name}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <span className="text-lg font-bold font-display text-[#020b00] dark:text-[#d3da0c]">
                                                            {(item.name || '?')[0].toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                {item.is_verified && (
                                                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#d3da0c] text-black flex items-center justify-center shadow-xs">
                                                        <Check className="w-3 h-3 stroke-[3]" />
                                                    </span>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <h3
                                                        onClick={() => navigate(getLink(item))}
                                                        className="font-bold text-sm text-[#020b00] dark:text-white truncate cursor-pointer hover:underline"
                                                    >
                                                        {item.name}
                                                    </h3>
                                                </div>

                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    {roleBadge(item.type)}
                                                    {item.city && (
                                                        <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500 capitalize">
                                                            <MapPin className="w-2.5 h-2.5 text-[#d3da0c]" />
                                                            {item.city}
                                                        </span>
                                                    )}
                                                </div>

                                                {item.genre && (
                                                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 truncate">
                                                        {item.genre}
                                                    </p>
                                                )}

                                                {(item.followers_count ?? item.follower_count ?? 0) > 0 && (
                                                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                                                        <Users className="w-3 h-3 text-[#d3da0c]" />
                                                        {(item.followers_count ?? item.follower_count ?? 0).toLocaleString()} followers
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                                            <button
                                                onClick={() => navigate(getLink(item))}
                                                className="flex-1 py-2 px-3 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-xs font-semibold text-[#020b00] dark:text-white transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <span>View</span>
                                                <ExternalLink className="w-3 h-3 text-gray-400" />
                                            </button>

                                            {isFollowing ? (
                                                <button
                                                    onClick={() => handleUnfollow(item)}
                                                    disabled={isActionLoading}
                                                    className="group flex-1 py-2 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-transparent text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-500 transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    {isActionLoading ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Check className="w-3.5 h-3.5 text-emerald-500 group-hover:hidden" />
                                                            <UserMinus className="w-3.5 h-3.5 text-rose-500 hidden group-hover:block" />
                                                            <span className="group-hover:hidden">Following</span>
                                                            <span className="hidden group-hover:inline text-rose-500">Unfollow</span>
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleFollow(item)}
                                                    disabled={isActionLoading}
                                                    className="flex-1 py-2 px-3 rounded-xl bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                                                >
                                                    {isActionLoading ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <UserPlus className="w-3.5 h-3.5" />
                                                            <span>{activeTab === 'followers' ? 'Follow Back' : 'Follow'}</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* Empty State with Search query */}
                {!isLoading && filteredItems.length === 0 && searchQuery && (
                    <div className="text-center py-16 bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl p-6">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                            <Search className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-base font-bold text-[#020b00] dark:text-white">
                            No connections found for "{searchQuery}"
                        </h3>
                        <p className="text-gray-500 text-xs mt-1">Try adjusting your search query or clear the filter.</p>
                        <button
                            onClick={() => setSearchQuery('')}
                            className="mt-4 px-4 py-2 bg-neutral-100 dark:bg-white/5 rounded-xl text-xs font-semibold hover:bg-neutral-200 dark:hover:bg-white/10"
                        >
                            Clear Search
                        </button>
                    </div>
                )}

                {/* Empty State without Search query */}
                {!isLoading && filteredItems.length === 0 && !searchQuery && (
                    <div className="text-center py-20 bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl p-8 max-w-lg mx-auto">
                        {(activeTab === 'followers' || activeTab === 'following') && (
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#d3da0c]/15 flex items-center justify-center text-[#d3da0c]">
                                {activeTab === 'followers' ? (
                                    <Users className="w-8 h-8 text-[#020b00] dark:text-[#d3da0c]" />
                                ) : (
                                    <Compass className="w-8 h-8 text-[#020b00] dark:text-[#d3da0c]" />
                                )}
                            </div>
                        )}

                        <h3 className="text-lg font-bold text-[#020b00] dark:text-white">
                            {activeTab === 'followers'
                                ? 'No Followers Yet'
                                : activeTab === 'following'
                                ? 'Not Following Anyone Yet'
                                : 'No Recommendations Right Now'}
                        </h3>

                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1.5 leading-relaxed">
                            {activeTab === 'followers'
                                ? 'Share your profile with friends, organizers, and artists to grow your community on Sound It.'
                                : activeTab === 'following'
                                ? 'Follow artists, clubs, and merchants across China to stay up to date with events, music drops, and announcements.'
                                : 'Check back soon for new featured artists and business profiles.'}
                        </p>

                        <div className="flex items-center justify-center gap-3 mt-6">
                            {activeTab !== 'discover' && (
                                <button
                                    onClick={() => setActiveTab('discover')}
                                    className="px-5 py-2.5 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold text-xs rounded-xl hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                    <Compass className="w-4 h-4" />
                                    <span>Discover Creators</span>
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/artists')}
                                className="px-5 py-2.5 bg-neutral-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white font-semibold text-xs rounded-xl transition-all"
                            >
                                Browse Artists
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

function UserCheckIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <polyline points="16 11 18 13 22 9" />
        </svg>
    );
}

export default Followers;
