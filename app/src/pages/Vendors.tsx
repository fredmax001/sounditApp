import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Store, Star, MapPin } from 'lucide-react';
import VerificationBadge from '@/components/VerificationBadge';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { slugify } from '@/lib/slug';
import { chinaCities } from '@/data/constants';
import { queryCache, isAbortError } from '@/lib/queryCache';
import { useDebouncedValue } from '@/hooks/useDebounce';

interface Vendor {
  id: number;
  slug?: string;
  business_name: string;
  description: string;
  vendor_type: string;
  logo_url: string;
  city: string;
  rating: number;
  reviews_count: number;
  is_verified: boolean;
  is_featured: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

export default function Vendors() {
  const { t } = useTranslation();
  const { selectedCity, setSelectedCity } = useAuthStore();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 200);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVendors = useCallback(async () => {
    const cityKey = queryCache.normalizeCity(selectedCity);
    const cacheKey = `vendors:list:${cityKey}`;
    const cached = queryCache.get<Vendor[]>(cacheKey);
    if (cached !== null) {
      setVendors(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (cityKey !== 'all') params.city = cityKey;
      const data = await queryCache.fetchJson<Vendor[]>(
        cacheKey,
        `${API_URL}/vendors`,
        { params, ttlMs: 45_000, scope: 'city:vendors-list' }
      );
      setVendors(data || []);
    } catch (e) {
      if (isAbortError(e)) return;
      console.error('Error fetching vendors');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCity]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const filteredVendors = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v) =>
        v.business_name?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.vendor_type?.toLowerCase().includes(q)
    );
  }, [vendors, debouncedSearch]);

  return (
    <div className="min-h-dvh bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white transition-colors duration-200">
      {/* Header */}
      <section
        className="sticky z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-md border-b border-black/8 dark:border-white/5 transition-[top] duration-200"
        style={{ top: 'var(--mobile-header-offset, 0px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display text-[#020b00] dark:text-white">
                {t('vendors.title') || 'Vendors'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm hidden md:block mt-1 max-w-2xl">
                {t('vendors.subtitle') || 'Discover vendors and merchants for your events.'}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('vendors.searchPlaceholder') || 'Search vendors...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-[#020b00] dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none"
                />
              </div>
              <div className="relative shrink-0">
                <select
                  value={selectedCity || 'all'}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  aria-label="Filter vendors by city"
                  className="bg-neutral-100 dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-[#020b00] dark:text-white text-sm font-medium focus:outline-none focus:border-[#020b00] dark:focus:border-[#d3da0c]/50 cursor-pointer"
                >
                  {chinaCities.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-[#141414] text-[#020b00] dark:text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vendors Grid */}
      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-neutral-100 dark:bg-white/5 rounded-2xl h-80 animate-pulse" />
              ))}
            </div>
          ) : filteredVendors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVendors.map((vendor) => (
                <Link
                  key={vendor.id}
                  to={`/vendors/${vendor.slug || slugify(vendor.business_name) || vendor.id}`}
                  className="group bg-white dark:bg-white/5 border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden hover:border-[#020b00]/30 dark:hover:border-[#d3da0c]/30 transition-all shadow-sm dark:shadow-none"
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 relative overflow-hidden">
                    {vendor.logo_url ? (
                      <img
                        src={vendor.logo_url}
                        alt={vendor.business_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store className="w-16 h-16 text-gray-400 dark:text-white/20" />
                      </div>
                    )}
                    {vendor.is_featured && (
                      <span className="absolute top-3 left-3 px-2 py-1 bg-[#d3da0c] text-black text-xs font-bold rounded">
                        {t('vendors.featured') || 'Featured'}
                      </span>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-[#020b00] dark:text-white font-semibold truncate">{vendor.business_name}</h3>
                      {vendor.is_verified && <VerificationBadge size="sm" />}
                    </div>

                    <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">{vendor.description}</p>

                    <div className="flex items-center gap-3 text-sm">
                      {vendor.city && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3.5 h-3.5" />
                          {vendor.city}
                        </span>
                      )}
                      {vendor.rating > 0 && (
                        <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 font-medium">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {vendor.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-24">
              <Store className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[#020b00] dark:text-white mb-2">
                {t('vendors.noResults') || 'No vendors found'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('vendors.tryDifferentSearch') || 'Try a different search term.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
