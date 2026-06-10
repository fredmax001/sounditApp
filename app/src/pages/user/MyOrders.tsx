import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, ChevronRight, Loader2, Package } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVendorMarketplaceStore } from '@/store/vendorMarketplaceStore';
import OrderStatusTracker from '@/components/OrderStatusTracker';

export default function MyOrders() {
    const { session } = useAuthStore();
    const { orders, fetchOrders, isLoading } = useVendorMarketplaceStore();
    const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

    useEffect(() => {
        if (session?.access_token) {
            fetchOrders(session.access_token);
        }
    }, [session, fetchOrders]);

    const filtered = orders.filter((o) => {
        if (filter === 'all') return true;
        if (filter === 'active') return !['completed', 'cancelled'].includes(o.status);
        if (filter === 'completed') return o.status === 'completed';
        if (filter === 'cancelled') return o.status === 'cancelled';
        return true;
    });

    if (!session?.access_token) {
        return (
            <div className="min-h-screen pt-20 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-white text-lg">Please log in to view your orders</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-20 pb-24 bg-[#0A0A0A]">
            <div className="max-w-3xl mx-auto px-4">
                <h1 className="text-white text-2xl font-bold mb-6">My Orders</h1>

                {/* Filters */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {(['all', 'active', 'completed', 'cancelled'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-full text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                                filter === f
                                    ? 'bg-[#d3da0c] text-black'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12">
                        <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500">No orders found</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map((order) => (
                            <Link key={order.id} to={`/orders/${order.id}`}>
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-[#d3da0c]/20 transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <ShoppingBag className="w-4 h-4 text-[#d3da0c]" />
                                            <span className="text-white font-medium">Order #{order.id}</span>
                                        </div>
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                                                order.status === 'completed'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : order.status === 'cancelled'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : order.status === 'ready'
                                                    ? 'bg-blue-500/20 text-blue-400'
                                                    : 'bg-amber-500/20 text-amber-400'
                                            }`}
                                        >
                                            {order.status.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <div className="space-y-1 mb-3">
                                        {order.items.slice(0, 3).map((item) => (
                                            <p key={item.id} className="text-gray-400 text-sm">
                                                {item.quantity}x {item.product_name}
                                            </p>
                                        ))}
                                        {order.items.length > 3 && (
                                            <p className="text-gray-600 text-sm">+{order.items.length - 3} more</p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-[#d3da0c] font-bold">¥{order.total_amount.toFixed(2)}</span>
                                        <ChevronRight className="w-4 h-4 text-gray-600" />
                                    </div>
                                </motion.div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
