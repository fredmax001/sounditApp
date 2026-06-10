import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import VendorAnalyticsCharts from '@/components/VendorAnalyticsCharts';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface AnalyticsData {
    overview: {
        orders_today: number;
        orders_this_week: number;
        orders_this_month: number;
        revenue_today: number;
        revenue_this_week: number;
        revenue_this_month: number;
        total_revenue: number;
        total_orders: number;
        average_order_value: number;
        unique_customers: number;
        repeat_customers: number;
    };
    sales_trend: { daily: Array<{ date: string; revenue: number; orders: number }> };
    best_sellers: Array<{ product_id: number; product_name: string; total_sold: number; total_revenue: number }>;
}

export default function VendorAnalytics() {
    const { session } = useAuthStore();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (session?.access_token) {
            fetchAnalytics();
        }
    }, [session]);

    const fetchAnalytics = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/vendors/analytics/overview`, {
                headers: { Authorization: `Bearer ${session!.access_token}` }
            });
            if (res.ok) {
                const d = await res.json();
                setData(d);
            } else {
                toast.error('Failed to load analytics');
            }
        } catch {
            toast.error('Network error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-20 pb-24 bg-[#0A0A0A]">
            <div className="max-w-4xl mx-auto px-4">
                <div className="flex items-center gap-3 mb-6">
                    <Link to="/dashboard/vendor" className="p-2 text-gray-400 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-white text-2xl font-bold">Analytics</h1>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                    </div>
                ) : data ? (
                    <VendorAnalyticsCharts data={data} />
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <p>No analytics data available yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
