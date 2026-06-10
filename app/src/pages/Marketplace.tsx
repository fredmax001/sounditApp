import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Store, MapPin, Loader2, ShoppingBag } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import VendorCart from '@/components/VendorCart';
import { useVendorMarketplaceStore } from '@/store/vendorMarketplaceStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface Vendor {
    id: number;
    business_name: string;
    vendor_type?: string;
    logo_url?: string;
    city?: string;
    rating?: number;
    is_verified?: boolean;
}

interface Product {
    id: number;
    name: string;
    price: number;
    image_url?: string;
    vendor_id: number;
    vendor_name?: string;
    vendor_logo?: string;
    vendor_city?: string;
    vendor_verified?: boolean;
    category?: string;
    is_featured?: boolean;
}

export default function Marketplace() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'products' | 'vendors'>('products');
    const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
    const [cartOpen, setCartOpen] = useState(false);
    const cartCount = useVendorMarketplaceStore((s) =>
        selectedVendorId ? s.getCartCount(selectedVendorId) : 0
    );

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch vendors list
                const vRes = await fetch(`${API_BASE_URL}/vendors?limit=100`);
                if (vRes.ok) {
                    const vData = await vRes.json();
                    setVendors(vData || []);
                }

                // Fetch ALL products in one call (new bulk endpoint)
                const pRes = await fetch(`${API_BASE_URL}/vendors/products/all?limit=500`);
                if (pRes.ok) {
                    const pData = await pRes.json();
                    setProducts(pData.products || []);
                }
            } catch {
                // silent
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredProducts = products.filter(
        (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.vendor_name && p.vendor_name.toLowerCase().includes(search.toLowerCase())) ||
            (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
    );

    const filteredVendors = vendors.filter(
        (v) =>
            v.business_name.toLowerCase().includes(search.toLowerCase()) ||
            (v.vendor_type && v.vendor_type.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="min-h-screen pt-20 pb-24 bg-[#0A0A0A]">
            <div className="max-w-6xl mx-auto px-4">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-white text-3xl font-bold mb-2">Marketplace</h1>
                    <p className="text-gray-400">Browse products from local vendors</p>
                </div>

                {/* Search & Toggle */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search products or vendors..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:border-[#d3da0c]/40 focus:outline-none"
                        />
                    </div>
                    <div className="flex bg-white/5 rounded-xl p-1">
                        <button
                            onClick={() => setView('products')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                view === 'products' ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Products
                        </button>
                        <button
                            onClick={() => setView('vendors')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                view === 'vendors' ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Vendors
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                    </div>
                ) : view === 'products' ? (
                    <>
                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-20">
                                <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-500">No products found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {filteredProducts.map((product) => (
                                    <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        <ProductCard
                                            product={{
                                                id: product.id,
                                                name: product.name,
                                                price: product.price,
                                                image_url: product.image_url,
                                                category: product.category,
                                                is_featured: product.is_featured,
                                            }}
                                            vendorId={product.vendor_id}
                                            vendorName={product.vendor_name}
                                            onAddToCart={() => setSelectedVendorId(product.vendor_id)}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {filteredVendors.length === 0 ? (
                            <div className="text-center py-20">
                                <Store className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-500">No vendors found</p>
                            </div>
                        ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredVendors.map((vendor) => (
                                    <Link
                                        key={vendor.id}
                                        to={`/store/${vendor.id}`}
                                        className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-[#d3da0c]/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-14 h-14 rounded-xl bg-gray-800 overflow-hidden flex-shrink-0">
                                                {vendor.logo_url ? (
                                                    <img src={vendor.logo_url} alt={vendor.business_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Store className="w-6 h-6 text-gray-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-white font-semibold truncate">{vendor.business_name}</h3>
                                                {vendor.vendor_type && (
                                                    <p className="text-gray-400 text-sm capitalize">{vendor.vendor_type}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            {vendor.city && (
                                                <span className="flex items-center gap-1 text-gray-500">
                                                    <MapPin className="w-3 h-3" /> {vendor.city}
                                                </span>
                                            )}
                                            {vendor.is_verified && (
                                                <span className="text-[#d3da0c] text-xs font-medium">Verified</span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Global Cart Drawer — shows for whichever vendor was last interacted with */}
            {selectedVendorId && (
                <VendorCart
                    vendorId={selectedVendorId}
                    vendorName={vendors.find((v) => v.id === selectedVendorId)?.business_name || 'Vendor'}
                    isOpen={cartOpen}
                    onClose={() => setCartOpen(false)}
                />
            )}
        </div>
    );
}
