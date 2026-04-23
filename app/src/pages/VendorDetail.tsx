import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, MapPin, Star, Globe, Mail, Phone, ChevronLeft, Heart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import VerificationBadge from '@/components/VerificationBadge';

interface Product {
  id: number;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  stock_quantity?: number;
}

interface Vendor {
  id: number;
  business_name: string;
  description?: string;
  vendor_type?: string;
  logo_url?: string;
  banner_url?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  wechat?: string;
  rating?: number;
  reviews_count?: number;
  is_verified?: boolean;
  is_featured?: boolean;
  products?: Product[];
}

export default function VendorDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { session } = useAuthStore();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchVendor = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/vendors/${id}`);
        if (res.ok) {
          const data = await res.json();
          setVendor(data);
        } else {
          setVendor(null);
        }
      } catch {
        setVendor(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVendor();
  }, [id]);

  // Update meta tags for social sharing
  useEffect(() => {
    if (!vendor) return;
    const title = `${vendor.business_name} - Sound It`;
    const description = (vendor.description || 'Discover amazing vendors on Sound It.').slice(0, 300);
    const image = vendor.logo_url || vendor.banner_url || `${window.location.origin}/logo.png`;
    const url = `${window.location.origin}/vendors/${id}`;

    document.title = title;
    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        const prop = selector.match(/property=["']([^"']+)["']/)?.[1];
        const name = selector.match(/name=["']([^"']+)["']/)?.[1];
        if (prop) el.setAttribute('property', prop);
        if (name) el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:image"]', image);
    setMeta('meta[property="og:url"]', url);
    setMeta('meta[property="og:type"]', 'profile');
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    setMeta('meta[name="twitter:image"]', image);
  }, [vendor, id]);

  useEffect(() => {
    if (!vendor?.id || !session?.access_token) return;
    const checkFollow = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/social/following`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const followedVendors = data.vendors || [];
          setIsFollowing(followedVendors.some((v: { id: number }) => v.id === vendor.id));
        }
      } catch {
        // ignore
      }
    };
    checkFollow();
  }, [vendor?.id, session?.access_token]);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#d3da0c] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <Store className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t('vendorDetail.notFound') || 'Vendor not found'}</h2>
          <Link to="/vendors" className="text-[#d3da0c] hover:underline">
            {t('vendorDetail.browseVendors') || 'Browse vendors'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-24">
      {/* Hero */}
      <div className="relative h-[300px] md:h-[400px]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${vendor.banner_url || vendor.logo_url || '/default-avatar.png'})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent" />
        </div>

        <div className="absolute top-6 left-4 md:left-8">
          <Link
            to="/vendors"
            className="flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            {t('vendorDetail.back') || 'Back'}
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-4">
                <h1 className="text-4xl md:text-5xl font-display text-white">{vendor.business_name}</h1>
                {vendor.is_verified && <VerificationBadge size="lg" className="flex-shrink-0" />}
              </div>

              <div className="flex flex-wrap items-center gap-4 mb-6">
                {vendor.vendor_type && (
                  <span className="px-3 py-1 bg-white/10 rounded-full text-white text-sm capitalize">
                    {vendor.vendor_type}
                  </span>
                )}
                {vendor.city && (
                  <div className="flex items-center gap-1 text-gray-300">
                    <MapPin className="w-4 h-4" />
                    {vendor.city}
                  </div>
                )}
                {vendor.rating && vendor.rating > 0 && (
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Star className="w-4 h-4 fill-current" />
                    <span>{vendor.rating.toFixed(1)}</span>
                    <span className="text-gray-400">({vendor.reviews_count || 0} {t('vendorDetail.reviews') || 'reviews'})</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4">
                {session?.access_token && (
                  <button
                    onClick={async () => {
                      if (!vendor?.id) return;
                      setFollowLoading(true);
                      try {
                        if (isFollowing) {
                          const res = await fetch(`${API_BASE_URL}/social/vendors/${vendor.id}/follow`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${session.access_token}` }
                          });
                          if (res.ok) {
                            setIsFollowing(false);
                            toast.success(t('vendorDetail.unfollowed') || 'Unfollowed');
                          }
                        } else {
                          const res = await fetch(`${API_BASE_URL}/social/vendors/${vendor.id}/follow`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${session.access_token}` }
                          });
                          if (res.ok) {
                            setIsFollowing(true);
                            toast.success(t('vendorDetail.followed') || 'Following');
                          } else {
                            const err = await res.json();
                            toast.error(err.detail || t('vendorDetail.followFailed') || 'Failed');
                          }
                        }
                      } catch {
                        toast.error(t('vendorDetail.followFailed') || 'Failed');
                      } finally {
                        setFollowLoading(false);
                      }
                    }}
                    disabled={followLoading}
                    className={`px-8 py-4 font-bold rounded-xl transition-colors flex items-center gap-2 ${
                      isFollowing
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30'
                    } disabled:opacity-50`}
                  >
                    <Heart className={`w-5 h-5 ${isFollowing ? 'fill-current' : ''}`} />
                    {isFollowing ? (t('vendorDetail.following') || 'Following') : (t('vendorDetail.follow') || 'Follow')}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">{t('vendorDetail.about') || 'About'}</h2>
              <p className="text-gray-300 leading-relaxed">{vendor.description || t('vendorDetail.noDescription') || 'No description available.'}</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-4">{t('vendorDetail.products') || 'Products'}</h2>
              {vendor.products && vendor.products.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {vendor.products.map((product) => (
                    <div key={product.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4">
                      <div className="w-20 h-20 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Store className="w-8 h-8 text-white/20" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold truncate">{product.name}</h3>
                        <p className="text-[#d3da0c] font-bold">¥{product.price}</p>
                        {product.stock_quantity !== undefined && (
                          <p className="text-gray-500 text-xs">{t('vendorDetail.inStock') || 'In stock'}: {product.stock_quantity}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">{t('vendorDetail.noProducts') || 'No products listed yet.'}</p>
              )}
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">{t('vendorDetail.contact') || 'Contact'}</h3>
              <div className="space-y-3">
                {vendor.email && (
                  <a href={`mailto:${vendor.email}`} className="flex items-center gap-3 text-gray-300 hover:text-white">
                    <Mail className="w-5 h-5 text-gray-500" />
                    {vendor.email}
                  </a>
                )}
                {vendor.phone && (
                  <a href={`tel:${vendor.phone}`} className="flex items-center gap-3 text-gray-300 hover:text-white">
                    <Phone className="w-5 h-5 text-gray-500" />
                    {vendor.phone}
                  </a>
                )}
                {vendor.website && (
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-300 hover:text-white">
                    <Globe className="w-5 h-5 text-gray-500" />
                    {t('vendorDetail.visitWebsite') || 'Website'}
                  </a>
                )}
                {vendor.address && (
                  <div className="flex items-center gap-3 text-gray-300">
                    <MapPin className="w-5 h-5 text-gray-500" />
                    {vendor.address}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
