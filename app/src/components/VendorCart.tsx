import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Trash2, Plus, Minus, ArrowRight } from 'lucide-react';
import { useVendorMarketplaceStore } from '@/store/vendorMarketplaceStore';
import { useNavigate } from 'react-router-dom';

interface VendorCartProps {
    vendorId: number;
    vendorName: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function VendorCart({ vendorId, vendorName, isOpen, onClose }: VendorCartProps) {
    const cart = useVendorMarketplaceStore((s) => s.getCart(vendorId));
    const removeFromCart = useVendorMarketplaceStore((s) => s.removeFromCart);
    const updateQty = useVendorMarketplaceStore((s) => s.updateQty);
    const getCartTotal = useVendorMarketplaceStore((s) => s.getCartTotal);
    const clearCart = useVendorMarketplaceStore((s) => s.clearCart);
    const navigate = useNavigate();

    const total = getCartTotal(vendorId);

    const handleCheckout = () => {
        onClose();
        navigate(`/checkout/vendor/${vendorId}`);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#0f0f0f] border-l border-white/10 flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-[#d3da0c]" />
                                <div>
                                    <h2 className="text-white font-semibold">Your Cart</h2>
                                    <p className="text-gray-500 text-xs">{vendorName}</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                                    <p>Your cart is empty</p>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div
                                        key={item.product_id}
                                        className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3"
                                    >
                                        <div className="w-14 h-14 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No img</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium truncate">{item.name}</p>
                                            <p className="text-[#d3da0c] text-sm">¥{item.price}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center bg-white/10 rounded-lg">
                                                <button
                                                    onClick={() => updateQty(vendorId, item.product_id, item.quantity - 1)}
                                                    className="p-1.5 text-gray-400 hover:text-white"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="w-6 text-center text-white text-sm">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQty(vendorId, item.product_id, item.quantity + 1)}
                                                    className="p-1.5 text-gray-400 hover:text-white"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(vendorId, item.product_id)}
                                                className="p-1.5 text-gray-500 hover:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        {cart.length > 0 && (
                            <div className="p-4 border-t border-white/10 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">Total</span>
                                    <span className="text-white text-xl font-bold">¥{total.toFixed(2)}</span>
                                </div>
                                <button
                                    onClick={handleCheckout}
                                    className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#c4cb0b] transition-colors flex items-center justify-center gap-2"
                                >
                                    Checkout <ArrowRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => clearCart(vendorId)}
                                    className="w-full py-2 text-gray-500 text-sm hover:text-red-400 transition-colors"
                                >
                                    Clear Cart
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
