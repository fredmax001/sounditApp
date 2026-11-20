import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Minus, Plus, ArrowRight, ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

export default function Cart() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { items, updateQuantity, removeFromCart, clearCart, getCartTotal } = useCartStore();
    const { isAuthenticated } = useAuthStore();

    const total = getCartTotal();

    const handleQuantityChange = (itemId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            removeFromCart(itemId);
            toast.success(t('cart.itemRemoved'));
        } else {
            updateQuantity(itemId, newQuantity);
        }
    };

    const handleCheckout = (eventId: string) => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: `/cart` } });
            return;
        }

        // Find the cart item for this event
        const cartItem = items.find(item => String(item.eventId) === String(eventId));
        if (cartItem) {
            navigate(`/checkout/${eventId}`, {
                state: {
                    tierId: cartItem.selectedTier,
                    ticketCount: cartItem.quantity
                }
            });
        } else {
            navigate(`/checkout/${eventId}`);
        }
    };

    if (items.length === 0) {
        return (
            <div className="min-h-dvh bg-[#020b00] pt-20 lg:pt-24">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="text-center">
                        <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold text-white mb-2">{t('cart.emptyTitle')}</h1>
                        <p className="text-gray-400 mb-8">{t('cart.emptySubtitle')}</p>
                        <Link
                            to="/events"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-xl hover:bg-[#d3da0c]/90 transition-colors"
                        >
                            {t('cart.browseEvents')}
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-[#020b00] pt-20 lg:pt-24 pb-[calc(3rem+env(safe-area-inset-bottom,0px))]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between gap-3 mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">{t('cart.title')}</h1>
                    <button
                        onClick={() => {
                            clearCart();
                            toast.success(t('cart.cartCleared'));
                        }}
                        className="text-red-400 hover:text-red-300 text-sm font-medium shrink-0"
                    >
                        {t('cart.clearCart')}
                    </button>
                </div>

                <div className="space-y-6">
                    {items.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#141414] rounded-2xl p-4 sm:p-6 border border-white/5"
                        >
                            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                                <div className="flex gap-4 flex-1 min-w-0">
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        className="w-20 h-20 rounded-xl object-cover shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-semibold text-base sm:text-lg mb-1 break-words">{item.title}</h3>
                                        <p className="text-[#d3da0c] font-medium mb-2 truncate">{item.tierName}</p>
                                        <p className="text-gray-400 text-sm">¥{item.price} {t('cart.each')}</p>
                                    </div>
                                </div>
                                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="text-white font-medium min-w-[2rem] text-center">{item.quantity}</span>
                                        <button
                                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                            disabled={item.quantity >= item.maxPerOrder}
                                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white font-semibold">¥{item.price * item.quantity}</p>
                                        <button
                                            onClick={() => {
                                                removeFromCart(item.id);
                                                toast.success(t('cart.itemRemoved'));
                                            }}
                                            className="text-red-400 hover:text-red-300 text-sm mt-1"
                                        >
                                            {t('cart.remove')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <button
                                    onClick={() => handleCheckout(item.eventId)}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-xl hover:bg-[#d3da0c]/90 transition-colors"
                                >
                                    {t('cart.checkoutForEvent')}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-8 bg-[#141414] rounded-2xl p-6 border border-white/5">
                    <div className="flex justify-between items-center text-lg font-semibold">
                        <span className="text-white">{t('cart.total')}</span>
                        <span className="text-[#d3da0c]">¥{total}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}