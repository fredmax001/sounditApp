import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, MapPin, Star, Globe, Mail, Phone, ChevronLeft, Heart, Loader2, MessageCircle, Share2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import VerificationBadge from '@/components/VerificationBadge';
import ReviewsSection from '@/components/ReviewsSection';
import MessageModal from '@/components/MessageModal';
import UniversalShareModal from '@/components/ui/UniversalShareModal';
import { slugify } from '@/lib/slug';

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
  slug?: string;
  user_id: number;
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
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchVendor = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/vendors/${id}`);
        if (res.ok) {
          const data = await res.json();
          setVendor(data);
          const canonicalSlug = data.slug || slugify(data.business_name);
          if (canonicalSlug && id !== canonicalSlug) {
            window.history.replaceState(null, '', `/vendors/${canonicalSlug}`);
          }
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
      <div className="min-h-dvh pt-20 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#d3da0c] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-dvh pt-20 flex items-center justify-center bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white">
        <div className="text-center">
          <Store className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#020b00] dark:text-white mb-2">{t('vendorDetail.notFound') || 'Vendor not found'}</h2>
          <Link to="/vendors" className="text-[#020b00] dark:text-[#d3da0c] font-semibold hover:underline">
            {t('vendorDetail.browseVendors') || 'Browse vendors'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pt-20 pb-24 bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white transition-colors duration-200">
      {/* Hero */}
      <div className="relative h-[300px] md:h-[400px] overflow-hidden bg-neutral-900 dark:bg-[#141414]">
        {vendor.banner_url || vendor.logo_url ? (
          <img
            src={vendor.banner_url || vendor.logo_url}
            alt={vendor.business_name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#d3da0c]/15 via-transparent to-white dark:to-[#020b00]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-[#020b00] dark:via-[#020b00]/60 dark:to-black/25" />

        <div className="absolute top-6 left-4 md:left-8">
          <Link
            to="/vendors"
            className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-black/50 backdrop-blur-md rounded-full text-[#020b00] dark:text-white border border-black/10 dark:border-white/10 hover:bg-white dark:hover:bg-black/70 transition-colors shadow-xs"
          >
            <ChevronLeft className="w-5 h-5" />
            {t('vendorDetail.back') || 'Back'}
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-4">
                <h1 className="text-4xl md:text-5xl font-display text-[#020b00] dark:text-white">{vendor.business_name}</h1>
                {(vendor.is_verified || (vendor as any).verification_badge) && <VerificationBadge size="lg" className="flex-shrink-0" />}
              </div>

              <div className="flex flex-wrap items-center gap-4 mb-6">
                {vendor.vendor_type && (
                  <span className="px-3 py-1 bg-black/5 dark:bg-white/10 border border-black/8 dark:border-transparent rounded-full text-[#020b00] dark:text-white text-sm capitalize font-medium">
                    {vendor.vendor_type}
                  </span>
                )}
                {vendor.city && (
                  <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300 font-medium">
                    <MapPin className="w-4 h-4" />
                    {vendor.city}
                  </div>
                )}
                {vendor.rating && vendor.rating > 0 && (
                  <div className="flex items-center gap-1 text-yellow-500 dark:text-yellow-400 font-semibold">
                    <Star className="w-4 h-4 fill-current" />
                    <span>{vendor.rating.toFixed(1)}</span>
                    <span className="text-gray-600 dark:text-gray-400">({vendor.reviews_count || 0} {t('vendorDetail.reviews') || 'reviews'})</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4">
                {vendor?.products && vendor.products.length > 0 && (
                  <Link
                    to={`/vendor-store/${vendor.id}`}
                    className="px-8 py-4 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold rounded-xl hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    {t('vendorDetail.orderNow') || 'Order Now'}
                  </Link>
                )}
                {session?.access_token && vendor?.user_id && (
                  <button
                    onClick={() => setShowMessageModal(true)}
                    className="px-8 py-4 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold rounded-xl hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Message
                  </button>
                )}
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
                        ? 'bg-neutral-100 text-[#020b00] dark:bg-white/10 dark:text-white hover:bg-neutral-200 dark:hover:bg-white/20'
                        : 'bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400 hover:bg-pink-500/20'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isFollowing ? 'fill-current' : ''}`} />
                    {isFollowing ? (t('vendorDetail.following') || 'Following') : (t('vendorDetail.follow') || 'Follow')}
                  </button>
                )}
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="px-8 py-4 bg-neutral-100 dark:bg-white/10 text-[#020b00] dark:text-white font-bold rounded-xl hover:bg-neutral-200 dark:hover:bg-white/20 transition-colors flex items-center gap-2 border border-black/5 dark:border-white/5"
                >
                  <Share2 className="w-5 h-5 text-[#020b00] dark:text-[#d3da0c]" />
                  <span>Share</span>
                </button>
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
            <section className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-6 shadow-xs dark:shadow-none">
              <h2 className="text-xl font-bold text-[#020b00] dark:text-white mb-4">{t('vendorDetail.about') || 'About'}</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{vendor.description || t('vendorDetail.noDescription') || 'No description available.'}</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-[#020b00] dark:text-white mb-4">{t('vendorDetail.products') || 'Products'}</h2>
              {vendor.products && vendor.products.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {vendor.products.map((product) => (
                    <div key={product.id} className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-xl p-4 flex gap-4 shadow-xs dark:shadow-none">
                      <div className="w-20 h-20 rounded-lg bg-neutral-100 dark:bg-gray-800 flex-shrink-0 overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Store className="w-8 h-8 text-gray-400 dark:text-white/20" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[#020b00] dark:text-white font-semibold truncate">{product.name}</h3>
                        <p className="text-[#020b00] dark:text-[#d3da0c] font-bold">¥{product.price}</p>
                        {product.stock_quantity !== undefined && (
                          <p className="text-gray-500 text-xs">{t('vendorDetail.inStock') || 'In stock'}: {product.stock_quantity}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">{t('vendorDetail.noProducts') || 'No products listed yet.'}</p>
              )}
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-6 shadow-xs dark:shadow-none">
              <h3 className="text-[#020b00] dark:text-white font-bold mb-4">{t('vendorDetail.contact') || 'Contact'}</h3>
              <div className="space-y-3">
                {vendor.email && (
                  <a href={`mailto:${vendor.email}`} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-[#020b00] dark:hover:text-white transition-colors">
                    <Mail className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    {vendor.email}
                  </a>
                )}
                {vendor.phone && (
                  <a href={`tel:${vendor.phone}`} className="flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-[#020b00] dark:hover:text-white transition-colors">
                    <Phone className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    {vendor.phone}
                  </a>
                )}
                {vendor.website && (
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-[#020b00] dark:hover:text-white transition-colors">
                    <Globe className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    {t('vendorDetail.visitWebsite') || 'Website'}
                  </a>
                )}
                {vendor.address && (
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <MapPin className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    {vendor.address}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-12">
          <ReviewsSection entityId={vendor.id} entityType="vendor" entityName={vendor.business_name} />
        </div>
      </div>

      {/* Message Modal */}
      <MessageModal
        recipientId={vendor.user_id}
        recipientName={vendor.business_name}
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
      />

      {/* Universal Share Modal */}
      {isShareModalOpen && vendor && (
        <UniversalShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          item={{
            type: 'vendor',
            id: vendor.id,
            slug: vendor.slug || slugify(vendor.business_name),
            title: vendor.business_name,
            subtitle: (vendor.vendor_type || 'Vendor').toUpperCase(),
            image: vendor.logo_url || vendor.banner_url || (vendor as any).user?.avatar_url,
            location: vendor.city || vendor.address,
            description: vendor.description,
            rating: vendor.rating
          }}
        />
      )}
    </div>
  );
}
