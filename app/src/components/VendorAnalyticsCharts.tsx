import { motion } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, ShoppingBag, Users, Repeat } from 'lucide-react';

interface DailySale {
    date: string;
    revenue: number;
    orders: number;
}

interface BestSeller {
    product_id: number;
    product_name: string;
    total_sold: number;
    total_revenue: number;
}

interface Overview {
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
}

interface AnalyticsData {
    overview: Overview;
    sales_trend: { daily: DailySale[] };
    best_sellers: BestSeller[];
}

const COLORS = ['#d3da0c', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];

export default function VendorAnalyticsCharts({ data }: { data: AnalyticsData }) {
    const { overview, sales_trend, best_sellers } = data;

    const statCards = [
        { label: 'Orders Today', value: overview.orders_today, icon: ShoppingBag },
        { label: 'Revenue Today', value: `¥${overview.revenue_today.toFixed(0)}`, icon: TrendingUp },
        { label: 'Unique Customers', value: overview.unique_customers, icon: Users },
        { label: 'Repeat Customers', value: overview.repeat_customers, icon: Repeat },
    ];

    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statCards.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white/5 border border-white/10 rounded-xl p-4"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <stat.icon className="w-4 h-4 text-[#d3da0c]" />
                            <span className="text-gray-400 text-xs">{stat.label}</span>
                        </div>
                        <p className="text-white text-xl font-bold">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Revenue Chart */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4">Daily Revenue (Last 30 Days)</h3>
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={sales_trend.daily}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#d3da0c" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#d3da0c" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" stroke="#666" fontSize={12} tickFormatter={(v) => v?.slice(5) || ''} />
                        <YAxis stroke="#666" fontSize={12} tickFormatter={(v) => `¥${v}`} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value: number) => [`¥${value.toFixed(2)}`, 'Revenue']}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#d3da0c" fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Best Sellers */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4">Best Selling Products</h3>
                {best_sellers.length === 0 ? (
                    <p className="text-gray-500 text-sm">No sales data yet.</p>
                ) : (
                    <div className="space-y-3">
                        {best_sellers.slice(0, 5).map((item, i) => (
                            <div key={item.product_id} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center text-[#d3da0c] font-bold text-sm">
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm truncate">{item.product_name}</p>
                                    <p className="text-gray-500 text-xs">{item.total_sold} sold</p>
                                </div>
                                <span className="text-[#d3da0c] font-medium text-sm">¥{item.total_revenue.toFixed(0)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
