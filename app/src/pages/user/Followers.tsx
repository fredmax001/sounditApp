import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Users, Search, Loader2, UserMinus, UserPlus, Music, Store, Building2, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

interface FollowedItem {
    id: number;
    name: string;
    type: 'artist' | 'vendor' | 'organizer';
}

const Followers = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { profile, session } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'followers' | 'following'>('following');
    const [searchQuery, setSearchQuery] = useState('');
    const [followers, setFollowers] = useState<FollowedItem[]>([]);
    const [following, setFollowing] = useState<FollowedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    const fetchSocialData = useCallback(async () => {
        if (!session?.access_token) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const token = session.access_token;

            // Fetch platform follows (artists, vendors, organizers)
            const followingRes = await fetch(`${API_BASE_URL}/social/following`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (followingRes.ok) {
                const data = await followingRes.json();
                const combined: FollowedItem[] = [
                    ...(data.artists || []).map((a: { id: number; stage_name: string }) => ({ id: a.id, name: a.stage_name, type: 'artist' as const })),
                    ...(data.vendors || []).map((v: { id: number; business_name: string }) => ({ id: v.id, name: v.business_name, type: 'vendor' as const })),
                    ...(data.organizers || []).map((o: { id: number; organization_name: string }) => ({ id: o.id, name: o.organization_name, type: 'organizer' as const })),
                ];
                setFollowing(combined);
            }

            // Fetch business/organizer followers if applicable
            const followersRes = await fetch(`${API_BASE_URL}/business/followers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (followersRes.ok) {
                const data = await followersRes.json();
                const followerList: FollowedItem[] = (data.followers || data || []).map((f: { id?: number | string; name?: string; first_name?: string; last_name?: string }) => ({
                    id: Number(f.id || 0),
                    name: f.name || `${f.first_name || ''} ${f.last_name || ''}`.trim() || 'Unknown',
                    type: 'organizer' as const,
                }));
                setFollowers(followerList);
            }
        } catch (error) {
            console.error('Failed to fetch social data:', error);
            toast.error(t('user.followers.failedToLoadFollowersData'));
        } finally {
            setIsLoading(false);
        }
    }, [session]);

    useEffect(() => {
        fetchSocialData();
    }, [fetchSocialData]);

    const handleUnfollow = async (item: FollowedItem) => {
        if (!session?.access_token) {
            toast.error(t('user.followers.loginToUnfollow'));
            return;
        }

        setActionLoading(item.id);
        try {
            const endpoint =
                item.type === 'artist' ? `${API_BASE_URL}/social/artists/${item.id}/follow` :
                item.type === 'vendor' ? `${API_BASE_URL}/social/vendors/${item.id}/follow` :
                `${API_BASE_URL}/social/organizers/${item.id}/follow`;

            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (response.ok) {
                toast.success(t('user.followers.unfollowed'));
                setFollowing(prev => prev.filter(f => !(f.id === item.id && f.type === item.type)));
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to unfollow');
            }
        } catch {
            toast.error(t('user.followers.failedToUnfollowUser'));
        } finally {
            setActionLoading(null);
        }
    };

    const filteredItems = (activeTab === 'followers' ? followers : following).filter(item => {
        const searchLower = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(searchLower);
    });

    const displayItems = searchQuery ? filteredItems : (activeTab === 'followers' ? followers : following);
    const totalFollowers = followers.length;
    const totalFollowing = following.length;

    const getIcon = (type: FollowedItem['type']) => {
        switch (type) {
            case 'artist': return <Music className="w-5 h-5 text-[#d3da0c]" />;
            case 'vendor': return <Store className="w-5 h-5 text-pink-400" />;
            case 'organizer': return <Building2 className="w-5 h-5 text-blue-400" />;
            default: return <Heart className="w-5 h-5 text-gray-400" />;
        }
    };

    const getLink = (item: FollowedItem) => {
        switch (item.type) {
            case 'artist': return `/artists/${item.id}`;
            case 'vendor': return `/vendors/${item.id}`;
            case 'organizer': return `/events`;
            default: return '#';
        }
    };

    return (
        <div className="min-h-screen pt-20 pb-24">
            <section className="relative py-16 bg-[#111111]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                    >
                        <span className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4">
                            {t('user.followers.community')}
                        </span>
                        <h1 className="text-4xl md:text-6xl font-display text-white mb-6">
                            {t('user.followers.social')}{' '}
                            <span className="text-[#d3da0c]">{t('user.followers.network')}</span>
                        </h1>
                    </motion.div>
                </div>
            </section>

            <section className="py-12">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row gap-6 justify-between items-center mb-8">
                        <div className="flex gap-4">
                            <button
                                onClick={() => setActiveTab('followers')}
                                className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'followers'
                                    ? 'bg-[#d3da0c] text-black'
                                    : 'bg-white/5 text-gray-400 hover:text-white'
                                    }`}
                            >
                                {t('user.followers.followersTab', { count: totalFollowers })}
                            </button>
                            <button
                                onClick={() => setActiveTab('following')}
                                className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'following'
                                    ? 'bg-[#d3da0c] text-black'
                                    : 'bg-white/5 text-gray-400 hover:text-white'
                                    }`}
                            >
                                {t('user.followers.followingTab', { count: totalFollowing })}
                            </button>
                        </div>

                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder={t('user.followers.searchPeople')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:border-[#d3da0c] focus:outline-none"
                            />
                        </div>
                    </div>

                    {isLoading && (
                        <div className="text-center py-24 glass rounded-3xl">
                            <div className="w-12 h-12 mx-auto mb-4 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
                            <p className="text-gray-400">{t('user.followers.loading')}</p>
                        </div>
                    )}

                    {!isLoading && displayItems.length > 0 ? (
                        <div className="space-y-4">
                            {displayItems.map((item, index) => (
                                <motion.div
                                    key={`${item.type}-${item.id}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="glass rounded-2xl p-4 flex items-center gap-4"
                                >
                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center">
                                        {getIcon(item.type)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-semibold truncate">{item.name}</h3>
                                        <p className="text-gray-500 text-xs capitalize">{item.type}</p>
                                    </div>

                                    {activeTab === 'following' ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => navigate(getLink(item))}
                                                className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                                            >
                                                {t('user.followers.viewProfile')}
                                            </button>
                                            <button
                                                onClick={() => handleUnfollow(item)}
                                                disabled={actionLoading === item.id}
                                                className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {actionLoading === item.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <UserMinus className="w-4 h-4" />
                                                )}
                                                {t('user.followers.unfollow')}
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-gray-500 text-sm">{t('user.followers.follower')}</span>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    ) : !isLoading && searchQuery ? (
                        <div className="text-center py-24 glass rounded-3xl">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                                <Search className="w-10 h-10 text-gray-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">
                                {t('user.followers.noResultsFound')}
                            </h3>
                            <p className="text-gray-400 max-w-sm mx-auto">
                                {t('user.followers.adjustSearchTerms')}
                            </p>
                        </div>
                    ) : !isLoading && (
                        <div className="text-center py-24 glass rounded-3xl">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                                <Users className="w-10 h-10 text-gray-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">
                                {activeTab === 'followers' ? t('user.followers.noFollowersYet') : t('user.followers.noFollowingYet')}
                            </h3>
                            <p className="text-gray-400 max-w-sm mx-auto">
                                {activeTab === 'followers'
                                    ? t('user.followers.whenPeopleFollowYou')
                                    : t('user.followers.explorePlatform')}
                            </p>
                            {activeTab === 'following' && (
                                <button
                                    onClick={() => navigate('/artists')}
                                    className="mt-8 px-8 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors inline-flex items-center gap-2"
                                >
                                    <UserPlus className="w-5 h-5" />
                                    {t('user.followers.findPeople')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Followers;
