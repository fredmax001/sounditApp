import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Utensils, Star, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCityGuideStore } from '@/store/cityGuideStore';

const Food = () => {
    const { t } = useTranslation();
    const { foodSpots, fetchFoodSpots, isLoading } = useCityGuideStore();
    const [selectedCity, setSelectedCity] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);

    useEffect(() => {
        fetchFoodSpots();
    }, [fetchFoodSpots]);

    // Get cities that actually have food spots (from data)
    const availableCities = useMemo(() => {
        const citySet = new Set(foodSpots.map(spot => spot.city).filter(Boolean));
        return ['all', ...Array.from(citySet).sort()];
    }, [foodSpots]);

    // Filter spots based on city and search
    const filteredSpots = useMemo(() => {
        return foodSpots.filter(spot => {
            const matchesCity = selectedCity === 'all' || spot.city === selectedCity;
            const searchLower = searchQuery.toLowerCase().trim();
            const matchesSearch = !searchLower || 
                spot.name.toLowerCase().includes(searchLower) ||
                (spot.cuisine_type && spot.cuisine_type.toLowerCase().includes(searchLower)) ||
                (spot.cuisine_types && spot.cuisine_types.some(t => t.toLowerCase().includes(searchLower))) ||
                (spot.description && spot.description.toLowerCase().includes(searchLower)) ||
                (spot.city && spot.city.toLowerCase().includes(searchLower));
            return matchesCity && matchesSearch;
        });
    }, [foodSpots, selectedCity, searchQuery]);

    // Get city display name
    const getCityDisplayName = (cityId: string) => {
        if (cityId === 'all') return t('food.allCities');
        return cityId.charAt(0).toUpperCase() + cityId.slice(1);
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="mb-12">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-5xl font-display text-white mb-4"
                    >
                        {t('food.title')}
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-gray-400 text-lg max-w-2xl"
                    >
                        {t('food.subtitle')}
                    </motion.p>
                </div>

                {/* Filters */}
                <div className="sticky top-20 z-30 bg-[#0A0A0A]/95 backdrop-blur-md py-4 mb-8 border-b border-white/5">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('food.searchPlaceholder')}
                                className="w-full pl-12 pr-4 py-3 bg-[#141414] border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:border-[#d3da0c] focus:outline-none transition-colors"
                            />
                        </div>

                        {/* City Dropdown - Only shows cities with data */}
                        <div className="relative">
                            <button
                                onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                                className="flex items-center gap-2 px-4 py-3 bg-[#141414] border border-white/10 rounded-xl text-white hover:border-white/20 transition-colors min-w-[160px]"
                            >
                                <MapPin className="w-4 h-4 text-[#d3da0c]" />
                                <span className="flex-1 text-left">{getCityDisplayName(selectedCity)}</span>
                                <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${isCityDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {/* Dropdown Menu */}
                            {isCityDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-full left-0 right-0 mt-2 bg-[#141414] border border-white/10 rounded-xl overflow-hidden z-50 max-h-64 overflow-y-auto"
                                >
                                    {availableCities.length === 1 ? (
                                        <div className="px-4 py-3 text-white/50 text-sm">
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
                                                className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors ${selectedCity === city ? 'bg-[#d3da0c]/10 text-[#d3da0c]' : 'text-white'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span className={selectedCity === city ? 'text-[#d3da0c]' : 'text-white/50'}>
                                                        {city === 'all' ? '' : ''}
                                                    </span>
                                                    {getCityDisplayName(city)}
                                                    {city !== 'all' && (
                                                        <span className="ml-auto text-xs text-white/30">
                                                            {foodSpots.filter(s => s.city === city).length} {t('food.spots') || 'spots'}
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
                    {!isLoading && (
                        <div className="mt-3 text-sm text-white/40">
                            {filteredSpots.length} {filteredSpots.length !== 1 ? t('food.restaurantsFound') : t('food.restaurantFound')}
                            {selectedCity !== 'all' && ` in ${getCityDisplayName(selectedCity)}`}
                            {searchQuery && ` matching "${searchQuery}"`}
                        </div>
                    )}
                </div>

                {/* Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        [1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-80 bg-white/5 rounded-2xl animate-pulse" />
                        ))
                    ) : filteredSpots.length > 0 ? (
                        filteredSpots.map((spot, index) => (
                            <motion.div
                                key={spot.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="group bg-[#111111] rounded-2xl overflow-hidden border border-white/5 hover:border-[#d3da0c]/30 transition-all"
                            >
                                <div className="aspect-video overflow-hidden bg-white/5 relative">
                                    {spot.cover_image ? (
                                        <img
                                            src={spot.cover_image}
                                            alt={spot.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Utensils className="w-12 h-12 text-white/30" />
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-semibold text-[#d3da0c] border border-[#d3da0c]/20">
                                        {spot.cuisine_type || t('food.africanFood')}
                                    </div>
                                </div>

                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-1">{spot.name}</h3>
                                            <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                                                <MapPin className="w-3.5 h-3.5" />
                                                <span>{spot.city}</span>
                                            </div>
                                        </div>
                                        {spot.rating && (
                                            <div className="flex items-center gap-1 text-yellow-500">
                                                <Star className="w-4 h-4 fill-current" />
                                                <span className="font-bold">{spot.rating}</span>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-white/60 text-sm line-clamp-2 mb-4">
                                        {spot.description}
                                    </p>

                                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-white/40 text-sm">{spot.price_range || '¥¥'}</span>
                                        <button className="text-[#d3da0c] text-sm font-semibold hover:underline">
                                            {t('food.viewMenu')}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="col-span-full py-20 text-center">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Utensils className="w-10 h-10 text-white/30" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">
                                {searchQuery ? t('food.noRestaurantsSearch') : t('food.noRestaurants')}
                            </h3>
                            <p className="text-white/50">
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
                                    className="mt-4 px-4 py-2 bg-[#d3da0c] text-black rounded-lg font-medium hover:bg-[#bbc10b] transition-colors"
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
