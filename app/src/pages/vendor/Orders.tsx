import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Loader2, Inbox
} from 'lucide-react';
import { Link } from 'react-router-dom';

const VendorOrders = () => {
  const { session } = useAuthStore();
  const { activities: orders, fetchActivities, isLoading } = useDashboardStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (session?.access_token) {
      fetchActivities(session.access_token);
    }
  }, [session, fetchActivities]);

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'completed': return t('vendor.orders.statusCompleted');
      case 'pending': return t('vendor.orders.statusPending');
      case 'cancelled': return t('vendor.orders.statusCancelled');
      default: return t('vendor.orders.statusProcessing');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard/vendor"
            className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">{t('vendor.orders.title')}</h1>
            <p className="text-gray-400 text-sm mt-1">{t('vendor.orders.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-[#111111] border border-white/10 rounded-2xl p-6"
      >
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10">
                <tr className="text-gray-400 text-xs uppercase font-bold">
                  <th className="text-left py-4 px-4">{t('vendor.orders.orderIdHeader')}</th>
                  <th className="text-left py-4 px-4">{t('vendor.orders.customerHeader')}</th>
                  <th className="text-left py-4 px-4">{t('vendor.orders.productHeader')}</th>
                  <th className="text-left py-4 px-4">{t('vendor.orders.qtyHeader')}</th>
                  <th className="text-left py-4 px-4">{t('vendor.orders.totalHeader')}</th>
                  <th className="text-left py-4 px-4">{t('vendor.orders.statusHeader')}</th>
                  <th className="text-left py-4 px-4">{t('vendor.orders.dateHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-4 px-4 text-white font-mono text-xs">
                      #{order.id ? String(order.id).slice(0, 8) : t('vendor.orders.na')}
                    </td>
                    <td className="py-4 px-4 text-white font-medium">
                      {order.customer || order.customer_name || t('vendor.orders.unknown')}
                    </td>
                    <td className="py-4 px-4 text-gray-400">
                      {order.product || order.product_name || t('vendor.orders.product')}
                    </td>
                    <td className="py-4 px-4 text-gray-400">
                      {order.qty || order.quantity || 1}
                    </td>
                    <td className="py-4 px-4 text-[#d3da0c] font-bold">
                      ¥{order.total || order.amount || 0}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          order.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : order.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : order.status === 'cancelled'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-400 text-xs">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString()
                        : t('vendor.orders.na')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{t('vendor.orders.noOrdersTitle')}</h3>
            <p className="text-gray-400 max-w-md">
              {t('vendor.orders.noOrdersDescription')}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default VendorOrders;
