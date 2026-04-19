import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Store, Star, MapPin } from 'lucide-react';
import VerificationBadge from '@/components/VerificationBadge';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import axios from 'axios';

interface Vendor {
  id: number;
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function Vendors() {
  const { t } = useTranslation();
  const { selectedCity } = useAuthStore();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedCity) params.city = selectedCity;
      const { data } = await axios.get(`${API_URL}/vendors`, { params });
      setVendors(data || []);
    } catch {
      console.error('Error fetching vendors');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCity]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const filteredVendors = vendors.filter(
    (v) =>
      v.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vendor_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-20 lg:pt-24">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('vendors.title') || 'Vendors'}
          </h1>
          <p className="text-white/50 text-lg max-w-2xl">
            {t('vendors.subtitle') || 'Discover vendors and merchants for your events.'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('vendors.searchPlaceholder') || 'Search vendors...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white/5 rounded-2xl h-80 animate-pulse" />
              ))}
            </div>
          ) : filteredVendors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVendors.map((vendor) => (
                <Link
                  key={vendor.id}
                  to={`/vendors/${vendor.id}`}
                  className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-[#d3da0c]/30 transition-all"
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden">
                    {vendor.logo_url ? (
                      <img
                        src={vendor.logo_url}
                        alt={vendor.business_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store className="w-16 h-16 text-white/20" />
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
                      <h3 className="text-white font-semibold truncate">{vendor.business_name}</h3>
                      {vendor.is_verified && <VerificationBadge size="sm" />}
                    </div>

                    <p className="text-gray-400 text-sm line-clamp-2 mb-3">{vendor.description}</p>

                    <div className="flex items-center gap-3 text-sm">
                      {vendor.city && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3.5 h-3.5" />
                          {vendor.city}
                        </span>
                      )}
                      {vendor.rating > 0 && (
                        <span className="flex items-center gap-1 text-yellow-400">
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
              <Store className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {t('vendors.noResults') || 'No vendors found'}
              </h3>
              <p className="text-gray-400">
                {t('vendors.tryDifferentSearch') || 'Try a different search term.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
