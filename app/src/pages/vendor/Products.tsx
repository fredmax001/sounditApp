import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore, VENDOR_CATEGORIES } from '@/store/vendorStore';
import type { Product } from '@/store/vendorStore';
import { useTranslation } from 'react-i18next';
import {
  Package, Plus, Edit2, Trash2, Loader2, ChevronLeft,
  Search, Bell, Menu, ChevronDown, Sparkles, X, Check,
  SlidersHorizontal, Calendar, Layers, Image as ImageIcon
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const getInitials = (name: string) => {
  const parts = (name || 'Vendor').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (name || 'VE').slice(0, 2).toUpperCase();
};

const VendorProducts = () => {
  const { session, profile } = useAuthStore();
  const {
    products,
    profile: vendorProfile,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    uploadProductImage,
  } = useVendorStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'inactive' | 'out_of_stock' | 'preorders'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high' | 'stock'>('newest');

  // Add / Edit Product modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Food and Beverages',
    product_type: 'Product',
    price: '',
    stock_quantity: '100',
    description: '',
    is_preorder_enabled: false,
    preorder_open_date: '',
    preorder_close_date: '',
    preorder_fulfilment_date: '',
    preorder_quantity: '50',
    image_url: '',
  });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);

  // Quick Stock adjustment modal
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [newStockQuantity, setNewStockQuantity] = useState<string>('');

  // Defense-in-depth: Redirect non-vendors away from vendor products
  useEffect(() => {
    const role = profile?.role_type || profile?.role;
    const isAdmin = role === 'admin' || role === 'super_admin';
    if (profile && role !== 'vendor' && !isAdmin) {
      if (role === 'business' || role === 'organizer') {
        navigate('/dashboard/business', { replace: true });
      } else if (role === 'artist' || role === 'dj') {
        navigate('/dashboard/artist', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (session?.access_token) {
      fetchProducts(session.access_token);
    }
  }, [session, fetchProducts]);

  // Handle ?add=1 or ?edit=<id> query parameters
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      openAddModal();
    }
    const editId = searchParams.get('edit');
    if (editId) {
      const target = products.find((p) => String(p.id) === String(editId));
      if (target) openEditModal(target);
    }
  }, [searchParams, products]);

  const openAddModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      category: vendorProfile?.categories?.[0] || 'Food and Beverages',
      product_type: 'Product',
      price: '',
      stock_quantity: '100',
      description: '',
      is_preorder_enabled: false,
      preorder_open_date: '',
      preorder_close_date: '',
      preorder_fulfilment_date: '',
      preorder_quantity: '50',
      image_url: '',
    });
    setProductImageFile(null);
    setProductImagePreview(null);
    setShowProductModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category || 'Food and Beverages',
      product_type: product.product_type || 'Product',
      price: String(product.price),
      stock_quantity: String(product.stock_quantity ?? 100),
      description: product.description || '',
      is_preorder_enabled: Boolean(product.is_preorder_enabled),
      preorder_open_date: product.preorder_open_date || '',
      preorder_close_date: product.preorder_close_date || '',
      preorder_fulfilment_date: product.preorder_fulfilment_date || '',
      preorder_quantity: String(product.preorder_quantity ?? 50),
      image_url: product.image_url || '',
    });
    setProductImageFile(null);
    setProductImagePreview(product.image_url || null);
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.price) {
      toast.error('Please enter a product name and price');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalImageUrl = productForm.image_url;
      if (productImageFile && session?.access_token) {
        const uploaded = await uploadProductImage(session.access_token, productImageFile);
        if (uploaded) finalImageUrl = uploaded;
      }

      const payload = {
        name: productForm.name.trim(),
        price: parseFloat(productForm.price),
        currency: 'CNY',
        category: productForm.category,
        product_type: productForm.product_type,
        stock_quantity: parseInt(productForm.stock_quantity) || 0,
        description: productForm.description,
        is_preorder_enabled: productForm.is_preorder_enabled,
        preorder_open_date: productForm.preorder_open_date || undefined,
        preorder_close_date: productForm.preorder_close_date || undefined,
        preorder_fulfilment_date: productForm.preorder_fulfilment_date || undefined,
        preorder_quantity: productForm.is_preorder_enabled
          ? parseInt(productForm.preorder_quantity) || 0
          : undefined,
        image_url: finalImageUrl || undefined,
        status: 'active' as const,
      };

      if (session?.access_token) {
        if (editingProduct) {
          await updateProduct(session.access_token, editingProduct.id, payload);
          toast.success('Product updated successfully');
        } else {
          await addProduct(session.access_token, payload);
          toast.success('Product created successfully');
        }
        await fetchProducts(session.access_token);
      } else {
        toast.success(editingProduct ? 'Product updated (preview)' : 'Product created (preview)');
      }

      setShowProductModal(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleProductStatus = async (product: Product) => {
    const nextStatus = product.status === 'active' ? 'inactive' : 'active';
    if (session?.access_token) {
      try {
        await updateProduct(session.access_token, product.id, { status: nextStatus });
        toast.success(`Product marked as ${nextStatus}`);
        fetchProducts(session.access_token);
      } catch {
        toast.error('Failed to update product status');
      }
    } else {
      toast.success(`Product marked as ${nextStatus} (preview)`);
    }
  };

  const handleSaveStock = async () => {
    if (!stockModalProduct) return;
    const qty = parseInt(newStockQuantity);
    if (isNaN(qty) || qty < 0) {
      toast.error('Please enter a valid stock quantity');
      return;
    }

    if (session?.access_token) {
      try {
        await updateProduct(session.access_token, stockModalProduct.id, { stock_quantity: qty });
        toast.success('Stock quantity updated');
        fetchProducts(session.access_token);
      } catch {
        toast.error('Failed to update stock');
      }
    } else {
      toast.success('Stock quantity updated (preview)');
    }
    setStockModalProduct(null);
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) return;

    if (session?.access_token) {
      try {
        await deleteProduct(session.access_token, product.id);
        toast.success('Product deleted');
        fetchProducts(session.access_token);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to delete product');
      }
    } else {
      toast.success('Product deleted (preview)');
    }
  };

  const activeSourceProducts = products;

  const filteredProducts = activeSourceProducts.filter((product) => {
    if (filterTab === 'active' && product.status !== 'active') return false;
    if (filterTab === 'inactive' && product.status !== 'inactive') return false;
    if (filterTab === 'out_of_stock' && (product.stock_quantity ?? 0) > 0) return false;
    if (filterTab === 'preorders' && !product.is_preorder_enabled) return false;

    if (selectedCategory !== 'all' && product.category !== selectedCategory) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = product.name.toLowerCase().includes(q);
      const matchDesc = (product.description || '').toLowerCase().includes(q);
      const matchCat = (product.category || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchCat) return false;
    }

    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price_low') return a.price - b.price;
    if (sortBy === 'price_high') return b.price - a.price;
    if (sortBy === 'stock') return (b.stock_quantity ?? 0) - (a.stock_quantity ?? 0);
    return b.id - a.id;
  });

  const vendorDisplayName =
    vendorProfile?.business_name ||
    (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '') ||
    'Vendor Store';

  return (
    <div className="min-h-screen bg-[#020b00] text-white pb-28">
      {/* Top Header matching reference Screen 2 (My Products) */}
      <div className="sticky top-0 z-30 bg-[#020b00]/95 backdrop-blur-xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-white/5">
        <div className="flex items-center justify-between h-11 max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/dashboard/vendor')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors -ml-1"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <h1 className="text-[17px] font-bold text-white tracking-tight">My Products</h1>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="w-9 h-9 rounded-full bg-[#11150E] border border-white/15 flex items-center justify-center text-gray-200 hover:text-white transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </Link>
            <button
              onClick={() => navigate('/dashboard/vendor')}
              className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-[#11150E] border border-white/15"
              aria-label="Vendor profile"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden bg-[#1a2312] border border-[#d3da0c]/40 flex items-center justify-center">
                <img
                  src="/default-avatar.png"
                  alt={vendorDisplayName}
                  className="w-full h-full object-cover"
                />
              </div>
              <Menu className="w-4 h-4 text-[#d3da0c]" />
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-2.5 mt-2">
          {/* Status Tabs: All | Active | Inactive | Out of Stock | Preorders */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'inactive', label: 'Inactive' },
                { id: 'out_of_stock', label: 'Out of Stock' },
                { id: 'preorders', label: 'Preorders' },
              ] as const
            ).map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                    active
                      ? 'bg-[#d3da0c] text-black shadow-[0_0_12px_rgba(211,218,12,0.3)]'
                      : 'bg-[#11150E] text-gray-300 border border-white/10 hover:border-white/20'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Bar matching reference Screen 2 */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products"
              className="w-full bg-[#11150E] border border-white/10 text-white placeholder-gray-500 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-[#d3da0c] text-xs"
            />
          </div>

          {/* Two Dropdowns: All Categories | Sort: Newest */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="relative">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-[#11150E] border border-white/10 text-white pl-8 pr-7 py-2.5 rounded-xl focus:outline-none focus:border-[#d3da0c] appearance-none text-xs font-medium truncate"
              >
                <option value="all">All Categories</option>
                {VENDOR_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <Layers className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-[#11150E] border border-white/10 text-white pl-8 pr-7 py-2.5 rounded-xl focus:outline-none focus:border-[#d3da0c] appearance-none text-xs font-medium"
              >
                <option value="newest">Sort: Newest</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="stock">Highest Stock</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Add Product Button for Quick Access */}
      <div className="max-w-4xl mx-auto px-4 pt-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Showing <span className="text-white font-bold">{sortedProducts.length}</span> products
        </p>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#d3da0c] text-black font-extrabold text-xs rounded-full shadow-[0_0_12px_rgba(211,218,12,0.3)] hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Product Cards List matching reference Screen 2 */}
      <div className="max-w-4xl mx-auto px-4 pt-3 space-y-3">
        {sortedProducts.length === 0 ? (
          <div className="bg-[#11150E] border border-white/10 rounded-2xl p-10 text-center text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-500" />
            <p className="text-base font-bold text-white mb-1">No products found</p>
            <p className="text-xs mb-4">Add your food, apparel, merchandise or service offerings.</p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#d3da0c] text-black font-extrabold text-xs rounded-xl"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create Product</span>
            </button>
          </div>
        ) : (
          sortedProducts.map((product) => {
            const isActive = product.status === 'active';
            const categoryTag = product.product_type || product.category || 'Product';

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#11150E] border border-white/10 rounded-2xl p-3.5 space-y-3"
              >
                {/* Top Section: Thumbnail + Info + Toggle Switch */}
                <div className="flex items-start gap-3.5">
                  {/* Square Product Image */}
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                    <img
                      src={product.image_url || '/event_placeholder.jpg'}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/event_placeholder.jpg';
                      }}
                    />
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-bold text-white leading-tight truncate">
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-semibold text-gray-300">
                            {categoryTag}
                          </span>
                          {product.is_preorder_enabled && (
                            <span className="px-2 py-0.5 rounded-full bg-[#d3da0c]/20 text-[10px] font-extrabold text-[#d3da0c]">
                              Preorder
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Interactive Active Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleProductStatus(product)}
                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                          isActive ? 'bg-emerald-500' : 'bg-white/20'
                        }`}
                        aria-label="Toggle active status"
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                            isActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-base font-extrabold text-white">¥{product.price}</span>
                      <span className="text-xs text-gray-400">
                        {product.is_preorder_enabled ? (
                          <>
                            Preorder Qty:{' '}
                            <strong className="text-gray-200">
                              {product.preorder_quantity ?? product.stock_quantity}
                            </strong>
                          </>
                        ) : (
                          <>
                            Stock: <strong className="text-gray-200">{product.stock_quantity ?? 0}</strong>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Row: Edit | Stock | Delete matching reference Screen 2 */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/8">
                  <button
                    onClick={() => openEditModal(product)}
                    className="py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-1.5 hover:bg-white/10 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-gray-300" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => {
                      setStockModalProduct(product);
                      setNewStockQuantity(String(product.stock_quantity ?? 0));
                    }}
                    className="py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-1.5 hover:bg-white/10 transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#d3da0c]" />
                    <span>Stock</span>
                  </button>

                  <button
                    onClick={() => handleDeleteProduct(product)}
                    className="py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 flex items-center justify-center gap-1.5 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add / Edit Product Sheet Modal */}
      <AnimatePresence>
        {showProductModal && (
          <div
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowProductModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#11150E] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] max-h-[90vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h3>
                  <p className="text-xs text-gray-400">Configure product details, stock and preorder rules</p>
                </div>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Product Image Selector */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  {productImagePreview ? (
                    <img src={productImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Product Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setProductImageFile(file);
                        setProductImagePreview(URL.createObjectURL(file));
                      }
                    }}
                    className="text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#d3da0c] file:text-black file:font-bold"
                  />
                </div>
              </div>

              {/* Product Basic Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="e.g. Jollof and Beef, Custom Bomber Jacket..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Category *</label>
                    <select
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#d3da0c]"
                    >
                      {VENDOR_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Product Tag / Type</label>
                    <input
                      type="text"
                      value={productForm.product_type}
                      onChange={(e) => setProductForm({ ...productForm, product_type: e.target.value })}
                      placeholder="Food, Merch, Service..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Price (¥ CNY) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                      placeholder="25.00"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Stock Quantity</label>
                    <input
                      type="number"
                      value={productForm.stock_quantity}
                      onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                      placeholder="100"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    placeholder="Product details, ingredients, sizing or collection instructions..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#d3da0c] resize-none"
                  />
                </div>

                {/* Preorder Configuration Section */}
                <div className="p-3.5 rounded-2xl bg-[#020b00] border border-[#d3da0c]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#d3da0c]">Preorder System</p>
                      <p className="text-[11px] text-gray-400">Allow customers to order in advance</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setProductForm((prev) => ({
                          ...prev,
                          is_preorder_enabled: !prev.is_preorder_enabled,
                        }))
                      }
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                        productForm.is_preorder_enabled ? 'bg-[#d3da0c]' : 'bg-white/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full transition-transform ${
                          productForm.is_preorder_enabled
                            ? 'translate-x-5 bg-black'
                            : 'translate-x-0 bg-white'
                        }`}
                      />
                    </button>
                  </div>

                  {productForm.is_preorder_enabled && (
                    <div className="space-y-2.5 pt-2 border-t border-white/10">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">Opening Date</label>
                          <input
                            type="date"
                            value={productForm.preorder_open_date}
                            onChange={(e) =>
                              setProductForm({ ...productForm, preorder_open_date: e.target.value })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">Closing Date</label>
                          <input
                            type="date"
                            value={productForm.preorder_close_date}
                            onChange={(e) =>
                              setProductForm({ ...productForm, preorder_close_date: e.target.value })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">Fulfilment Date</label>
                          <input
                            type="date"
                            value={productForm.preorder_fulfilment_date}
                            onChange={(e) =>
                              setProductForm({ ...productForm, preorder_fulfilment_date: e.target.value })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">Preorder Quantity</label>
                          <input
                            type="number"
                            value={productForm.preorder_quantity}
                            onChange={(e) =>
                              setProductForm({ ...productForm, preorder_quantity: e.target.value })
                            }
                            placeholder="50"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProduct}
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl bg-[#d3da0c] text-black font-extrabold text-xs flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingProduct ? 'Save Product' : 'Create Product'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Stock Modal */}
      <AnimatePresence>
        {stockModalProduct && (
          <div
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setStockModalProduct(null)}
          >
            <div
              className="w-full max-w-sm bg-[#11150E] border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Adjust Stock</h3>
                  <p className="text-xs text-gray-400">{stockModalProduct.name}</p>
                </div>
                <button
                  onClick={() => setStockModalProduct(null)}
                  className="p-1 rounded-full text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Available Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={newStockQuantity}
                  onChange={(e) => setNewStockQuantity(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-base text-white font-bold focus:outline-none focus:border-[#d3da0c]"
                />
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setStockModalProduct(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStock}
                  className="flex-1 py-2.5 rounded-xl bg-[#d3da0c] text-black text-xs font-extrabold"
                >
                  Update Stock
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VendorProducts;
