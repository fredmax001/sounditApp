import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit2, Trash2, Wine, Users, Ticket,
  Loader2, X, Check, Package,
  ChevronDown, ChevronUp, Eye, Clock,
  ImageIcon,
  Martini,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import DrinkMenuManager from '@/components/business/DrinkMenuManager';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

interface EventItem {
  id: number;
  title: string;
  start_date: string;
}

interface TablePackage {
  id: number;
  event_id: number;
  event_title: string;
  name: string;
  price: number;
  description: string;
  included_items: string[];
  drinks: string[];
  extras: string[];
  ticket_quantity: number;
  total_tables?: number;
  max_people: number | null;
  is_active: boolean;
  image_url: string | null;
  drink_menu_image_url: string | null;
}

interface TableOrder {
  id: number;
  package: {
    name: string;
    price: number;
  };
  event: {
    title: string;
    start_date: string;
  };
  user: {
    name: string;
    email: string;
  };
  contact_name: string;
  contact_phone: string;
  guest_count: number;
  guest_names?: string[];
  payment_amount: number;
  payment_screenshot: string;
  status: 'pending' | 'approved' | 'rejected' | 'used' | 'cancelled';
  special_requests: string;
  created_at: string;
  ticket_code?: string;
  ticket_price_snapshot?: number | null;
  allocation_amount?: number | null;
  drink_allowance?: number | null;
  allowance_used?: number | null;
  drink_selections?: Array<{ name: string; qty: number; unit_price: number; mixers?: { name: string; qty: number }[]; line_total: number }>;
  buyer_confirmed_at?: string | null;
  upgrade_request?: { name: string; qty: number; price_snapshot: number; estimated_extra: number; notes?: string; payment_preference?: string } | null;
  upgrade_status?: 'none' | 'pending' | 'approved' | 'declined';
  upgrade_final_price?: number | null;
  upgrade_payment_status?: string | null;
  tickets?: Array<{ id: number; ticket_number: string; is_used?: boolean }>;
  ticket_qr?: string;
}

