import { motion } from 'framer-motion';
import { Plus, Minus, ShoppingCart, ImageOff } from 'lucide-react';
import { useState } from 'react';
import { useVendorMarketplaceStore } from '@/store/vendorMarketplaceStore';

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

interface ProductCardProps {
    product: Product;
    vendorId: number;
    compact?: boolean;
    vendorName?: string;
    onAddToCart?: () => void;
}

export default function ProductCard({ product, vendorId, compact = false, vendorName, onAddToCart }: ProductCardProps) {
    const [qty, setQty] = useState(1);
    const addToCart = useVendorMarketplaceStore((s) => s.addToCart);
    const [added, setAdded] = useState(false);

    const isOutOfStock = product.stock_quantity !== undefined && product.stock_quantity <= 0;
    const isInactive = product.status === 'inactive' || product.status === 'sold_out';

    const handleAdd = () => {
        if (isOutOfStock || isInactive) return;
        addToCart(vendorId, {
            product_id: product.id,
            name: product.name,
            price: product.price,
            image_url: product.image_url,
            quantity: qty,
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
        setQty(1);
        onAddToCart?.();
    };

    if (compact) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden">
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <ImageOff className="w-6 h-6 text-gray-600" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium text-sm truncate">{product.name}</h4>
                    <p className="text-[#d3da0c] font-bold">¥{product.price}</p>
                </div>
                <button
                    onClick={handleAdd}
                    disabled={isOutOfStock || isInactive}
                    className={`p-2 rounded-lg transition-colors ${
                        added
                            ? 'bg-green-500/20 text-green-400'
                            : isOutOfStock || isInactive
                            ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                            : 'bg-[#d3da0c]/20 text-[#d3da0c] hover:bg-[#d3da0c]/30'
                    }`}
                >
                    <ShoppingCart className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-[#d3da0c]/30 transition-colors"
        >
            <div className="aspect-square bg-gray-800 overflow-hidden relative">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="w-10 h-10 text-gray-600" />
                    </div>
                )}
                {(isOutOfStock || isInactive) && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-bold text-sm px-3 py-1 bg-red-500/80 rounded-full">Out of Stock</span>
                    </div>
                )}
            </div>
            <div className="p-4">
                <h3 className="text-white font-semibold truncate">{product.name}</h3>
                {vendorName && (
                    <p className="text-gray-500 text-xs mt-0.5">{vendorName}</p>
                )}
                {product.description && (
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                    <span className="text-[#d3da0c] font-bold text-lg">¥{product.price}</span>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white/10 rounded-lg">
                            <button
                                onClick={() => setQty(Math.max(1, qty - 1))}
                                className="p-1.5 text-gray-400 hover:text-white"
                            >
                                <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-white text-sm">{qty}</span>
                            <button
                                onClick={() => setQty(qty + 1)}
                                className="p-1.5 text-gray-400 hover:text-white"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        </div>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handleAdd}
                            disabled={isOutOfStock || isInactive}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                added
                                    ? 'bg-green-500 text-white'
                                    : isOutOfStock || isInactive
                                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                    : 'bg-[#d3da0c] text-black hover:bg-[#c4cb0b]'
                            }`}
                        >
                            {added ? 'Added' : 'Add'}
                        </motion.button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
