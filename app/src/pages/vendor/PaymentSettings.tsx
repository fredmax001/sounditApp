import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, CreditCard, Check, Loader2, ImageIcon } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

interface PaymentSettings {
    wechat_qr_url?: string;
    wechat_display_name?: string;
    alipay_qr_url?: string;
    alipay_display_name?: string;
    preferred_method?: string;
}

export default function VendorPaymentSettings() {
    const { session } = useAuthStore();
    const [settings, setSettings] = useState<PaymentSettings>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [wechatPreview, setWechatPreview] = useState<string | null>(null);
    const [alipayPreview, setAlipayPreview] = useState<string | null>(null);
    const wechatInputRef = useRef<HTMLInputElement>(null);
    const alipayInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        wechat_display_name: '',
        alipay_display_name: '',
        preferred_method: 'both',
    });

    useEffect(() => {
        if (session?.access_token) {
            fetchSettings();
        }
    }, [session]);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/vendors/payment-settings`, {
                headers: { Authorization: `Bearer ${session!.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
                setForm({
                    wechat_display_name: data.wechat_display_name || '',
                    alipay_display_name: data.alipay_display_name || '',
                    preferred_method: data.preferred_method || 'both',
                });
            }
        } catch {
            toast.error('Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!session?.access_token) return;
        setIsSaving(true);

        try {
            const formData = new FormData();
            formData.append('wechat_display_name', form.wechat_display_name);
            formData.append('alipay_display_name', form.alipay_display_name);
            formData.append('preferred_method', form.preferred_method);

            if (wechatInputRef.current?.files?.[0]) {
                formData.append('wechat_qr', wechatInputRef.current.files[0]);
            }
            if (alipayInputRef.current?.files?.[0]) {
                formData.append('alipay_qr', alipayInputRef.current.files[0]);
            }

            const res = await fetch(`${API_BASE_URL}/vendors/payment-settings`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: formData,
            });

            if (res.ok) {
                toast.success('Payment settings saved');
                fetchSettings();
                setWechatPreview(null);
                setAlipayPreview(null);
            } else {
                const err = await res.json();
                toast.error(err.detail || 'Failed to save');
            }
        } catch {
            toast.error('Network error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen pt-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-20 pb-24 bg-white dark:bg-[#020b00]">
            <div className="max-w-2xl mx-auto px-4">
                <div className="flex items-center gap-3 mb-6">
                    <Link to="/dashboard/vendor" className="p-2 text-gray-500 hover:text-[#020b00] dark:text-gray-400 dark:hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-[#020b00] dark:text-white text-2xl font-bold">Payment Settings</h1>
                </div>

                <div className="space-y-6">
                    {/* Preferred Method */}
                    <div className="bg-white dark:bg-white/5 border border-black/8 dark:border-white/10 rounded-xl p-4 shadow-xs dark:shadow-none">
                        <label className="text-[#020b00] dark:text-white font-medium block mb-3">Display Preference</label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['wechat_only', 'alipay_only', 'both'] as const).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setForm((f) => ({ ...f, preferred_method: m }))}
                                    className={`p-3 rounded-xl border text-center transition-colors ${
                                        form.preferred_method === m
                                            ? 'border-[#020b00] bg-[#020b00] text-[#d3da0c] dark:border-[#d3da0c] dark:bg-[#d3da0c]/10 dark:text-[#d3da0c]'
                                            : 'border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-black/20 dark:hover:border-white/20'
                                    }`}
                                >
                                    <CreditCard className="w-5 h-5 mx-auto mb-1" />
                                    <span className="text-xs capitalize">{m.replace('_', ' ')}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* WeChat Pay */}
                    <div className="bg-white dark:bg-white/5 border border-black/8 dark:border-white/10 rounded-xl p-4 shadow-xs dark:shadow-none">
                        <h2 className="text-[#020b00] dark:text-white font-medium mb-3">WeChat Pay</h2>
                        <input
                            value={form.wechat_display_name}
                            onChange={(e) => setForm((f) => ({ ...f, wechat_display_name: e.target.value }))}
                            placeholder="Display Name (e.g., Your WeChat Name)"
                            className="w-full bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-[#020b00] dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-600 focus:border-[#d3da0c] focus:outline-hidden mb-3"
                        />
                        <input
                            ref={wechatInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setWechatPreview(URL.createObjectURL(file));
                            }}
                        />
                        <div
                            onClick={() => wechatInputRef.current?.click()}
                            className="border-2 border-dashed border-black/15 dark:border-white/20 bg-neutral-50/50 dark:bg-white/[0.02] rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-green-500/50 transition-colors"
                        >
                            {settings.wechat_qr_url && !wechatPreview ? (
                                <img src={settings.wechat_qr_url} alt="WeChat QR" className="w-32 h-32 object-contain" />
                            ) : wechatPreview ? (
                                <img src={wechatPreview} alt="WeChat QR Preview" className="w-32 h-32 object-contain" />
                            ) : (
                                <>
                                    <ImageIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                    <span className="text-gray-600 dark:text-gray-400 text-sm">Upload WeChat Pay QR Code</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Alipay */}
                    <div className="bg-white dark:bg-white/5 border border-black/8 dark:border-white/10 rounded-xl p-4 shadow-xs dark:shadow-none">
                        <h2 className="text-[#020b00] dark:text-white font-medium mb-3">Alipay</h2>
                        <input
                            value={form.alipay_display_name}
                            onChange={(e) => setForm((f) => ({ ...f, alipay_display_name: e.target.value }))}
                            placeholder="Display Name (e.g., Your Alipay Name)"
                            className="w-full bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-[#020b00] dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-600 focus:border-[#d3da0c] focus:outline-hidden mb-3"
                        />
                        <input
                            ref={alipayInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setAlipayPreview(URL.createObjectURL(file));
                            }}
                        />
                        <div
                            onClick={() => alipayInputRef.current?.click()}
                            className="border-2 border-dashed border-black/15 dark:border-white/20 bg-neutral-50/50 dark:bg-white/[0.02] rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-500/50 transition-colors"
                        >
                            {settings.alipay_qr_url && !alipayPreview ? (
                                <img src={settings.alipay_qr_url} alt="Alipay QR" className="w-32 h-32 object-contain" />
                            ) : alipayPreview ? (
                                <img src={alipayPreview} alt="Alipay QR Preview" className="w-32 h-32 object-contain" />
                            ) : (
                                <>
                                    <ImageIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                    <span className="text-gray-600 dark:text-gray-400 text-sm">Upload Alipay QR Code</span>
                                </>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
