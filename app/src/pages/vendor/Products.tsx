import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';
import { useTranslation } from 'react-i18next';
import {
  Package, Plus, Edit, Trash2, Loader2, ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';


const VendorProducts = () => {
  const { session } = useAuthStore();
  const { products, fetchProducts, deleteProduct } = useVendorStore();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingProduct, setIsDeletingProduct] = useState<number | null>(null);

  useEffect(() => {
    if (session?.access_token) {
      fetchProducts(session.access_token).finally(() => setIsLoading(false));
    }
  }, [session, fetchProducts]);

  const handleDeleteProduct = async (productId: number) => {
    if (!session?.access_token) {
      toast.error(t('vendor.products.notAuthenticated'));
      return;
    }

    if (!confirm(t('vendor.products.deleteConfirm'))) {
      return;
    }

    setIsDeletingProduct(productId);
    try {
      await deleteProduct(session.access_token, productId);
      toast.success(t('vendor.products.deleteSuccess'));
      fetchProducts(session.access_token);
    } catch (error: unknown) {
      console.error('Delete product error:', error);
      toast.error(error instanceof Error ? error.message : t('vendor.products.deleteError'));
    } finally {
      setIsDeletingProduct(null);
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard/vendor"
            className="p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 rounded-lg text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white transition-all shadow-xs dark:shadow-none"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-[#020b00] dark:text-white">{t('vendor.products.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{t('vendor.products.subtitle')}</p>
          </div>
        </div>
        <Link
          to="/dashboard/vendor"
          className="flex items-center gap-2 px-6 py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black rounded-lg font-bold hover:opacity-90 transition-opacity shadow-xs dark:shadow-none"
        >
          <Plus className="w-4 h-4" />
          {t('vendor.products.addProduct')}
        </Link>
      </div>

      {/* Products Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-6 shadow-xs dark:shadow-none"
      >
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#020b00] dark:text-[#d3da0c] animate-spin" />
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-neutral-50 dark:bg-white/[0.02] border border-black/8 dark:border-white/5 rounded-xl p-5 hover:border-[#020b00] dark:hover:border-[#d3da0c]/30 transition-all shadow-xs dark:shadow-none"
              >
                <div className="flex items-start gap-4 mb-4">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-20 h-20 rounded-lg object-cover bg-black/5 dark:bg-white/5"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-neutral-200/60 dark:bg-white/5 flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[#020b00] dark:text-white font-bold text-lg truncate">{product.name}</h4>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('vendor.products.productId', { id: String(product.id).slice(0, 8) })}</p>
                    {product.category && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-black/5 dark:bg-white/10 rounded text-xs text-gray-600 dark:text-gray-400 capitalize">
                        {product.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <p className="text-[#020b00] dark:text-[#d3da0c] text-xl font-black">
                    ¥{product.price}
                  </p>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      product.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:bg-green-500/20 dark:text-green-400'
                        : 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                    }`}
                  >
                    {product.status === 'active' ? t('vendor.products.statusActive') : t('vendor.products.statusInactive')}
                  </span>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('vendor.products.stock', { quantity: product.stock_quantity ?? 'N/A' })}
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/dashboard/vendor?tab=products&edit=${product.id}`}
                    className="flex-1 px-3 py-2 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold rounded-lg hover:bg-blue-500/20 dark:hover:bg-blue-500/30 transition-all text-sm text-center"
                  >
                    <Edit className="w-3 h-3 inline mr-1" />
                    {t('vendor.products.edit')}
                  </Link>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    disabled={isDeletingProduct === product.id}
                    className="flex-1 px-3 py-2 bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 font-bold rounded-lg hover:bg-red-500/20 dark:hover:bg-red-500/30 transition-all text-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isDeletingProduct === product.id ? (
                      <>
                        <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
                        {t('vendor.products.deleting')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3 inline mr-1" />
                        {t('vendor.products.delete')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Package className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-[#020b00] dark:text-white mb-2">{t('vendor.products.noProductsTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
              {t('vendor.products.noProductsDescription')}
            </p>
            <Link
              to="/dashboard/vendor"
              className="flex items-center gap-2 px-6 py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black rounded-lg font-bold hover:opacity-90 transition-opacity shadow-xs dark:shadow-none"
            >
              <Plus className="w-4 h-4" />
              {t('vendor.products.addFirstProduct')}
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default VendorProducts;
