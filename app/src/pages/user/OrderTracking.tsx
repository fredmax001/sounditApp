import MobilePageHeader from '@/components/MobilePageHeader';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Package, MapPin, Phone, User, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import OrderStatusTracker from '@/components/OrderStatusTracker';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

interface TrackOrder {
    id: number;
    status: string;
    customer_name: string;
    total_amount: number;
    currency: string;
    vendor_name?: string;
    items: Array<{
        id: number;
        product_id: number;
        product_name: string;
        product_price: number;
        quantity: number;
        subtotal: number;
    }>;
    created_at: string;
    updated_at?: string;
}

export default function OrderTracking() {
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<TrackOrder | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderId) return;
        const fetchOrder = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${API_BASE_URL}/vendor-orders/${orderId}/track`);
                if (res.ok) {
                    const data = await res.json();
                    setOrder(data);
                } else {
                    setError('Order not found');
                }
            } catch {
                setError('Failed to load order');
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrder();
        // Poll every 10 seconds for updates
        const interval = setInterval(fetchOrder, 10000);
        return () => clearInterval(interval);
    }, [orderId]);

    if (isLoading) {
        return (
            <div className="min-h-dvh pt-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-dvh pt-20 flex items-center justify-center">
                <div className="text-center">
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-white">{error || 'Order not found'}</p>
                    <Link to="/" className="text-[#d3da0c] text-sm mt-2 inline-block">Go Home</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh pb-24 bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white transition-colors">
            {/* Header */}
      <MobilePageHeader title={`Order #${order.id}`} />

            <div className="max-w-lg mx-auto px-4 pt-6">

                {/* Status Tracker */}
                <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-5 mb-6 shadow-xs dark:shadow-none">
                    <OrderStatusTracker status={order.status} />
                </div>

                {/* Order Details */}
                <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-5 mb-6 shadow-xs dark:shadow-none">
                    <h2 className="text-[#020b00] dark:text-white font-bold text-lg mb-3">Order Details</h2>
                    <div className="space-y-3">
                        {order.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">{item.quantity}x</span>
                                    <span className="text-[#020b00] dark:text-white text-sm font-semibold">{item.product_name}</span>
                                </div>
                                <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">¥{item.subtotal.toFixed(2)}</span>
                            </div>
                        ))}
                        <div className="border-t border-black/8 dark:border-white/10 pt-3 flex items-center justify-between">
                            <span className="text-[#020b00] dark:text-white font-bold">Total</span>
                            <span className="text-[#020b00] dark:text-[#d3da0c] font-bold text-lg">
                                ¥{order.total_amount.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Customer Info */}
                <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-5 shadow-xs dark:shadow-none">
                    <h2 className="text-[#020b00] dark:text-white font-bold text-lg mb-3">Customer</h2>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                            <User className="w-4 h-4 text-[#020b00] dark:text-[#d3da0c]" />
                            <span className="text-[#020b00] dark:text-white font-medium">{order.customer_name}</span>
                        </div>
                    </div>
                    <p className="text-gray-500 text-xs mt-3">
                        Ordered on {new Date(order.created_at).toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
}