export default function BusinessTableReservations() {
  const { t } = useTranslation();
  useSubscriptionGuard('table_reservations');
  const { session } = useAuthStore();
  const token = session?.access_token;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'packages' | 'orders' | 'drinks'>('packages');
  const [drinksEventId, setDrinksEventId] = useState<number | null>(null);
  const [allocationPct, setAllocationPct] = useState<string>('');
  const [savingAlloc, setSavingAlloc] = useState(false);
  const [packages, setPackages] = useState<TablePackage[]>([]);
  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<TablePackage | null>(null);
  const [processingOrder, setProcessingOrder] = useState<number | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [selectedQrOrder, setSelectedQrOrder] = useState<TableOrder | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [drinkMenuImageFile, setDrinkMenuImageFile] = useState<File | null>(null);
  const [editDrinkMenuImageFile, setEditDrinkMenuImageFile] = useState<File | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    event_id: '',
    name: '',
    price: '',
    description: '',
    included_items: [''],
    drinks: [''],
    extras: [''],
    ticket_quantity: '0',
    total_tables: '',
    max_people: '',
  });

  useEffect(() => {
    if (!token) return;
    fetchEvents();
    fetchData();
  }, [token, activeTab]);

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/events/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(res.data || []);
      if (res.data?.length && !drinksEventId) {
        setDrinksEventId(res.data[0].id);
      }
    } catch (error) {
      // silent fail
    }
  };

  // Load the selected event's current allocation % when the drinks tab event changes
  useEffect(() => {
    if (!drinksEventId || !token) return;
    axios.get(`${API_BASE_URL}/events/${drinksEventId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setAllocationPct(res.data?.table_allocation_percent != null ? String(res.data.table_allocation_percent) : ''))
      .catch(() => setAllocationPct(''));
  }, [drinksEventId, token]);

  const saveAllocation = async () => {
    if (!drinksEventId) return;
    setSavingAlloc(true);
    try {
      await axios.put(`${API_BASE_URL}/events/${drinksEventId}`,
        { table_allocation_percent: allocationPct === '' ? null : parseFloat(allocationPct) },
        { headers: { Authorization: `Bearer ${token}` } });
      toast.success(t('tables.allocSaved', 'Table allocation saved'));
    } catch {
      toast.error(t('kit.editProfile.saveFailed'));
    } finally {
      setSavingAlloc(false);
    }
  };

  const resolveUpgrade = async (orderId: number, action: 'approve' | 'decline') => {
    setProcessingOrder(orderId);
    try {
      const finalPrice = parseFloat((document.getElementById(`final-${orderId}`) as HTMLInputElement)?.value || '');
      const paymentStatus = (document.getElementById(`payst-${orderId}`) as HTMLSelectElement)?.value || 'pending';
      await axios.post(`${API_BASE_URL}/tables/business/orders/${orderId}/upgrade/${action}`,
        action === 'approve' ? { final_price: isNaN(finalPrice) ? undefined : finalPrice, payment_status: paymentStatus } : {},
        { headers: { Authorization: `Bearer ${token}` } });
      toast.success(action === 'approve' ? t('tables.upgradeApproved', 'Upgrade approved') : t('tables.upgradeDeclined', 'Upgrade declined'));
      fetchData();
    } catch (error) {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || t('business.tableReservations.failedToLoadData'));
    } finally {
      setProcessingOrder(null);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'packages') {
        const res = await axios.get(`${API_BASE_URL}/tables/business/packages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPackages(res.data);
      } else if (activeTab === 'orders') {
        const res = await axios.get(`${API_BASE_URL}/tables/business/orders`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrders(res.data);
      }
    } catch (error) {
      const axiosError = error as { response?: { data?: { detail?: { message?: string } }; status?: number } };
      const message = axiosError.response?.data?.detail?.message || t('business.tableReservations.failedToLoadData');
      toast.error(message);

      if (axiosError.response?.status === 403) {
        navigate('/subscriptions');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          form.append(key, JSON.stringify(value.filter(v => v.trim())));
        } else if (key === 'total_tables' && value === '') {
          // Default to 1 if not specified
          form.append(key, '1');
        } else {
          form.append(key, value);
        }
      });
      if (imageFile) {
        form.append('image', imageFile);
      }
      if (drinkMenuImageFile) {
        form.append('drink_menu_image', drinkMenuImageFile);
      }

      await axios.post(`${API_BASE_URL}/tables/business/packages`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(t('business.tableReservations.packageCreated'));
      setShowCreateModal(false);
      resetForm();
      setDrinkMenuImageFile(null);
      fetchData();
    } catch (error) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('business.tableReservations.failedToCreatePackage'));
    }
  };

  const handleUpdatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackage) return;
    try {
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'event_id') return; // PUT endpoint doesn't support changing event
        if (Array.isArray(value)) {
          form.append(key, JSON.stringify(value.filter(v => v.trim())));
        } else if (value !== '' && value !== undefined && value !== null) {
          form.append(key, value);
        } else if (key === 'total_tables' && value === '') {
          // Explicitly send 0 when cleared
          form.append(key, '0');
        }
      });
      if (editImageFile) {
        form.append('image', editImageFile);
      }
      if (editDrinkMenuImageFile) {
        form.append('drink_menu_image', editDrinkMenuImageFile);
      }

      await axios.put(`${API_BASE_URL}/tables/business/packages/${editingPackage.id}`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(t('business.tableReservations.packageUpdated') || 'Package updated');
      setShowEditModal(false);
      setEditingPackage(null);
      setEditImageFile(null);
      setEditDrinkMenuImageFile(null);
      resetForm();
      fetchData();
    } catch (error) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('business.tableReservations.failedToUpdatePackage') || 'Failed to update package');
    }
  };

  const handleDeletePackage = async (id: number) => {
    if (!confirm(t('business.tableReservations.deletePackageConfirm'))) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/tables/business/packages/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t('business.tableReservations.packageDeleted'));
      fetchData();
    } catch (error) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('business.tableReservations.failedToDeletePackage'));
    }
  };

  const handleApproveOrder = async (orderId: number) => {
    try {
      setProcessingOrder(orderId);
      await axios.post(`${API_BASE_URL}/tables/business/orders/${orderId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t('business.tableReservations.orderApproved'));
      fetchData();
    } catch (error) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('business.tableReservations.failedToApproveOrder'));
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleRejectOrder = async (orderId: number) => {
    const reason = prompt(t('business.tableReservations.rejectionReasonPrompt'));
    if (!reason) return;
    
    try {
      setProcessingOrder(orderId);
      const form = new FormData();
      form.append('reason', reason);
      await axios.post(`${API_BASE_URL}/tables/business/orders/${orderId}/reject`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t('business.tableReservations.orderRejected'));
      fetchData();
    } catch (error) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || t('business.tableReservations.failedToRejectOrder'));
    } finally {
      setProcessingOrder(null);
    }
  };

  const openEditModal = (pkg: TablePackage) => {
    setEditingPackage(pkg);
    setFormData({
      event_id: String(pkg.event_id),
      name: pkg.name,
      price: String(pkg.price),
      description: pkg.description || '',
      included_items: pkg.included_items?.length ? [...pkg.included_items] : [''],
      drinks: pkg.drinks?.length ? [...pkg.drinks] : [''],
      extras: pkg.extras?.length ? [...pkg.extras] : [''],
      ticket_quantity: String(pkg.ticket_quantity || 0),
      total_tables: String(pkg.total_tables ?? ''),
      max_people: String(pkg.max_people || ''),
    });
    setEditImageFile(null);
    setEditDrinkMenuImageFile(null);
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      event_id: '',
      name: '',
      price: '',
      description: '',
      included_items: [''],
      drinks: [''],
      extras: [''],
      ticket_quantity: '0',
      total_tables: '',
      max_people: '',
    });
    setImageFile(null);
    setEditImageFile(null);
    setDrinkMenuImageFile(null);
    setEditDrinkMenuImageFile(null);
  };

  const addArrayField = (field: 'included_items' | 'drinks' | 'extras') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const updateArrayField = (field: 'included_items' | 'drinks' | 'extras', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const removeArrayField = (field: 'included_items' | 'drinks' | 'extras', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">{t('business.tableReservations.title')}</h1>
            <p className="text-white/60 mt-1">{t('business.tableReservations.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#141414] rounded-xl p-1">
              <button
                onClick={() => setActiveTab('packages')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'packages' 
                    ? 'bg-[#d3da0c] text-black' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Package className="w-4 h-4 inline mr-2" />
                {t('business.tableReservations.packagesTab')}
              </button>
              <button
                onClick={() => setActiveTab('drinks')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'drinks' 
                    ? 'bg-[#d3da0c] text-black' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Martini className="w-4 h-4 inline mr-2" />
                {t('tables.drinksTab', 'Drinks')}
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'orders' 
                    ? 'bg-[#d3da0c] text-black' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Wine className="w-4 h-4 inline mr-2" />
                {t('business.tableReservations.bookingsTab')}
                {orders.filter(o => o.status === 'pending').length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {orders.filter(o => o.status === 'pending').length}
                  </span>
                )}
              </button>
            </div>
            {activeTab === 'packages' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-[#d3da0c] text-black font-medium rounded-xl hover:bg-[#bbc10b] transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {t('business.tableReservations.newPackage')}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {activeTab === 'drinks' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 bg-[#141414] border border-white/10 rounded-2xl p-4">
              {events.length > 1 && (
                <select value={drinksEventId ?? ''} onChange={e => setDrinksEventId(Number(e.target.value))}
                  className="bg-[#0A0A0A] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5">
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
              )}
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <label className="text-white/60 text-xs whitespace-nowrap">{t('tables.tableAllocationPct', 'Table allocation (% of one ticket price, once per table)')}</label>
                <input type="number" min={0} max={100} value={allocationPct} onChange={e => setAllocationPct(e.target.value)}
                  className="w-20 bg-[#0A0A0A] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5" />
                <button onClick={saveAllocation} disabled={savingAlloc}
                  className="h-9 px-4 rounded-lg bg-[#d3da0c] text-black text-xs font-bold hover:bg-[#bbc10b] transition-colors disabled:opacity-50">
                  {savingAlloc ? t('kit.common.save') : t('kit.common.save')}
                </button>
              </div>
            </div>
            <DrinkMenuManager eventId={drinksEventId} />
          </div>
        ) : activeTab === 'packages' ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden"
              >
                {pkg.image_url ? (
                  <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${pkg.image_url})` }} />
                ) : (
                  <div className="h-48 bg-gradient-to-br from-[#d3da0c]/20 to-[#d3da0c]/5 flex items-center justify-center">
                    <Wine className="w-16 h-16 text-[#d3da0c]/40" />
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{pkg.name}</h3>
                      <p className="text-[#d3da0c] text-lg font-semibold">¥{pkg.price}</p>
                    </div>
                    {!pkg.is_active && (
                      <span className="px-2 py-1 bg-red-500/20 text-red-500 text-xs rounded-full">
                        {t('business.tableReservations.inactive')}
                      </span>
                    )}
                  </div>

                  <p className="text-white/60 text-sm mb-4 line-clamp-2">{pkg.description}</p>

                  <div className="space-y-2 mb-4">
                    {pkg.included_items?.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-white/80 text-sm">
                        <Check className="w-4 h-4 text-[#d3da0c]" />
                        {item}
                      </div>
                    ))}
                    {pkg.included_items?.length > 3 && (
                      <p className="text-white/40 text-sm">{t('business.tableReservations.moreItems', { count: pkg.included_items.length - 3 })}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-white/60 text-sm mb-4 flex-wrap">
                    {pkg.ticket_quantity > 0 && (
                      <div className="flex items-center gap-1">
                        <Ticket className="w-4 h-4" />
                        {t('business.tableReservations.ticketsCount', { count: pkg.ticket_quantity })}
                      </div>
                    )}
                    {pkg.max_people && (
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {t('business.tableReservations.maxPeople', { count: pkg.max_people })}
                      </div>
                    )}
                    {pkg.total_tables !== undefined && pkg.total_tables !== null && (
                      <div className="flex items-center gap-1">
                        <Wine className="w-4 h-4" />
                        {pkg.total_tables} tables
                      </div>
                    )}
                    {pkg.drink_menu_image_url && (
                      <div className="flex items-center gap-1 text-[#d3da0c]">
                        <ImageIcon className="w-4 h-4" />
                        Menu
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(pkg)}
                      className="flex-1 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      {t('business.tableReservations.edit')}
                    </button>
                    <button
                      onClick={() => handleDeletePackage(pkg.id)}
                      className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            {packages.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <Wine className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">{t('business.tableReservations.noPackages')}</h3>
                <p className="text-white/60 mb-6">{t('business.tableReservations.noPackagesHint')}</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-[#d3da0c] text-black font-medium rounded-xl hover:bg-[#bbc10b] transition-colors"
                >
                  {t('business.tableReservations.createFirstPackage')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden"
              >
                <div 
                  className="p-6 cursor-pointer"
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                        order.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                        'bg-red-500/20 text-red-500'
                      }`}>
                        {order.status === 'pending' ? <Clock className="w-6 h-6" /> :
                         order.status === 'approved' ? <Check className="w-6 h-6" /> :
                         <X className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{order.package.name}</h3>
                        <p className="text-white/60 text-sm">{order.event.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-white font-semibold">¥{order.payment_amount}</p>
                        <p className="text-white/60 text-sm">{order.contact_name}</p>
                      </div>
                      {expandedOrder === order.id ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedOrder === order.id && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="border-t border-white/10"
                    >
                      <div className="p-6 space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-white/5 rounded-xl p-4">
                            <p className="text-white/60 text-sm mb-1">{t('business.tableReservations.contactInfo')}</p>
                            <p className="text-white font-medium">{order.contact_name}</p>
                            <p className="text-white/60">{order.contact_phone}</p>
                            {order.user.email && <p className="text-white/60">{order.user.email}</p>}
                          </div>
                          <div className="bg-white/5 rounded-xl p-4">
                            <p className="text-white/60 text-sm mb-1">{t('business.tableReservations.bookingDetails')}</p>
                            <p className="text-white">{t('business.tableReservations.guestsCount', { count: order.guest_count || t('business.tableReservations.notSpecified') })}</p>
                            <p className="text-white/60 text-sm">{new Date(order.created_at).toLocaleString()}</p>
                          </div>
                        </div>

                        {order.special_requests && (
                          <div className="bg-white/5 rounded-xl p-4">
                            <p className="text-white/60 text-sm mb-1">{t('business.tableReservations.specialRequests')}</p>
                            <p className="text-white">{order.special_requests}</p>
                          </div>
                        )}

                        {/* Financial breakdown + drink selections (spec §10) */}
                        {order.drink_allowance != null && (
                          <div className="bg-white/5 rounded-xl p-4 space-y-1.5 text-sm">
                            <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">{t('tables.breakdown', 'Financial breakdown')}</p>
                            <div className="flex justify-between"><span className="text-white/60">{t('tables.packagePrice', 'Package price')}</span><span className="text-white">¥{order.payment_amount}</span></div>
                            <div className="flex justify-between"><span className="text-white/60">{t('tables.ticketsDeduction', 'Included tickets')}</span><span className="text-white/80">−¥{((order.ticket_price_snapshot || 0) * order.guest_count).toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-white/60">{t('tables.tableAllocation', 'Table allocation')}</span><span className="text-white/80">−¥{(order.allocation_amount || 0).toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-[#d3da0c]">{t('tables.drinkAllowance', 'Drink allowance')}</span><span className="text-[#d3da0c] font-bold">¥{(order.drink_allowance || 0).toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-white/60">{t('tables.allowanceUsed', 'Selected drinks')}</span><span className="text-white/80">−¥{(order.allowance_used || 0).toLocaleString()}</span></div>
                            {(order.drink_selections?.length || 0) > 0 && (
                              <div className="pt-2 mt-1 border-t border-white/10 space-y-1">
                                {order.drink_selections!.map((d, idx) => (
                                  <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-gray-400">{d.name} ×{d.qty}{(d.mixers?.length || 0) > 0 ? ` · ${d.mixers!.map(m => `${m.name}×${m.qty}`).join(', ')}` : ''}</span>
                                    <span className="text-white">¥{d.line_total.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Upgrade request workflow (spec §7) */}
                        {order.upgrade_request && order.upgrade_status && order.upgrade_status !== 'none' && (
                          <div className={`rounded-xl p-4 border ${order.upgrade_status === 'approved' ? 'bg-[#d3da0c]/10 border-[#d3da0c]/30' : order.upgrade_status === 'declined' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                            <p className={`text-sm font-semibold mb-2 ${order.upgrade_status === 'approved' ? 'text-[#d3da0c]' : order.upgrade_status === 'declined' ? 'text-red-400' : 'text-amber-400'}`}>
                              {order.upgrade_status === 'approved' ? t('tables.upgradeApproved', 'Upgrade approved')
                                : order.upgrade_status === 'declined' ? t('tables.upgradeDeclined', 'Upgrade declined')
                                : t('tables.upgradePending', 'Upgrade requested — pending confirmation')}
                              : {order.upgrade_request.name} ×{order.upgrade_request.qty}
                            </p>
                            <p className="text-white/70 text-xs mb-1">{t('tables.estExtra', 'est. extra')} ¥{order.upgrade_request.estimated_extra}
                              {order.upgrade_status === 'approved' && <> · {t('tables.extraPayment', 'Extra payment')}: ¥{order.upgrade_final_price} ({order.upgrade_payment_status})</>}</p>
                            {order.upgrade_request.notes && <p className="text-white/50 text-xs mb-3">{order.upgrade_request.notes}</p>}
                            {order.upgrade_status === 'pending' && (
                              <div className="flex flex-wrap gap-2">
                                <input type="number" placeholder={t('tables.finalPrice', 'Final price ¥')} id={`final-${order.id}`}
                                  className="w-28 bg-[#0A0A0A] border border-white/10 text-white text-xs rounded-lg px-2 py-2" />
                                <select id={`payst-${order.id}`} className="bg-[#0A0A0A] border border-white/10 text-white text-xs rounded-lg px-2 py-2">
                                  <option value="pending">pending</option>
                                  <option value="paid_online">paid_online</option>
                                  <option value="at_venue">at_venue</option>
                                  <option value="waived">waived</option>
                                </select>
                                <button onClick={() => resolveUpgrade(order.id, 'approve')} disabled={processingOrder === order.id}
                                  className="px-3 py-2 rounded-lg bg-[#d3da0c] text-black text-xs font-bold hover:bg-[#bbc10b] disabled:opacity-50">
                                  {t('tables.approveUpgrade', 'Approve')}
                                </button>
                                <button onClick={() => resolveUpgrade(order.id, 'decline')} disabled={processingOrder === order.id}
                                  className="px-3 py-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50">
                                  {t('tables.declineUpgrade', 'Decline')}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Guest tickets */}
                        {(order.tickets?.length || 0) > 0 && (
                          <div className="bg-white/5 rounded-xl p-4">
                            <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">{t('tables.guestTickets', 'Guest tickets')}</p>
                            <div className="grid grid-cols-2 gap-2">
                              {order.tickets!.map((tk, idx) => (
                                <div key={tk.id} className="bg-[#0A0A0A] rounded-lg px-2.5 py-2">
                                  <p className="text-[10px] text-gray-500">{order.guest_names?.[idx] || `Guest ${idx + 1}`}</p>
                                  <p className="text-[11px] text-white font-mono truncate">{tk.ticket_number}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {order.status === 'approved' && order.ticket_qr && (
                          <div className="bg-white/5 rounded-xl p-4">
                            <p className="text-white/60 text-sm mb-3">{t('business.tableReservations.ticketQr') || 'Ticket QR'}</p>
                            <div className="flex flex-col sm:flex-row items-start gap-4">
                              <div className="bg-white rounded-xl p-4">
                                <img src={order.ticket_qr} alt="Ticket QR" className="w-32 h-32 object-contain" />
                              </div>
                              <div>
                                <p className="text-white font-mono text-sm">{order.ticket_code}</p>
                                <button
                                  onClick={() => setSelectedQrOrder(order)}
                                  className="mt-2 text-[#d3da0c] text-sm hover:underline"
                                >
                                  {t('business.tableReservations.viewLargeQr') || 'View larger'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => window.open(order.payment_screenshot, '_blank')}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            {t('business.tableReservations.viewPaymentProof')}
                          </button>

                          {order.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRejectOrder(order.id)}
                                disabled={processingOrder === order.id}
                                className="px-4 py-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                              >
                                {t('business.tableReservations.reject')}
                              </button>
                              <button
                                onClick={() => handleApproveOrder(order.id)}
                                disabled={processingOrder === order.id}
                                className="px-4 py-2 bg-green-500/10 text-green-500 rounded-xl hover:bg-green-500/20 transition-colors disabled:opacity-50"
                              >
                                {processingOrder === order.id ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  t('business.tableReservations.approve')
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}

            {orders.length === 0 && (
              <div className="py-16 text-center">
                <Wine className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">{t('business.tableReservations.noBookings')}</h3>
                <p className="text-white/60">{t('business.tableReservations.noBookingsHint')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Package Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{t('business.tableReservations.createTablePackage')}</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="p-6 space-y-6">
              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.eventLabel') || 'Event'}</label>
                <select
                  value={formData.event_id}
                  onChange={(e) => setFormData({...formData, event_id: e.target.value})}
                  className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                  required
                >
                  <option value="">{t('business.tableReservations.selectEvent') || 'Select an event'}</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.packageNameLabel')}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder={t('business.tableReservations.packageNamePlaceholder')}
                    className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.priceLabel')}</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.maxPeopleLabel')}</label>
                  <input
                    type="number"
                    value={formData.max_people}
                    onChange={(e) => setFormData({...formData, max_people: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.ticketQuantityLabel') || 'Ticket Quantity'}</label>
                  <input
                    type="number"
                    value={formData.ticket_quantity}
                    onChange={(e) => setFormData({...formData, ticket_quantity: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.totalTablesLabel') || 'Total Tables'}</label>
                  <input
                    type="number"
                    value={formData.total_tables}
                    onChange={(e) => setFormData({...formData, total_tables: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.descriptionLabel')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                />
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.imageLabel') || 'Package Image'}</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                    <span>{imageFile ? imageFile.name : (t('business.tableReservations.chooseImage') || 'Choose image')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {imageFile && (
                    <button
                      type="button"
                      onClick={() => setImageFile(null)}
                      className="text-red-500 text-sm hover:underline"
                    >
                      {t('business.tableReservations.remove') || 'Remove'}
                    </button>
                  )}
                </div>
              </div>

              {/* Drink Menu Image */}
              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.drinkMenuImageLabel') || 'Drink Menu Image'}</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                    <span>{drinkMenuImageFile ? drinkMenuImageFile.name : (t('business.tableReservations.chooseDrinkMenu') || 'Choose drink menu image')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setDrinkMenuImageFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {drinkMenuImageFile && (
                    <button
                      type="button"
                      onClick={() => setDrinkMenuImageFile(null)}
                      className="text-red-500 text-sm hover:underline"
                    >
                      {t('business.tableReservations.remove') || 'Remove'}
                    </button>
                  )}
                </div>
                <p className="text-white/40 text-xs mt-1">{t('business.tableReservations.drinkMenuHint') || 'Upload a menu so customers know what drinks are available'}</p>
              </div>

              {/* Included Items */}
              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.includedItemsLabel')}</label>
                {formData.included_items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateArrayField('included_items', idx, e.target.value)}
                      placeholder={t('business.tableReservations.includedItemPlaceholder')}
                      className="flex-1 bg-[#0A0A0A] border border-white/10 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                    <button
                      type="button"
                      onClick={() => removeArrayField('included_items', idx)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('included_items')}
                  className="text-[#d3da0c] text-sm hover:underline"
                >
                  {t('business.tableReservations.addItem')}
                </button>
              </div>

              {/* Drinks */}
              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.drinksIncludedLabel')}</label>
                {formData.drinks.map((drink, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={drink}
                      onChange={(e) => updateArrayField('drinks', idx, e.target.value)}
                      placeholder={t('business.tableReservations.drinkPlaceholder')}
                      className="flex-1 bg-[#0A0A0A] border border-white/10 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                    <button
                      type="button"
                      onClick={() => removeArrayField('drinks', idx)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('drinks')}
                  className="text-[#d3da0c] text-sm hover:underline"
                >
                  {t('business.tableReservations.addDrink')}
                </button>
              </div>

              {/* Extras */}
              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.extrasLabel') || 'Extras'}</label>
                {formData.extras.map((extra, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={extra}
                      onChange={(e) => updateArrayField('extras', idx, e.target.value)}
                      placeholder={t('business.tableReservations.extraPlaceholder') || 'Extra item'}
                      className="flex-1 bg-[#0A0A0A] border border-white/10 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                    <button
                      type="button"
                      onClick={() => removeArrayField('extras', idx)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('extras')}
                  className="text-[#d3da0c] text-sm hover:underline"
                >
                  {t('business.tableReservations.addExtra') || 'Add extra'}
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 text-white/60 hover:text-white transition-colors"
                >
                  {t('business.tableReservations.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#d3da0c] text-black font-medium rounded-xl hover:bg-[#bbc10b] transition-colors"
                >
                  {t('business.tableReservations.createPackage')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Package Modal */}
      {showEditModal && editingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{t('business.tableReservations.editTablePackage') || 'Edit Table Package'}</h2>
              <button
                onClick={() => { setShowEditModal(false); setEditingPackage(null); setEditImageFile(null); }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleUpdatePackage} className="p-6 space-y-6">
              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.eventLabel') || 'Event'}</label>
                <select
                  value={formData.event_id}
                  disabled
                  className="w-full bg-[#0A0A0A] border border-white/10 text-white/60 px-4 py-3 rounded-xl focus:outline-none cursor-not-allowed"
                >
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.packageNameLabel')}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder={t('business.tableReservations.packageNamePlaceholder')}
                    className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.priceLabel')}</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.maxPeopleLabel')}</label>
                  <input
                    type="number"
                    value={formData.max_people}
                    onChange={(e) => setFormData({...formData, max_people: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.ticketQuantityLabel') || 'Ticket Quantity'}</label>
                  <input
                    type="number"
                    value={formData.ticket_quantity}
                    onChange={(e) => setFormData({...formData, ticket_quantity: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>
                <div>
                  <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.totalTablesLabel') || 'Total Tables'}</label>
                  <input
                    type="number"
                    value={formData.total_tables}
                    onChange={(e) => setFormData({...formData, total_tables: e.target.value})}
                    className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.descriptionLabel')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                />
              </div>

              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.imageLabel') || 'Package Image'}</label>
                <div className="flex items-center gap-4">
                  {editingPackage.image_url && !editImageFile && (
                    <div className="relative">
                      <img src={editingPackage.image_url} alt="Current" className="w-16 h-16 object-cover rounded-xl" />
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                    <span>{editImageFile ? editImageFile.name : (t('business.tableReservations.chooseImage') || 'Choose image')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {(editImageFile || editingPackage.image_url) && (
                    <button
                      type="button"
                      onClick={() => { setEditImageFile(null); }}
                      className="text-red-500 text-sm hover:underline"
                    >
                      {t('business.tableReservations.remove') || 'Remove'}
                    </button>
                  )}
                </div>
              </div>

              {/* Drink Menu Image */}
              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.drinkMenuImageLabel') || 'Drink Menu Image'}</label>
                <div className="flex items-center gap-4">
                  {editingPackage.drink_menu_image_url && !editDrinkMenuImageFile && (
                    <div className="relative">
                      <img src={editingPackage.drink_menu_image_url} alt="Drink Menu" className="w-16 h-16 object-cover rounded-xl" />
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                    <span>{editDrinkMenuImageFile ? editDrinkMenuImageFile.name : (t('business.tableReservations.chooseDrinkMenu') || 'Choose drink menu image')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditDrinkMenuImageFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {(editDrinkMenuImageFile || editingPackage.drink_menu_image_url) && (
                    <button
                      type="button"
                      onClick={() => { setEditDrinkMenuImageFile(null); }}
                      className="text-red-500 text-sm hover:underline"
                    >
                      {t('business.tableReservations.remove') || 'Remove'}
                    </button>
                  )}
                </div>
                <p className="text-white/40 text-xs mt-1">{t('business.tableReservations.drinkMenuHint') || 'Upload a menu so customers know what drinks are available'}</p>
              </div>

              {/* Included Items */}
              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.includedItemsLabel')}</label>
                {formData.included_items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateArrayField('included_items', idx, e.target.value)}
                      placeholder={t('business.tableReservations.includedItemPlaceholder')}
                      className="flex-1 bg-[#0A0A0A] border border-white/10 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                    <button
                      type="button"
                      onClick={() => removeArrayField('included_items', idx)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('included_items')}
                  className="text-[#d3da0c] text-sm hover:underline"
                >
                  {t('business.tableReservations.addItem')}
                </button>
              </div>

              {/* Drinks */}
              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.drinksIncludedLabel')}</label>
                {formData.drinks.map((drink, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={drink}
                      onChange={(e) => updateArrayField('drinks', idx, e.target.value)}
                      placeholder={t('business.tableReservations.drinkPlaceholder')}
                      className="flex-1 bg-[#0A0A0A] border border-white/10 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                    <button
                      type="button"
                      onClick={() => removeArrayField('drinks', idx)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('drinks')}
                  className="text-[#d3da0c] text-sm hover:underline"
                >
                  {t('business.tableReservations.addDrink')}
                </button>
              </div>

              {/* Extras */}
              <div>
                <label className="block text-white/60 text-sm mb-2">{t('business.tableReservations.extrasLabel') || 'Extras'}</label>
                {formData.extras.map((extra, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={extra}
                      onChange={(e) => updateArrayField('extras', idx, e.target.value)}
                      placeholder={t('business.tableReservations.extraPlaceholder') || 'Extra item'}
                      className="flex-1 bg-[#0A0A0A] border border-white/10 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                    <button
                      type="button"
                      onClick={() => removeArrayField('extras', idx)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('extras')}
                  className="text-[#d3da0c] text-sm hover:underline"
                >
                  {t('business.tableReservations.addExtra') || 'Add extra'}
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingPackage(null); setEditImageFile(null); }}
                  className="px-6 py-3 text-white/60 hover:text-white transition-colors"
                >
                  {t('business.tableReservations.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#d3da0c] text-black font-medium rounded-xl hover:bg-[#bbc10b] transition-colors"
                >
                  {t('business.tableReservations.saveChanges') || 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* QR View Modal */}
      <AnimatePresence>
        {selectedQrOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedQrOrder(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#141414] border border-white/10 rounded-2xl p-8 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">{t('business.tableReservations.ticketQr') || 'Ticket QR'}</h3>
                <button
                  onClick={() => setSelectedQrOrder(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-white rounded-xl p-6 mb-6">
                {selectedQrOrder.ticket_qr ? (
                  <img src={selectedQrOrder.ticket_qr} alt="Ticket QR" className="w-full h-auto" />
                ) : (
                  <div className="text-center text-black">No QR available</div>
                )}
              </div>
              <div className="text-center">
                <p className="text-white font-semibold mb-1">
                  {selectedQrOrder.package?.name}
                </p>
                <p className="text-[#d3da0c] text-sm mt-2 font-mono">{selectedQrOrder.ticket_code}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
