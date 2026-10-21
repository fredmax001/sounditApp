import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Utensils, Star, ChevronDown, Store, Wine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCityGuideStore } from '@/store/cityGuideStore';

const API_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

interface DirectoryEntry {
    kind: 'spot' | 'vendor' | 'business';
    id: number;
    name: string;
    city: string | null;
    description?: string | null;
    cuisine_type?: string | null;
    cover_image?: string | null;
    rating?: number;
    price_range?: string | null;
    link: string | null;
    item_count?: number;
}

const Food = () => {
    const { t } = useTranslation();
    const { foodSpots, fetchFoodSpots, isLoading } = useCityGuideStore();
    const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
    const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
    const [selectedCity, setSelectedCity] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);

    useEffect(() => {
        fetchFoodSpots();
    }, [fetchFoodSpots]);

    useEffect(() => {
        const fetchDirectory = async () => {
            try {
                const res = await fetch(`${API_URL}/tables/food/directory`);
                if (res.ok) {
                    const data = await res.json();
                    const merged: DirectoryEntry[] = [
                        ...(data.spots || []),
                        ...(data.vendors || []),
                        ...(data.businesses || []),
                    ];
                    setDirectory(merged);
                }
            } catch {
                // non-blocking — fall back to food spots only
            } finally {
                setIsLoadingDirectory(false);
            }
        };
        fetchDirectory();
    }, []);

    // Legacy food spots from the store (kept for backward compatibility)
    const legacySpots: DirectoryEntry[] = useMemo(() =>
        foodSpots.map(s => ({
            kind: 'spot' as const,
            id: Number(s.id),
            name: s.name,
            city: s.city,
            description: s.description,
            cuisine_type: s.cuisine_type || (s.cuisine_types && s.cuisine_types[0]) || null,
            cover_image: s.cover_image,
            rating: s.rating,
            price_range: s.price_range,
            link: null,
        })), [foodSpots]);

    // Merge: directory first, fill in any legacy spots not already present
    const allEntries = useMemo(() => {
        const seen = new Set(directory.map(d => `${d.kind}-${d.id}`));
        const extra = legacySpots.filter(s => !seen.has(`spot-${s.id}`));
        return [...directory, ...extra];
    }, [directory, legacySpots]);

    const isPageLoading = isLoading || isLoadingDirectory;

    // Get cities that actually have food entries (from data)
    const availableCities = useMemo(() => {
        const citySet = new Set(allEntries.map(e => e.city).filter(Boolean));
        return ['all', ...Array.from(citySet).sort()];
    }, [allEntries]);

    // Filter entries based on city and search
    const filteredSpots = useMemo(() => {
        return allEntries.filter(spot => {
            const matchesCity = selectedCity === 'all' || spot.city === selectedCity;
            const searchLower = searchQuery.toLowerCase().trim();
            const matchesSearch = !searchLower ||
                spot.name.toLowerCase().includes(searchLower) ||
                (spot.cuisine_type && spot.cuisine_type.toLowerCase().includes(searchLower)) ||
                (spot.description && spot.description.toLowerCase().includes(searchLower)) ||
                (spot.city && spot.city.toLowerCase().includes(searchLower));
            return matchesCity && matchesSearch;
        });
    }, [allEntries, selectedCity, searchQuery]);

    // Get city display name
    const getCityDisplayName = (cityId: string) => {
        if (cityId === 'all') return t('food.allCities');
        return cityId.charAt(0).toUpperCase() + cityId.slice(1);
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white pb-12 transition-colors duration-200">
            {/* Header + Filters */}
            <section className="sticky top-0 z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-md border-b border-black/8 dark:border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <h1 className="text-2xl font-display text-[#020b00] dark:text-white">{t('food.title')}</h1>
                    <p className="text-gray-600 dark:text-gray-400 text-sm hidden md:block mt-1">
                        {t('food.subtitle')}
                    </p>

                    <div className="flex flex-col md:flex-row gap-4 mt-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-white/40" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('food.searchPlaceholder')}
                                className="w-full pl-12 pr-4 py-3 bg-neutral-100 dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors"
                            />
                        </div>

                        {/* City Dropdown - Only shows cities with data */}
                        <div className="relative">
                            <button
                                onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                                className="flex items-center gap-2 px-4 py-3 bg-neutral-100 dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white hover:border-black/20 dark:hover:border-white/20 transition-colors min-w-[160px]"
                            >
                                <MapPin className="w-4 h-4 text-gray-700 dark:text-[#d3da0c]" />
                                <span className="flex-1 text-left">{getCityDisplayName(selectedCity)}</span>
                                <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-white/50 transition-transform ${isCityDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {/* Dropdown Menu */}
                            {isCityDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl overflow-hidden z-50 max-h-64 overflow-y-auto shadow-xl"
                                >
                                    {availableCities.length === 1 ? (
                                        <div className="px-4 py-3 text-gray-500 dark:text-white/50 text-sm">
                                            {t('food.noCities')}
                                        </div>
                                    ) : (
                                        availableCities.map(city => (
                                            <button
                                                key={city}
                                                onClick={() => {
                                                    setSelectedCity(city);
                                                    setIsCityDropdownOpen(false);
                                                }}
                                                className={`w-full px-4 py-3 text-left hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors ${selectedCity === city ? 'bg-[#020b00]/5 text-[#020b00] dark:bg-[#d3da0c]/10 dark:text-[#d3da0c] font-semibold' : 'text-[#020b00] dark:text-white'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {getCityDisplayName(city)}
                                                    {city !== 'all' && (
                                                        <span className="ml-auto text-xs text-gray-500 dark:text-white/30">
                                                            {allEntries.filter(s => s.city === city).length} {t('food.spots') || 'spots'}
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </motion.div>
                            )}
                            
                            {/* Click outside to close */}
                            {isCityDropdownOpen && (
                                <div 
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsCityDropdownOpen(false)}
                                />
                            )}
                        </div>
                    </div>
                    
                    {/* Results count */}
                    {!isPageLoading && (
                        <div className="mt-3 text-sm text-gray-600 dark:text-white/40">
                            {filteredSpots.length} {filteredSpots.length !== 1 ? t('food.restaurantsFound') : t('food.restaurantFound')}
                            {selectedCity !== 'all' && ` in ${getCityDisplayName(selectedCity)}`}
                            {searchQuery && ` matching "${searchQuery}"`}
                        </div>
                    )}
                </div>
            </section>

            {/* Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isPageLoading ? (
                        [1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-80 bg-neutral-100 dark:bg-white/5 rounded-2xl animate-pulse" />
                        ))
                    ) : filteredSpots.length > 0 ? (
                        filteredSpots.map((spot, index) => {
                            const card = (
                                <>
                                <div className="aspect-video overflow-hidden bg-neutral-100 dark:bg-white/5 relative">
                                    {spot.cover_image ? (
                                        <img
                                            src={spot.cover_image}
                                            alt={spot.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            {spot.kind === 'business'
                                                ? <Wine className="w-12 h-12 text-gray-400 dark:text-white/30" />
                                                : spot.kind === 'vendor'
                                                    ? <Store className="w-12 h-12 text-gray-400 dark:text-white/30" />
                                                    : <Utensils className="w-12 h-12 text-gray-400 dark:text-white/30" />}
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-semibold text-[#d3da0c] border border-[#d3da0c]/20 capitalize">
                                        {spot.kind === 'business'
                                            ? (t('food.menu') || 'Menu')
                                            : spot.cuisine_type || t('food.africanFood')}
                                    </div>
                                </div>

                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="text-xl font-bold text-[#020b00] dark:text-white mb-1">{spot.name}</h3>
                                            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-sm">
                                                <MapPin className="w-3.5 h-3.5" />
                                                <span>{spot.city || '—'}</span>
                                            </div>
                                        </div>
                                        {spot.rating ? (
                                            <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
                                                <Star className="w-4 h-4 fill-current" />
                                                <span className="font-bold">{Number(spot.rating).toFixed(1)}</span>
                                            </div>
                                        ) : null}
                                    </div>

                                    {spot.description && (
                                        <p className="text-gray-600 dark:text-white/60 text-sm line-clamp-2 mb-4">
                                            {spot.description}
                                        </p>
                                    )}

                                    <div className="pt-4 border-t border-black/8 dark:border-white/5 flex items-center justify-between">
                                        <span className="text-gray-500 dark:text-white/40 text-sm">
                                            {spot.item_count
                                                ? `${spot.item_count} ${t('food.menuItems') || 'items'}`
                                                : (spot.price_range || '')}
                                        </span>
                                        <span className="text-gray-900 dark:text-[#d3da0c] text-sm font-semibold">
                                            {spot.link
                                                ? (t('food.viewMenu') || 'View Menu')
                                                : (t('food.viewDetails') || 'View')}
                                        </span>
                                    </div>
                                </div>
                                </>
                            );
                            return spot.link ? (
                                <motion.div
                                    key={`${spot.kind}-${spot.id}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Link
                                        to={spot.link}
                                        className="group bg-white dark:bg-[#111111] rounded-2xl overflow-hidden border border-black/8 dark:border-white/5 hover:border-[#020b00]/30 dark:hover:border-[#d3da0c]/30 transition-all block h-full shadow-sm dark:shadow-none"
                                    >
                                        {card}
                                    </Link>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key={`${spot.kind}-${spot.id}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="group bg-white dark:bg-[#111111] rounded-2xl overflow-hidden border border-black/8 dark:border-white/5 hover:border-[#020b00]/30 dark:hover:border-[#d3da0c]/30 transition-all shadow-sm dark:shadow-none"
                                >
                                    {card}
                                </motion.div>
                            );
                        })
                    ) : (
                        <div className="col-span-full py-20 text-center">
                            <div className="w-20 h-20 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Utensils className="w-10 h-10 text-gray-400 dark:text-white/30" />
                            </div>
                            <h3 className="text-xl font-bold text-[#020b00] dark:text-white mb-2">
                                {searchQuery ? t('food.noRestaurantsSearch') : t('food.noRestaurants')}
                            </h3>
                            <p className="text-gray-600 dark:text-white/50">
                                {searchQuery 
                                    ? t('food.tryDifferentKeywords')
                                    : `${selectedCity !== 'all' ? t('food.noRestaurantsIn', { city: getCityDisplayName(selectedCity) }) + ' ' : ''}${t('food.checkBackSoon')}`}
                            </p>
                            {(searchQuery || selectedCity !== 'all') && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedCity('all');
                                    }}
                                    className="mt-4 px-4 py-2 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black rounded-lg font-medium hover:opacity-90 transition-opacity"
                                >
                                    {t('food.clearFilters')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Food;
