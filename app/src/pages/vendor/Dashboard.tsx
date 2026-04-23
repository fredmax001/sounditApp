import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';
import { useDashboardStore } from '@/store/dashboardStore';
import {
    Store, ShoppingBag, DollarSign, Calendar, Star,
    Plus, Edit, TrendingUp, Package, MessageSquare,
    Eye, X, Check, MapPin, Trash2, Inbox,
    Loader2, Image as ImageIcon, User, Phone, Mail, Globe,
    QrCode, Filter
} from 'lucide-react';
import type { Product } from '@/store/vendorStore';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface VendorEvent {
    id: number;
    name?: string;
    event_name?: string;
    date?: string;
    event_date?: string;
    booth?: string;
    booth_number?: string;
    capacity?: number;
    status?: string;
}

interface VendorReview {
    id: number;
    customer?: string;
    customer_name?: string;
    date?: string;
    created_at?: string;
    rating?: number;
    comment?: string;
    review?: string;
}

interface ProductOrderItem {
    id: number;
    product: {
        id: number | null;
        name: string | null;
    };
    user: {
        id: number | null;
        name: string | null;
        email: string | null;
    };
    payment_amount: number;
    payer_name: string;
    payment_screenshot: string;
    status: 'pending' | 'approved' | 'rejected' | 'used';
    order_code: string | null;
    order_qr_code: string | null;
    rejection_reason: string | null;
    created_at: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const VendorDashboard = () => {
    const { session, profile } = useAuthStore();
    const { profile: vendorProfile, products, fetchProfile, fetchProducts, updateProduct, deleteProduct, updateProfile } = useVendorStore();
    const { stats: dashboardStats, fetchStats, fetchActivities } = useDashboardStore();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('overview');
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Product form state
    const [productForm, setProductForm] = useState({
        name: '',
        price: '',
        quantity: '',
        description: '',
        category: '',
        currency: 'CNY'
    });
    const [productImage, setProductImage] = useState<File | null>(null);
    const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);
    const [isDeletingProduct, setIsDeletingProduct] = useState<number | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        business_name: '',
        description: '',
        email: '',
        phone: '',
        address: '',
        website: '',
        vendor_type: '' as 'food' | 'merch' | 'service' | 'beverage' | ''
    });
    const [profileLogo, setProfileLogo] = useState<File | null>(null);
    const [profileLogoPreview, setProfileLogoPreview] = useState<string | null>(null);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    // Data states
    const [events, setEvents] = useState<VendorEvent[]>([]);
    const [reviews, setReviews] = useState<VendorReview[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(false);
    const [isLoadingReviews, setIsLoadingReviews] = useState(false);
    const [eventsError, setEventsError] = useState<string | null>(null);


    // Product orders state
    const [productOrders, setProductOrders] = useState<ProductOrderItem[]>([]);
    const [productOrdersLoading, setProductOrdersLoading] = useState(false);
    const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
    const [viewScreenshotOrder, setViewScreenshotOrder] = useState<ProductOrderItem | null>(null);
    const [viewQrOrder, setViewQrOrder] = useState<ProductOrderItem | null>(null);
    const [rejectingOrder, setRejectingOrder] = useState<ProductOrderItem | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const handleProductChange = (field: string, value: string) => {
        setProductForm(prev => ({ ...prev, [field]: value }));
    };

    const handleProfileChange = (field: string, value: string) => {
        setProfileForm(prev => ({ ...prev, [field]: value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error(t('vendor.dashboard.imageSizeError'));
                return;
            }
            if (!file.type.startsWith('image/')) {
                toast.error(t('vendor.dashboard.invalidImageError'));
                return;
            }
            setProductImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setProductImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error(t('vendor.dashboard.logoSizeError'));
                return;
            }
            if (!file.type.startsWith('image/')) {
                toast.error(t('vendor.dashboard.invalidImageError'));
                return;
            }
            setProfileLogo(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfileLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async (file: File, token: string): Promise<string | null> => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/media/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || t('vendor.dashboard.uploadImageError'));
            }

            const data = await response.json();
            return data.url;
        } catch (error: unknown) {
            console.error('Image upload error:', error);
            toast.error(error instanceof Error ? error.message : t('vendor.dashboard.uploadImageError'));
            return null;
        }
    };

    const uploadProductImage = async (token: string): Promise<string | null> => {
        if (!productImage) return null;
        setIsUploadingImage(true);
        try {
            return await uploadImage(productImage, token);
        } finally {
            setIsUploadingImage(false);
        }
    };

    const uploadLogo = async (token: string): Promise<string | null> => {
        if (!profileLogo) return null;
        setIsUploadingLogo(true);
        try {
            return await uploadImage(profileLogo, token);
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const handleAddProduct = async () => {
        if (!session?.access_token) {
            toast.error(t('vendor.dashboard.notAuthenticated'));
            return;
        }

        if (!productForm.name || !productForm.price) {
            toast.error(t('vendor.dashboard.productNamePriceRequired'));
            return;
        }

        setIsAddingProduct(true);

        try {
            // Upload image if selected
            let imageUrl = null;
            if (productImage) {
                imageUrl = await uploadProductImage(session.access_token);
            }

            const response = await fetch(`${API_BASE_URL}/vendors/products`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: productForm.name,
                    price: parseFloat(productForm.price),
                    stock_quantity: parseInt(productForm.quantity) || 0,
                    description: productForm.description,
                    category: productForm.category || undefined,
                    currency: productForm.currency,
                    image_url: imageUrl || undefined,
                    status: 'active'
                })
            });

            if (response.ok) {
                const createdProduct = await response.json();
                toast.success(t('vendor.dashboard.productAddedSuccess'));
                resetProductForm();
                setShowAddProduct(false);
                fetchProducts(session.access_token);
            } else {
                const error = await response.json();
                toast.error(error.detail || t('vendor.dashboard.addProductError'));
            }
        } catch (error) {
            console.error('Add product error:', error);
            toast.error(t('vendor.dashboard.networkError'));
        } finally {
            setIsAddingProduct(false);
        }
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setProductForm({
            name: product.name,
            price: String(product.price),
            quantity: String(product.stock_quantity || ''),
            description: product.description || '',
            category: product.category || '',
            currency: product.currency || 'CNY'
        });
        setProductImagePreview(product.image_url || null);
        setShowAddProduct(true);
    };

    const handleUpdateProduct = async () => {
        if (!session?.access_token || !editingProduct) {
            toast.error(t('vendor.dashboard.notAuthenticated'));
            return;
        }

        if (!productForm.name || !productForm.price) {
            toast.error(t('vendor.dashboard.productNamePriceRequired'));
            return;
        }

        setIsUpdatingProduct(true);

        try {
            // Upload new image if selected
            let imageUrl = editingProduct.image_url;
            if (productImage) {
                const uploadedUrl = await uploadProductImage(session.access_token);
                if (uploadedUrl) imageUrl = uploadedUrl;
            }

            await updateProduct(session.access_token, editingProduct.id, {
                name: productForm.name,
                price: parseFloat(productForm.price),
                stock_quantity: parseInt(productForm.quantity) || 0,
                description: productForm.description,
                category: productForm.category || undefined,
                currency: productForm.currency,
                image_url: imageUrl
            });

            toast.success(t('vendor.dashboard.productUpdatedSuccess'));
            resetProductForm();
            setEditingProduct(null);
            setShowAddProduct(false);
            fetchProducts(session.access_token);
        } catch (error: unknown) {
            console.error('Update product error:', error);
            toast.error(error instanceof Error ? error.message : t('vendor.dashboard.updateProductError'));
        } finally {
            setIsUpdatingProduct(false);
        }
    };

    const handleDeleteProduct = async (productId: number) => {
        if (!session?.access_token) {
            toast.error(t('vendor.dashboard.notAuthenticated'));
            return;
        }

        if (!confirm(t('vendor.dashboard.deleteProductConfirm'))) {
            return;
        }

        setIsDeletingProduct(productId);

        try {
            await deleteProduct(session.access_token, productId);
            toast.success(t('vendor.dashboard.productDeletedSuccess'));
            fetchProducts(session.access_token);
        } catch (error: unknown) {
            console.error('Delete product error:', error);
            toast.error(error instanceof Error ? error.message : t('vendor.dashboard.deleteProductError'));
        } finally {
            setIsDeletingProduct(null);
        }
    };

    const resetProductForm = () => {
        setProductForm({ name: '', price: '', quantity: '', description: '', category: '', currency: 'CNY' });
        setProductImage(null);
        setProductImagePreview(null);
    };

    const handleCancelEdit = () => {
        setShowAddProduct(false);
        setEditingProduct(null);
        resetProductForm();
    };

    const handleUpdateProfile = async () => {
        if (!session?.access_token) {
            toast.error(t('vendor.dashboard.notAuthenticated'));
            return;
        }

        if (!profileForm.business_name) {
            toast.error(t('vendor.dashboard.businessNameRequired'));
            return;
        }

        setIsUpdatingProfile(true);

        try {
            // Upload logo if selected
            let logoUrl = vendorProfile?.logo_url;
            if (profileLogo) {
                const uploadedUrl = await uploadLogo(session.access_token);
                if (uploadedUrl) logoUrl = uploadedUrl;
            }

            await updateProfile(session.access_token, {
                business_name: profileForm.business_name,
                description: profileForm.description || undefined,
                email: profileForm.email || undefined,
                phone: profileForm.phone || undefined,
                address: profileForm.address || undefined,
                website: profileForm.website || undefined,
                vendor_type: profileForm.vendor_type || undefined,
                logo_url: logoUrl
            });

            toast.success(t('vendor.dashboard.profileUpdatedSuccess'));
            setProfileLogo(null);
            setProfileLogoPreview(null);
            fetchProfile(session.access_token);
        } catch (error: unknown) {
            console.error('Update profile error:', error);
            toast.error(error instanceof Error ? error.message : t('vendor.dashboard.updateProfileError'));
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const resetProfileForm = useCallback(() => {
        if (vendorProfile) {
            setProfileForm({
                business_name: vendorProfile.business_name || '',
                description: vendorProfile.description || '',
                email: vendorProfile.email || '',
                phone: vendorProfile.phone || '',
                address: vendorProfile.address || '',
                website: vendorProfile.website || '',
                vendor_type: vendorProfile.vendor_type || ''
            });
            setProfileLogoPreview(vendorProfile.logo_url || null);
        }
        setProfileLogo(null);
    }, [vendorProfile]);

    const handleViewMessages = () => {
        navigate('/messages');
    };

    const handleApplyForBooth = () => {
        navigate('/events');
    };

    const fetchVendorEvents = useCallback(async (token: string) => {
        setIsLoadingEvents(true);
        setEventsError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/vendors/events`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setEvents(data || []);
            } else {
                const error = await response.json();
                setEventsError(error.detail || t('vendor.dashboard.loadEventsError'));
                setEvents([]);
            }
        } catch {
            setEventsError(t('vendor.dashboard.loadEventsNetworkError'));
            setEvents([]);
        } finally {
            setIsLoadingEvents(false);
        }
    }, []);

    const fetchVendorReviews = useCallback(async (token: string) => {
        setIsLoadingReviews(true);
        try {
            const response = await fetch(`${API_BASE_URL}/vendors/reviews`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setReviews(data || []);
            } else {
                // Reviews endpoint may not exist yet - show empty state without error
                setReviews([]);
            }
        } catch {
            // Reviews endpoint may not exist yet - show empty state without error
            setReviews([]);
        } finally {
            setIsLoadingReviews(false);
        }
    }, []);

    const handleCancelEventApplication = async (eventId: number) => {
        if (!session?.access_token) {
            toast.error(t('vendor.dashboard.notAuthenticated'));
            return;
        }

        if (!confirm(t('vendor.dashboard.cancelEventConfirm'))) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/vendors/events/${eventId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                toast.success(t('vendor.dashboard.eventCancelledSuccess'));
                fetchVendorEvents(session.access_token);
            } else {
                const error = await response.json();
                toast.error(error.detail || t('vendor.dashboard.cancelApplicationError'));
            }
        } catch {
            toast.error(t('vendor.dashboard.networkError'));
        }
    };

    const fetchProductOrders = useCallback(async (token: string) => {
        setProductOrdersLoading(true);
        try {
            const params = new URLSearchParams();
            if (orderFilter !== 'all') params.append('status', orderFilter);
            const response = await fetch(`${API_BASE_URL}/product-orders/vendor/orders?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setProductOrders(data.orders || []);
            } else {
                setProductOrders([]);
            }
        } catch {
            setProductOrders([]);
        } finally {
            setProductOrdersLoading(false);
        }
    }, [orderFilter]);

    const approveOrder = async (orderId: number) => {
        if (!session?.access_token) {
            toast.error(t('vendor.dashboard.notAuthenticated'));
            return;
        }
        setProcessingOrderId(orderId);
        try {
            const response = await fetch(`${API_BASE_URL}/product-orders/${orderId}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (response.ok) {
                const data = await response.json();
                toast.success(t('vendor.dashboard.orderApprovedSuccess') || 'Order approved');
                setProductOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'approved', order_code: data.order_code, order_qr_code: data.order_qr } : o));
            } else {
                const error = await response.json();
                toast.error(error.detail || t('vendor.dashboard.approveOrderError') || 'Failed to approve order');
            }
        } catch {
            toast.error(t('vendor.dashboard.networkError'));
        } finally {
            setProcessingOrderId(null);
        }
    };

    const rejectOrder = async (orderId: number, reason: string) => {
        if (!session?.access_token) {
            toast.error(t('vendor.dashboard.notAuthenticated'));
            return;
        }
        setProcessingOrderId(orderId);
        try {
            const formData = new FormData();
            formData.append('reason', reason);
            const response = await fetch(`${API_BASE_URL}/product-orders/${orderId}/reject`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData
            });
            if (response.ok) {
                toast.success(t('vendor.dashboard.orderRejectedSuccess') || 'Order rejected');
                setProductOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'rejected', rejection_reason: reason } : o));
                setRejectingOrder(null);
                setRejectReason('');
            } else {
                const error = await response.json();
                toast.error(error.detail || t('vendor.dashboard.rejectOrderError') || 'Failed to reject order');
            }
        } catch {
            toast.error(t('vendor.dashboard.networkError'));
        } finally {
            setProcessingOrderId(null);
        }
    };

    // Initialize profile form when vendor profile is loaded
    useEffect(() => {
        if (vendorProfile) {
            resetProfileForm();
        }
    }, [vendorProfile, resetProfileForm]);

    useEffect(() => {
        if (session?.access_token) {
            fetchStats(session.access_token);
            fetchActivities(session.access_token);
            fetchProfile(session.access_token);
            fetchProducts(session.access_token);
            fetchVendorEvents(session.access_token);
            fetchVendorReviews(session.access_token);
        }
    }, [session, fetchStats, fetchActivities, fetchProfile, fetchProducts, fetchVendorEvents, fetchVendorReviews]);

    useEffect(() => {
        if (session?.access_token && activeTab === 'orders') {
            fetchProductOrders(session.access_token);
        }
    }, [session, activeTab, fetchProductOrders]);

    const vendorStats = dashboardStats?.vendor_stats;

    const stats = {
        activeListings: vendorStats?.active_listings ?? products.filter(p => p.status === 'active').length,
        totalSales: vendorStats?.total_sales ?? 0,
        pendingOrders: vendorStats?.pending_orders ?? 0,
        upcomingBooths: vendorStats?.event_booths ?? events.filter(e => e.status === 'approved').length
    };

    const { activities } = useDashboardStore();
    const orders = activities || [];

    const EmptyState = ({ message, icon: Icon }: { message: string, icon: React.ComponentType<{ className?: string }> }) => (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 text-sm">{message}</p>
        </div>
    );

    // Get display name from auth store profile (syncs with user profile)
    const displayName = vendorProfile?.business_name ||
        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
        t('vendor.dashboard.defaultVendorName');

    // Tab configuration with all tabs including the new Profile tab
    const tabs = [
        { id: 'overview', label: t('vendor.dashboard.tabOverview'), icon: TrendingUp },
        { id: 'products', label: t('vendor.dashboard.tabProducts'), icon: Package },
        { id: 'orders', label: t('vendor.dashboard.tabOrders'), icon: ShoppingBag },
        { id: 'events', label: t('vendor.dashboard.tabEvents'), icon: Calendar },
        { id: 'reviews', label: t('vendor.dashboard.tabReviews'), icon: Star },
        { id: 'profile', label: t('vendor.dashboard.tabProfile'), icon: User },
    ];

    return (
        <div className="min-h-screen bg-[#0A0A0A] p-6 lg:p-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-black text-white">{t('vendor.dashboard.title')}</h1>
                    <p className="text-gray-400 mt-1 font-bold">{t('vendor.dashboard.welcomeBack', { name: displayName })}</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => { setActiveTab('products'); setShowAddProduct(true); }} className="flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black rounded-lg font-bold hover:bg-[#bbc10b] transition-all">
                        <Plus className="w-4 h-4" />
                        {t('vendor.dashboard.addProduct')}
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 mb-8 bg-[#111111] p-1.5 rounded-2xl w-fit border border-white/5">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab.id
                            ? 'bg-[#d3da0c] text-black'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Stats Grid - Only show on overview tab */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: t('vendor.dashboard.totalSalesLabel'), value: `¥${stats.totalSales.toLocaleString()}`, icon: DollarSign, color: 'text-[#d3da0c]' },
                        { label: t('vendor.dashboard.activeListingsLabel'), value: stats.activeListings, icon: Store, color: 'text-blue-400' },
                        { label: t('vendor.dashboard.pendingOrdersLabel'), value: stats.pendingOrders, icon: ShoppingBag, color: 'text-purple-400' },
                        { label: t('vendor.dashboard.eventBoothsLabel'), value: stats.upcomingBooths, icon: Calendar, color: 'text-green-400' },
                    ].map((stat, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-[#111111] border border-white/10 rounded-xl p-6"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-3 rounded-lg ${stat.color === 'text-[#d3da0c]' ? 'bg-[#d3da0c]/10' : stat.color === 'text-blue-400' ? 'bg-blue-500/10' : stat.color === 'text-purple-400' ? 'bg-purple-500/10' : 'bg-green-500/10'}`}>
                                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                </div>
                                <span className="text-gray-400 text-sm font-bold">{stat.label}</span>
                            </div>
                            <p className="text-2xl font-black text-white">{stat.value}</p>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Content Area */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-[#111111] border border-white/10 rounded-2xl p-8"
            >
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Recent Orders */}
                        <div className="lg:col-span-2">
                            <h3 className="text-xl font-black text-white mb-6">{t('vendor.dashboard.recentOrders')}</h3>
                            {orders.length > 0 ? (
                                <div className="space-y-3">
                                    {orders.slice(0, 5).map((order) => (
                                        <div key={order.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-lg hover:border-[#d3da0c]/30 transition-all">
                                            <div className="flex-1">
                                                <p className="text-white font-bold">{order.customer || order.customer_name || t('vendor.dashboard.unknownCustomer')}</p>
                                                <p className="text-gray-400 text-sm">{t('vendor.dashboard.orderProductQty', { product: order.product || order.product_name || t('vendor.dashboard.unknownProduct'), qty: order.qty || order.quantity || 1 })}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[#d3da0c] font-bold">¥{order.total || order.amount || 0}</p>
                                                <span className={`text-xs font-bold ${order.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}`}>
                                                    {order.status === 'completed' ? t('vendor.dashboard.statusCompleted') : order.status === 'cancelled' ? t('vendor.dashboard.statusCancelled') : t('vendor.dashboard.statusPending')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState message={t('vendor.dashboard.noOrders')} icon={Inbox} />
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="space-y-4">
                            <Link
                                to="/vendor/analytics"
                                className="w-full block p-4 bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/30 rounded-lg text-purple-400 font-bold hover:bg-purple-600/30 transition-all text-center"
                            >
                                <Eye className="w-4 h-4 inline mr-2" />
                                {t('vendor.dashboard.viewAnalytics')}
                            </Link>
                            <button
                                onClick={handleViewMessages}
                                className="w-full p-4 bg-gradient-to-br from-green-600/20 to-green-700/10 border border-green-500/30 rounded-lg text-green-400 font-bold hover:bg-green-600/30 transition-all"
                            >
                                <MessageSquare className="w-4 h-4 inline mr-2" />
                                {t('vendor.dashboard.messages')}
                            </button>
                            <button
                                onClick={() => setActiveTab('profile')}
                                className="w-full p-4 bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/30 rounded-lg text-blue-400 font-bold hover:bg-blue-600/30 transition-all"
                            >
                                <User className="w-4 h-4 inline mr-2" />
                                {t('vendor.dashboard.editProfile')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Products Tab */}
                {activeTab === 'products' && (
                    <div className="space-y-6">
                        <div className="grid gap-4">
                            {/* Add/Edit Product Form */}
                            {showAddProduct && (
                                <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
                                    <h4 className="text-white font-bold text-lg">{editingProduct ? t('vendor.dashboard.editProduct') : t('vendor.dashboard.addNewProduct')}</h4>

                                    {/* Image Upload */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden">
                                            {productImagePreview ? (
                                                <img src={productImagePreview} alt={t('vendor.dashboard.productImagePreview')} className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon className="w-8 h-8 text-gray-500" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm text-gray-400 mb-2">{t('vendor.dashboard.productImageLabel')}</label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#d3da0c] file:text-black file:font-bold hover:file:bg-[#bbc10b]"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">{t('vendor.dashboard.imageHint')}</p>
                                        </div>
                                    </div>

                                    <input
                                        type="text"
                                        placeholder={t('vendor.dashboard.productNamePlaceholder')}
                                        value={productForm.name}
                                        onChange={(e) => handleProductChange('name', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                                    />
                                    <div className="grid grid-cols-3 gap-4">
                                        <input
                                            type="number"
                                            placeholder={t('vendor.dashboard.pricePlaceholder')}
                                            value={productForm.price}
                                            onChange={(e) => handleProductChange('price', e.target.value)}
                                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                                        />
                                        <input
                                            type="number"
                                            placeholder={t('vendor.dashboard.quantityPlaceholder')}
                                            value={productForm.quantity}
                                            onChange={(e) => handleProductChange('quantity', e.target.value)}
                                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                                        />
                                        <select
                                            value={productForm.category}
                                            onChange={(e) => handleProductChange('category', e.target.value)}
                                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                                        >
                                            <option value="" className="bg-[#111111]">{t('vendor.dashboard.selectCategory')}</option>
                                            <option value="food" className="bg-[#111111]">{t('vendor.dashboard.categoryFoodBeverages')}</option>
                                            <option value="merchandise" className="bg-[#111111]">{t('vendor.dashboard.categoryMerchandise')}</option>
                                            <option value="services" className="bg-[#111111]">{t('vendor.dashboard.categoryServices')}</option>
                                            <option value="other" className="bg-[#111111]">{t('vendor.dashboard.categoryOther')}</option>
                                        </select>
                                    </div>
                                    <textarea
                                        placeholder={t('vendor.dashboard.productDescriptionPlaceholder')}
                                        rows={3}
                                        value={productForm.description}
                                        onChange={(e) => handleProductChange('description', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none resize-none"
                                    />

                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleCancelEdit}
                                            className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded-lg hover:bg-red-500/30 transition-all"
                                        >
                                            {t('vendor.dashboard.cancel')}
                                        </button>
                                        <button
                                            onClick={editingProduct ? handleUpdateProduct : handleAddProduct}
                                            disabled={isAddingProduct || isUpdatingProduct || isUploadingImage}
                                            className="flex-1 px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] transition-all disabled:opacity-50"
                                        >
                                            {isAddingProduct || isUpdatingProduct || isUploadingImage ? (
                                                <><Loader2 className="w-4 h-4 inline mr-2 animate-spin" />{editingProduct ? t('vendor.dashboard.saving') : t('vendor.dashboard.adding')}</>
                                            ) : (
                                                editingProduct ? t('vendor.dashboard.saveChanges') : t('vendor.dashboard.createProduct')
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <h3 className="text-xl font-black text-white">{t('vendor.dashboard.yourProducts')}</h3>
                        {products && products.length > 0 ? (
                            <div className="grid md:grid-cols-2 gap-6">
                                {products.map((product) => (
                                    <div key={product.id} className="bg-white/[0.02] border border-white/5 rounded-lg p-6 hover:border-[#d3da0c]/30 transition-all">
                                        <div className="flex items-start gap-4 mb-4">
                                            {product.image_url ? (
                                                <img src={product.image_url} alt={product.name} className="w-20 h-20 rounded-lg object-cover bg-white/5" />
                                            ) : (
                                                <div className="w-20 h-20 rounded-lg bg-white/5 flex items-center justify-center">
                                                    <Package className="w-8 h-8 text-gray-500" />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <h4 className="text-white font-bold text-lg">{product.name}</h4>
                                                <p className="text-gray-400 text-sm mt-1">{t('vendor.dashboard.productId', { id: String(product.id).slice(0, 8) })}</p>
                                                {product.category && (
                                                    <span className="inline-block mt-1 px-2 py-0.5 bg-white/10 rounded text-xs text-gray-400 capitalize">
                                                        {product.category}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${product.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {product.status === 'active' ? t('vendor.dashboard.statusActive') : t('vendor.dashboard.statusInactive')}
                                            </span>
                                        </div>
                                        <p className="text-[#d3da0c] text-2xl font-black mb-4">¥{product.price}</p>
                                        <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                                            <span>{t('vendor.dashboard.stock', { quantity: product.stock_quantity ?? 'N/A' })}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEditProduct(product)}
                                                disabled={isDeletingProduct === product.id}
                                                className="flex-1 px-3 py-2 bg-blue-500/20 text-blue-400 font-bold rounded-lg hover:bg-blue-500/30 transition-all text-sm disabled:opacity-50"
                                            >
                                                <Edit className="w-3 h-3 inline mr-1" />
                                                {t('vendor.dashboard.edit')}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteProduct(product.id)}
                                                disabled={isDeletingProduct === product.id}
                                                className="flex-1 px-3 py-2 bg-red-500/20 text-red-400 font-bold rounded-lg hover:bg-red-500/30 transition-all text-sm disabled:opacity-50"
                                            >
                                                {isDeletingProduct === product.id ? (
                                                    <><Loader2 className="w-3 h-3 inline mr-1 animate-spin" />{t('vendor.dashboard.deleting')}</>
                                                ) : (
                                                    <><Trash2 className="w-3 h-3 inline mr-1" />{t('vendor.dashboard.delete')}</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState message={t('vendor.dashboard.noProducts')} icon={Package} />
                        )}
                    </div>
                )}

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h3 className="text-xl font-black text-white">{t('vendor.dashboard.orderManagement')}</h3>
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-400" />
                                <select
                                    value={orderFilter}
                                    onChange={(e) => setOrderFilter(e.target.value as typeof orderFilter)}
                                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-[#d3da0c] outline-none"
                                >
                                    <option value="all" className="bg-[#111111]">{t('vendor.dashboard.filterAll') || 'All'}</option>
                                    <option value="pending" className="bg-[#111111]">{t('vendor.dashboard.filterPending') || 'Pending'}</option>
                                    <option value="approved" className="bg-[#111111]">{t('vendor.dashboard.filterApproved') || 'Approved'}</option>
                                    <option value="rejected" className="bg-[#111111]">{t('vendor.dashboard.filterRejected') || 'Rejected'}</option>
                                </select>
                            </div>
                        </div>

                        {productOrdersLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                            </div>
                        ) : productOrders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-white/10">
                                        <tr className="text-gray-400 text-xs uppercase font-bold">
                                            <th className="text-left py-3 px-4">{t('vendor.dashboard.customerHeader')}</th>
                                            <th className="text-left py-3 px-4">{t('vendor.dashboard.productHeader')}</th>
                                            <th className="text-left py-3 px-4">{t('vendor.dashboard.totalHeader')}</th>
                                            <th className="text-left py-3 px-4">{t('vendor.dashboard.statusHeader')}</th>
                                            <th className="text-left py-3 px-4">{t('vendor.dashboard.paymentHeader') || 'Payment'}</th>
                                            <th className="text-left py-3 px-4">{t('vendor.dashboard.actionsHeader') || 'Actions'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productOrders.map((order) => (
                                            <tr key={order.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                                <td className="py-3 px-4">
                                                    <p className="text-white font-medium">{order.user?.name || order.payer_name || t('vendor.dashboard.unknownCustomer')}</p>
                                                    <p className="text-gray-500 text-xs">{order.user?.email}</p>
                                                </td>
                                                <td className="py-3 px-4 text-gray-400">{order.product?.name || t('vendor.dashboard.unknownProduct')}</td>
                                                <td className="py-3 px-4 text-[#d3da0c] font-bold">¥{order.payment_amount}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${order.status === 'approved' ? 'bg-green-500/20 text-green-400' : order.status === 'rejected' ? 'bg-red-500/20 text-red-400' : order.status === 'used' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                        {order.status === 'approved' ? (t('vendor.dashboard.statusApproved') || 'Approved') : order.status === 'rejected' ? (t('vendor.dashboard.statusRejected') || 'Rejected') : order.status === 'used' ? (t('vendor.dashboard.statusUsed') || 'Used') : (t('vendor.dashboard.statusPending') || 'Pending')}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {order.payment_screenshot ? (
                                                        <button
                                                            onClick={() => setViewScreenshotOrder(order)}
                                                            className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-[#d3da0c]/50 transition-all"
                                                        >
                                                            <img
                                                                src={order.payment_screenshot.startsWith('http') ? order.payment_screenshot : `${API_BASE_URL.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')}${order.payment_screenshot}`}
                                                                alt="Screenshot"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-500 text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {order.status === 'pending' ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => approveOrder(order.id)}
                                                                disabled={processingOrderId === order.id}
                                                                className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50"
                                                            >
                                                                {processingOrderId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 inline mr-1" />{t('vendor.dashboard.approve') || 'Approve'}</>}
                                                            </button>
                                                            <button
                                                                onClick={() => { setRejectingOrder(order); setRejectReason(''); }}
                                                                disabled={processingOrderId === order.id}
                                                                className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50"
                                                            >
                                                                <X className="w-3 h-3 inline mr-1" />
                                                                {t('vendor.dashboard.reject') || 'Reject'}
                                                            </button>
                                                        </div>
                                                    ) : order.status === 'approved' && order.order_qr_code ? (
                                                        <button
                                                            onClick={() => setViewQrOrder(order)}
                                                            className="px-3 py-1.5 bg-[#d3da0c]/20 text-[#d3da0c] text-xs font-bold rounded-lg hover:bg-[#d3da0c]/30 transition-all flex items-center gap-1"
                                                        >
                                                            <QrCode className="w-3 h-3" />
                                                            {t('vendor.dashboard.viewQr') || 'QR Code'}
                                                        </button>
                                                    ) : order.status === 'rejected' && order.rejection_reason ? (
                                                        <span className="text-red-400 text-xs">{order.rejection_reason}</span>
                                                    ) : (
                                                        <span className="text-gray-500 text-xs">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState message={t('vendor.dashboard.noOrdersReceived')} icon={ShoppingBag} />
                        )}

                        {/* View Screenshot Modal */}
                        {viewScreenshotOrder && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                                <div className="bg-[#111111] border border-white/10 rounded-2xl p-4 max-w-md w-full">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-white font-bold">{t('vendor.dashboard.paymentScreenshot') || 'Payment Screenshot'}</h4>
                                        <button onClick={() => setViewScreenshotOrder(null)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
                                    </div>
                                    <img
                                        src={viewScreenshotOrder.payment_screenshot.startsWith('http') ? viewScreenshotOrder.payment_screenshot : `${API_BASE_URL.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')}${viewScreenshotOrder.payment_screenshot}`}
                                        alt="Payment Screenshot"
                                        className="w-full rounded-lg"
                                    />
                                </div>
                            </div>
                        )}

                        {/* View QR Modal */}
                        {viewQrOrder && viewQrOrder.order_qr_code && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                                <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-white font-bold">{t('vendor.dashboard.orderQrCode') || 'Order QR Code'}</h4>
                                        <button onClick={() => setViewQrOrder(null)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
                                    </div>
                                    <img src={viewQrOrder.order_qr_code} alt="QR Code" className="w-48 h-48 mx-auto rounded-lg" />
                                    <p className="text-[#d3da0c] font-bold mt-4">{viewQrOrder.order_code}</p>
                                    <p className="text-gray-400 text-sm mt-1">{viewQrOrder.product?.name}</p>
                                </div>
                            </div>
                        )}

                        {/* Reject Modal */}
                        {rejectingOrder && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                                <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 max-w-md w-full">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-white font-bold">{t('vendor.dashboard.rejectOrder') || 'Reject Order'}</h4>
                                        <button onClick={() => { setRejectingOrder(null); setRejectReason(''); }} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-4">{t('vendor.dashboard.rejectReasonPrompt') || 'Please provide a reason for rejection.'}</p>
                                    <textarea
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        placeholder={t('vendor.dashboard.rejectReasonPlaceholder') || 'Reason...'}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none resize-none mb-4"
                                    />
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setRejectingOrder(null); setRejectReason(''); }}
                                            className="flex-1 px-4 py-2 bg-white/5 text-gray-400 font-bold rounded-lg hover:bg-white/10 transition-all"
                                        >
                                            {t('vendor.dashboard.cancel')}
                                        </button>
                                        <button
                                            onClick={() => rejectOrder(rejectingOrder.id, rejectReason)}
                                            disabled={!rejectReason.trim() || processingOrderId === rejectingOrder.id}
                                            className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50"
                                        >
                                            {processingOrderId === rejectingOrder.id ? <Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> : null}
                                            {t('vendor.dashboard.confirmReject') || 'Reject'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Events Tab */}
                {activeTab === 'events' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-white">{t('vendor.dashboard.eventBoothsAndApplications')}</h3>
                            <button
                                onClick={handleApplyForBooth}
                                className="px-6 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] transition-all"
                            >
                                <Plus className="w-4 h-4 inline mr-2" />
                                {t('vendor.dashboard.applyForBooth')}
                            </button>
                        </div>
                        {eventsError && (
                            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                {eventsError}
                            </div>
                        )}
                        {isLoadingEvents ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                            </div>
                        ) : events.length > 0 ? (
                            <div className="grid gap-6">
                                {events.map((event) => (
                                    <div key={event.id} className="bg-white/[0.02] border border-white/5 rounded-lg p-6 hover:border-[#d3da0c]/30 transition-all">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h4 className="text-white font-bold text-lg mb-2">{event.name || event.event_name || t('vendor.dashboard.unnamedEvent')}</h4>
                                                <div className="flex flex-wrap gap-4 text-gray-400 text-sm">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-4 h-4 text-[#d3da0c]" />
                                                        {event.date || event.event_date || 'TBD'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-4 h-4 text-[#d3da0c]" />
                                                        {t('vendor.dashboard.boothLabel', { booth: event.booth || event.booth_number || t('vendor.dashboard.tbd') })}
                                                    </span>
                                                    {event.capacity && <span>{t('vendor.dashboard.capacityLabel', { capacity: event.capacity })}</span>}
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${event.status === 'approved' ? 'bg-green-500/20 text-green-400' : event.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                {event.status === 'approved' ? t('vendor.dashboard.statusApproved') : event.status === 'rejected' ? t('vendor.dashboard.statusRejected') : t('vendor.dashboard.statusPending')}
                                            </span>
                                        </div>
                                        {event.status === 'pending' && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleCancelEventApplication(event.id)}
                                                    className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded-lg hover:bg-red-500/30 transition-all text-sm"
                                                >
                                                    <X className="w-3 h-3 inline mr-2" />
                                                    {t('vendor.dashboard.cancelApplication')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState message={t('vendor.dashboard.noEventBooths')} icon={Calendar} />
                        )}
                    </div>
                )}

                {/* Reviews Tab */}
                {activeTab === 'reviews' && (
                    <div className="space-y-6">
                        <h3 className="text-xl font-black text-white">{t('vendor.dashboard.customerReviews')}</h3>
                        {isLoadingReviews ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                            </div>
                        ) : reviews.length > 0 ? (
                            <div className="grid gap-4">
                                {reviews.map((review) => (
                                    <div key={review.id} className="bg-white/[0.02] border border-white/5 rounded-lg p-6">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="text-white font-bold">{review.customer || review.customer_name || t('vendor.dashboard.anonymous')}</p>
                                                <p className="text-gray-400 text-sm">{review.date || review.created_at ? new Date(review.date || review.created_at).toLocaleDateString() : ''}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star key={i} className={`w-4 h-4 ${i < (review.rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}`} />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-gray-300">{review.comment || review.review || t('vendor.dashboard.noComment')}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState message={t('vendor.dashboard.noReviews')} icon={Star} />
                        )}
                    </div>
                )}

                {/* Profile Tab - NEW */}
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-white">{t('vendor.dashboard.vendorProfile')}</h3>
                            {vendorProfile?.is_verified && (
                                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    {t('vendor.dashboard.verified')}
                                </span>
                            )}
                        </div>

                        <div className="grid lg:grid-cols-3 gap-8">
                            {/* Profile Form */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Logo Upload */}
                                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                                    <label className="block text-sm text-gray-400 mb-4">{t('vendor.dashboard.businessLogo')}</label>
                                    <div className="flex items-center gap-6">
                                        <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden">
                                            {profileLogoPreview ? (
                                                <img src={profileLogoPreview} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                <Store className="w-10 h-10 text-gray-500" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoChange}
                                                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#d3da0c] file:text-black file:font-bold hover:file:bg-[#bbc10b]"
                                            />
                                            <p className="text-xs text-gray-500 mt-2">{t('vendor.dashboard.logoUploadHint')}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Business Information */}
                                <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
                                    <h4 className="text-white font-bold">{t('vendor.dashboard.businessInformation')}</h4>

                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">{t('vendor.dashboard.businessNameRequiredLabel')}</label>
                                        <input
                                            type="text"
                                            placeholder={t('vendor.dashboard.businessNamePlaceholder')}
                                            value={profileForm.business_name}
                                            onChange={(e) => handleProfileChange('business_name', e.target.value)}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">{t('vendor.dashboard.businessCategory')}</label>
                                        <select
                                            value={profileForm.vendor_type}
                                            onChange={(e) => handleProfileChange('vendor_type', e.target.value)}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                                        >
                                            <option value="" className="bg-[#111111]">{t('vendor.dashboard.selectCategory')}</option>
                                            <option value="food" className="bg-[#111111]">{t('vendor.dashboard.categoryFood')}</option>
                                            <option value="beverage" className="bg-[#111111]">{t('vendor.dashboard.categoryBeverage')}</option>
                                            <option value="merch" className="bg-[#111111]">{t('vendor.dashboard.categoryMerchandise')}</option>
                                            <option value="service" className="bg-[#111111]">{t('vendor.dashboard.categoryService')}</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">{t('vendor.dashboard.businessDescription')}</label>
                                        <textarea
                                            placeholder={t('vendor.dashboard.businessDescriptionPlaceholder')}
                                            rows={4}
                                            value={profileForm.description}
                                            onChange={(e) => handleProfileChange('description', e.target.value)}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Contact Information */}
                                <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
                                    <h4 className="text-white font-bold">{t('vendor.dashboard.contactInformation')}</h4>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                                                <Mail className="w-4 h-4" />
                                                {t('vendor.dashboard.emailLabel')}
                                            </label>
                                            <input
                                                type="email"
                                                placeholder={t('vendor.dashboard.emailPlaceholder')}
                                                value={profileForm.email}
                                                onChange={(e) => handleProfileChange('email', e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                                                <Phone className="w-4 h-4" />
                                                {t('vendor.dashboard.phoneLabel')}
                                            </label>
                                            <input
                                                type="tel"
                                                placeholder={t('vendor.dashboard.phonePlaceholder')}
                                                value={profileForm.phone}
                                                onChange={(e) => handleProfileChange('phone', e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                                            <MapPin className="w-4 h-4" />
                                            {t('vendor.dashboard.businessAddressLabel')}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={t('vendor.dashboard.addressPlaceholder')}
                                            value={profileForm.address}
                                            onChange={(e) => handleProfileChange('address', e.target.value)}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                                            <Globe className="w-4 h-4" />
                                            {t('vendor.dashboard.websiteLabel')}
                                        </label>
                                        <input
                                            type="url"
                                            placeholder={t('vendor.dashboard.websitePlaceholder')}
                                            value={profileForm.website}
                                            onChange={(e) => handleProfileChange('website', e.target.value)}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Save Button */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={resetProfileForm}
                                        className="flex-1 px-4 py-3 bg-white/5 text-gray-400 font-bold rounded-lg hover:bg-white/10 transition-all"
                                    >
                                        {t('vendor.dashboard.reset')}
                                    </button>
                                    <button
                                        onClick={handleUpdateProfile}
                                        disabled={isUpdatingProfile || isUploadingLogo}
                                        className="flex-1 px-4 py-3 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] transition-all disabled:opacity-50"
                                    >
                                        {isUpdatingProfile || isUploadingLogo ? (
                                            <><Loader2 className="w-4 h-4 inline mr-2 animate-spin" />{t('vendor.dashboard.saving')}</>
                                        ) : (
                                            t('vendor.dashboard.saveChanges')
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Profile Preview / Info Card */}
                            <div className="space-y-6">
                                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                                    <h4 className="text-white font-bold mb-4">{t('vendor.dashboard.profilePreview')}</h4>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                                            {profileLogoPreview ? (
                                                <img src={profileLogoPreview} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                <Store className="w-8 h-8 text-gray-500" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{profileForm.business_name || t('vendor.dashboard.yourBusiness')}</p>
                                            <p className="text-gray-400 text-sm capitalize">{profileForm.vendor_type || t('vendor.dashboard.vendorLabel')}</p>
                                        </div>
                                    </div>
                                    {profileForm.description && (
                                        <p className="text-gray-400 text-sm mb-4 line-clamp-3">{profileForm.description}</p>
                                    )}
                                    <div className="space-y-2 text-sm">
                                        {profileForm.email && (
                                            <p className="text-gray-400 flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-[#d3da0c]" />
                                                {profileForm.email}
                                            </p>
                                        )}
                                        {profileForm.phone && (
                                            <p className="text-gray-400 flex items-center gap-2">
                                                <Phone className="w-4 h-4 text-[#d3da0c]" />
                                                {profileForm.phone}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                    <p className="text-blue-400 text-sm">
                                        <span className="font-bold">{t('vendor.dashboard.profileTipLabel')}</span> {t('vendor.dashboard.profileTipText')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default VendorDashboard;
