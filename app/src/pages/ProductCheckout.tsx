import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, CreditCard, Loader2, MapPin, User, Phone, MessageSquare, Check, Store } from 'lucide-react';
import { useVendorMarketplaceStore } from '@/store/vendorMarketplaceStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface VendorPaymentSettings {
    wechat_qr_url?: string;
    wechat_display_name?: string;
    alipay_qr_url?: string;
    alipay_display_name?: string;
    preferred_method?: string;
}

interface VendorInfo {
    id: number;
    business_name: string;
    logo_url?: string;
}

export default function ProductCheckout() {
    const { vendorId } = useParams<{ vendorId: string }>();
    const navigate = useNavigate();
    const { session } = useAuthStore();
    const cart = useVendorMarketplaceStore((s) => s.getCart(vendorId || '0'));
    const getCartTotal = useVendorMarketplaceStore((s) => s.getCartTotal);
    const clearCart = useVendorMarketplaceStore((s) => s.clearCart);
    const checkout = useVendorMarketplaceStore((s) => s.checkout);

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryLocation, setDeliveryLocation] = useState('');
    const [customerNotes, setCustomerNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'wechat_pay' | 'alipay'>('wechat_pay');
    const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [vendorSettings, setVendorSettings] = useState<VendorPaymentSettings | null>(null);
    const [vendorInfo, setVendorInfo] = useState<VendorInfo | null>(null);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const total = getCartTotal(vendorId || '0');

    useEffect(() => {
        if (!vendorId) return;
        const fetchVendorData = async () => {
            setIsLoadingSettings(true);
            try {
                // Fetch vendor profile (public)
                const vRes = await fetch(`${API_BASE_URL}/vendors/${vendorId}`);
                if (vRes.ok) {
                    const vData = await vRes.json();
                    setVendorInfo({
                        id: vData.id,
                        business_name: vData.business_name,
                        logo_url: vData.logo_url,
                    });
                }
                // Fetch vendor payment settings (public - anyone can see QR to pay)
                const pRes = await fetch(`${API_BASE_URL}/vendors/${vendorId}/payment-settings`);
                if (pRes.ok) {
                    const pData = await pRes.json();
                    setVendorSettings(pData);
                    // Auto-select payment method based on vendor preference
                    if (pData.preferred_method === 'WECHAT_ONLY') {
                        setPaymentMethod('wechat_pay');
                    } else if (pData.preferred_method === 'ALIPAY_ONLY') {
                        setPaymentMethod('alipay');
                    }
                }
            } catch {
                // silent
            } finally {
                setIsLoadingSettings(false);
            }
        };
        fetchVendorData();
    }, [vendorId]);

    if (!session?.access_token) {
        return (
            <div className="min-h-screen pt-20 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-white text-lg mb-4">Please log in to checkout</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-3 bg-[#d3da0c] text-black font-bold rounded-xl"
                    >
                        Log In
                    </button>
                </div>
            </div>
        );
    }

    if (cart.length === 0) {
        return (
            <div className="min-h-screen pt-20 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-white text-lg mb-4">Your cart is empty</p>
                    <button
                        onClick={() => navigate('/marketplace')}
                        className="px-6 py-3 bg-[#d3da0c] text-black font-bold rounded-xl"
                    >
                        Browse Marketplace
                    </button>
                </div>
            </div>
        );
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Image must be under 10MB');
            return;
        }
        setPaymentScreenshot(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleSubmit = async () => {
        if (!customerName.trim()) {
            toast.error('Please enter your name');
            return;
        }
        if (!paymentScreenshot) {
            toast.error('Please upload payment screenshot');
            return;
        }

        setIsSubmitting(true);
        try {
            const order = await checkout(session.access_token, parseInt(vendorId || '0'), {
                items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
                customer_name: customerName,
                customer_phone: customerPhone || undefined,
                delivery_location: deliveryLocation || undefined,
                customer_notes: customerNotes || undefined,
                payment_method: paymentMethod,
                payment_screenshot: paymentScreenshot,
            });

            if (order) {
                toast.success('Order placed successfully!');
                clearCart(vendorId || '0');
                navigate(`/orders/${order.id}`);
            } else {
                toast.error('Failed to place order');
            }
        } catch (err) {
            toast.error('Checkout failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const qrUrl = paymentMethod === 'wechat_pay'
        ? vendorSettings?.wechat_qr_url
        : vendorSettings?.alipay_qr_url;
    const preferredOnlyWechat = vendorSettings?.preferred_method === 'WECHAT_ONLY';
    const preferredOnlyAlipay = vendorSettings?.preferred_method === 'ALIPAY_ONLY';

    return (
        <div className="min-h-screen pt-20 pb-24 bg-[#0A0A0A]">
            <div className="max-w-2xl mx-auto px-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-white text-2xl font-bold">Checkout</h1>
                        {vendorInfo && (
                            <p className="text-gray-400 text-sm flex items-center gap-1">
                                <Store className="w-3 h-3" /> {vendorInfo.business_name}
                            </p>
                        )}
                    </div>
                </div>

                {/* Cart Summary */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                    <h2 className="text-white font-semibold mb-3">Order Summary</h2>
                    <div className="space-y-2">
                        {cart.map((item) => (
                            <div key={item.product_id} className="flex items-center justify-between text-sm">
                                <span className="text-gray-300">{item.name} x{item.quantity}</span>
                                <span className="text-white">¥{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-white/10 mt-3 pt-3 flex items-center justify-between">
                        <span className="text-white font-semibold">Total</span>
                        <span className="text-[#d3da0c] text-xl font-bold">¥{total.toFixed(2)}</span>
                    </div>
                </div>

                {/* Customer Info */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 space-y-4">
                    <h2 className="text-white font-semibold">Customer Information</h2>
                    <div className="space-y-3">
                        <div className="relative">
                            <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                            <input
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Full Name *"
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:border-[#d3da0c]/40 focus:outline-none"
                            />
                        </div>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                            <input
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                placeholder="Phone Number"
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:border-[#d3da0c]/40 focus:outline-none"
                            />
                        </div>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                            <input
                                value={deliveryLocation}
                                onChange={(e) => setDeliveryLocation(e.target.value)}
                                placeholder="Pickup or Delivery Location"
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:border-[#d3da0c]/40 focus:outline-none"
                            />
                        </div>
                        <div className="relative">
                            <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                            <input
                                value={customerNotes}
                                onChange={(e) => setCustomerNotes(e.target.value)}
                                placeholder="Notes (optional)"
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-600 focus:border-[#d3da0c]/40 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Payment */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                    <h2 className="text-white font-semibold mb-3">Payment Method</h2>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <button
                            onClick={() => setPaymentMethod('wechat_pay')}
                            disabled={preferredOnlyAlipay}
                            className={`p-3 rounded-xl border text-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                paymentMethod === 'wechat_pay'
                                    ? 'border-green-500 bg-green-500/10 text-green-400'
                                    : 'border-white/10 text-gray-400 hover:border-white/20'
                            }`}
                        >
                            <CreditCard className="w-5 h-5 mx-auto mb-1" />
                            <span className="text-sm font-medium">WeChat Pay</span>
                        </button>
                        <button
                            onClick={() => setPaymentMethod('alipay')}
                            disabled={preferredOnlyWechat}
                            className={`p-3 rounded-xl border text-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                paymentMethod === 'alipay'
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                    : 'border-white/10 text-gray-400 hover:border-white/20'
                            }`}
                        >
                            <CreditCard className="w-5 h-5 mx-auto mb-1" />
                            <span className="text-sm font-medium">Alipay</span>
                        </button>
                    </div>

                    {/* QR Code Display */}
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                        {isLoadingSettings ? (
                            <div className="py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-[#d3da0c] mx-auto mb-2" />
                                <p className="text-gray-400 text-sm">Loading vendor QR code...</p>
                            </div>
                        ) : qrUrl ? (
                            <>
                                <p className="text-gray-400 text-sm mb-3">
                                    Scan to pay <span className="text-white font-semibold">¥{total.toFixed(2)}</span> to {vendorInfo?.business_name || 'vendor'}
                                </p>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="w-48 h-48 mx-auto bg-white rounded-xl p-2 mb-3"
                                >
                                    <img
                                        src={qrUrl}
                                        alt={`${paymentMethod === 'wechat_pay' ? 'WeChat Pay' : 'Alipay'} QR Code`}
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                </motion.div>
                                {paymentMethod === 'wechat_pay' && vendorSettings?.wechat_display_name && (
                                    <p className="text-green-400 text-xs mb-1">{vendorSettings.wechat_display_name}</p>
                                )}
                                {paymentMethod === 'alipay' && vendorSettings?.alipay_display_name && (
                                    <p className="text-blue-400 text-xs mb-1">{vendorSettings.alipay_display_name}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <p className="text-gray-400 text-sm mb-3">Scan QR code to pay ¥{total.toFixed(2)}</p>
                                <div className="w-40 h-40 mx-auto bg-gray-800 rounded-xl flex items-center justify-center mb-3">
                                    <div className="text-center px-4">
                                        <CreditCard className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                                        <span className="text-gray-500 text-xs">Vendor has not uploaded a QR code yet</span>
                                    </div>
                                </div>
                            </>
                        )}
                        <p className="text-gray-500 text-xs">After payment, upload screenshot below</p>
                    </div>

                    {/* Screenshot Upload */}
                    <div className="mt-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        {previewUrl ? (
                            <div className="relative">
                                <img src={previewUrl} alt="Payment proof" className="w-full rounded-xl" />
                                <button
                                    onClick={() => {
                                        setPaymentScreenshot(null);
                                        setPreviewUrl(null);
                                    }}
                                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-lg text-white"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-4 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center gap-2 text-gray-400 hover:border-[#d3da0c]/40 transition-colors"
                            >
                                <Upload className="w-6 h-6" />
                                <span className="text-sm">Upload Payment Screenshot *</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full py-4 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#c4cb0b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <Check className="w-5 h-5" />
                            Place Order — ¥{total.toFixed(2)}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
