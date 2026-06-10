import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, MapPin, Star, ChevronLeft, ShoppingCart, Phone, Mail, Globe, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useVendorMarketplaceStore } from '@/store/vendorMarketplaceStore';
import ProductCard from '@/components/ProductCard';
import VendorCart from '@/components/VendorCart';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface Product {
    id: number;
    name: string;
    price: number;
    description?: string;
    image_url?: string;
    stock_quantity?: number;
    status?: string;
    category?: string;
    is_featured?: boolean;
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
    rating?: number;
    reviews_count?: number;
    is_verified?: boolean;
    products?: Product[];
}

export default function VendorStore() {
    const { vendorId } = useParams<{ vendorId: string }>();
    const { session } = useAuthStore();
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const cartCount = useVendorMarketplaceStore((s) => s.getCartCount(vendorId || '0'));

    useEffect(() => {
        if (!vendorId) return;
        const fetchVendor = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${API_BASE_URL}/vendors/${vendorId}`);
                if (res.ok) {
                    const data = await res.json();
                    setVendor(data);
                }
            } catch {
                // silent
            } finally {
                setIsLoading(false);
            }
        };
        fetchVendor();
    }, [vendorId]);

    useEffect(() => {
        if (!vendor?.id || !session?.access_token) return;
        const checkFollow = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/social/following`, {
                    headers: { Authorization: `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setIsFollowing(data.vendors?.some((v: { id: number }) => v.id === vendor.id));
                }
            } catch {
                // ignore
            }
        };
        checkFollow();
    }, [vendor?.id, session?.access_token]);

    const categories = vendor?.products
        ? ['all', ...Array.from(new Set(vendor.products.map((p) => p.category).filter(Boolean)))]
        : ['all'];

    const filteredProducts =
        selectedCategory === 'all'
            ? vendor?.products || []
            : vendor?.products?.filter((p) => p.category === selectedCategory) || [];

    const featuredProducts = filteredProducts.filter((p) => p.is_featured);
    const regularProducts = filteredProducts.filter((p) => !p.is_featured);

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
                    <h2 className="text-2xl font-bold text-white mb-2">Vendor not found</h2>
                    <Link to="/marketplace" className="text-[#d3da0c] hover:underline">
                        Browse Marketplace
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-20 pb-24 bg-[#0A0A0A]">
            {/* Banner */}
            <div className="relative h-[250px] md:h-[300px]">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${vendor.banner_url || vendor.logo_url || '/default-avatar.png'})` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent" />
                </div>
                <div className="absolute top-4 left-4">
                    <Link
                        to="/marketplace"
                        className="flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Back
                    </Link>
                </div>
            </div>

            {/* Profile Info */}
            <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-10">
                <div className="flex items-end gap-4 mb-4">
                    <div className="w-24 h-24 rounded-2xl bg-gray-800 border-4 border-[#0A0A0A] overflow-hidden flex-shrink-0">
                        {vendor.logo_url ? (
                            <img src={vendor.logo_url} alt={vendor.business_name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Store className="w-10 h-10 text-gray-600" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl md:text-3xl font-bold text-white">{vendor.business_name}</h1>
                            {vendor.is_verified && (
                                <span className="px-2 py-0.5 bg-[#d3da0c]/20 text-[#d3da0c] text-xs font-medium rounded-full">Verified</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            {vendor.vendor_type && (
                                <span className="text-gray-400 text-sm capitalize">{vendor.vendor_type}</span>
                            )}
                            {vendor.city && (
                                <span className="flex items-center gap-1 text-gray-400 text-sm">
                                    <MapPin className="w-3 h-3" /> {vendor.city}
                                </span>
                            )}
                            {vendor.rating && vendor.rating > 0 && (
                                <span className="flex items-center gap-1 text-yellow-400 text-sm">
                                    <Star className="w-3 h-3 fill-current" /> {vendor.rating.toFixed(1)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mb-6">
                    {session?.access_token && (
                        <button
                            onClick={async () => {
                                try {
                                    const res = await fetch(`${API_BASE_URL}/social/vendors/${vendor.id}/follow`, {
                                        method: isFollowing ? 'DELETE' : 'POST',
                                        headers: { Authorization: `Bearer ${session.access_token}` }
                                    });
                                    if (res.ok) {
                                        setIsFollowing(!isFollowing);
                                        toast.success(isFollowing ? 'Unfollowed' : 'Following');
                                    }
                                } catch {
                                    toast.error('Failed');
                                }
                            }}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                                isFollowing
                                    ? 'bg-white/10 text-white hover:bg-white/20'
                                    : 'bg-[#d3da0c] text-black hover:bg-[#c4cb0b]'
                            }`}
                        >
                            <Heart className={`w-4 h-4 ${isFollowing ? 'fill-current' : ''}`} />
                            {isFollowing ? 'Following' : 'Follow'}
                        </button>
                    )}
                    <button
                        onClick={() => setCartOpen(true)}
                        className="relative px-4 py-2 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition-colors flex items-center gap-2"
                    >
                        <ShoppingCart className="w-4 h-4" />
                        Cart
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#d3da0c] text-black text-xs font-bold rounded-full flex items-center justify-center">
                                {cartCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Contact Info */}
                <div className="flex flex-wrap gap-4 mb-6 text-gray-400 text-sm">
                    {vendor.phone && (
                        <a href={`tel:${vendor.phone}`} className="flex items-center gap-1 hover:text-white">
                            <Phone className="w-3 h-3" /> {vendor.phone}
                        </a>
                    )}
                    {vendor.email && (
                        <a href={`mailto:${vendor.email}`} className="flex items-center gap-1 hover:text-white">
                            <Mail className="w-3 h-3" /> {vendor.email}
                        </a>
                    )}
                    {vendor.website && (
                        <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white">
                            <Globe className="w-3 h-3" /> Website
                        </a>
                    )}
                </div>

                {/* Categories */}
                {categories.length > 1 && (
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                                    selectedCategory === cat
                                        ? 'bg-[#d3da0c] text-black'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}

                {/* Featured Products */}
                {featuredProducts.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-white font-semibold mb-3">Featured</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {featuredProducts.map((product) => (
                                <ProductCard key={product.id} product={product} vendorId={vendor.id} />
                            ))}
                        </div>
                    </div>
                )}

                {/* All Products */}
                <div>
                    <h2 className="text-white font-semibold mb-3">Menu</h2>
                    {regularProducts.length === 0 ? (
                        <p className="text-gray-500">No products available.</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {regularProducts.map((product) => (
                                <ProductCard key={product.id} product={product} vendorId={vendor.id} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Drawer */}
            <VendorCart
                vendorId={vendor.id}
                vendorName={vendor.business_name}
                isOpen={cartOpen}
                onClose={() => setCartOpen(false)}
            />
        </div>
    );
}
