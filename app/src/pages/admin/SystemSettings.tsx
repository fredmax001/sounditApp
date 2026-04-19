import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Settings,
    Shield,
    Globe,
    Plus,
    Trash2,
    Save,
    Info,
    Loader2,
    X,
    RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';

interface CommissionRate {
    city: string;
    rate: number;
}

interface CommissionSettings {
    defaultRate: number;
}

interface SystemFlags {
    maintenanceMode: boolean;
    allowNewRegistrations: boolean;
    featuredEventLimit: number;
}

const SystemSettings = () => {
    const { t } = useTranslation();
    const { session } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isResettingCache, setIsResettingCache] = useState(false);
    const [commissionRates, setCommissionRates] = useState<CommissionRate[]>([]);
    const [defaultCommissionRate, setDefaultCommissionRate] = useState<number>(6);
    const [systemFlags, setSystemFlags] = useState<SystemFlags>({
        maintenanceMode: false,
        allowNewRegistrations: true,
        featuredEventLimit: 6
    });
    const [showAddCityModal, setShowAddCityModal] = useState(false);
    const [newCity, setNewCity] = useState({ name: '', rate: 10 });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const token = session?.access_token;
            
            // Fetch commission rates
            const ratesRes = await fetch(`${API_BASE_URL}/admin/settings/commissions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (ratesRes.ok) {
                const data = await ratesRes.json();
                // Use default rate (fallback to 10% if not set)
                const defaultRatePct = Math.round((data.default_rate || 0.1) * 100);
                setDefaultCommissionRate(defaultRatePct);
                // Keep legacy array for compatibility if needed
                const ratesObj = data.rates || {};
                const ratesArray = Object.entries(ratesObj).map(([city, rate]) => ({
                    city,
                    rate: Math.round((rate as number) * 100)
                }));
                setCommissionRates(ratesArray);
            }

            // Fetch system flags
            const flagsRes = await fetch(`${API_BASE_URL}/admin/settings/flags`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (flagsRes.ok) {
                const data = await flagsRes.json();
                // Map backend flag names to frontend flag names
                setSystemFlags({
                    maintenanceMode: data.maintenance_mode || false,
                    allowNewRegistrations: data.registration_enabled !== false,
                    featuredEventLimit: data.featured_event_limit || 6
                });
            }
        } catch {
            toast.error(t('admin.systemSettings.failedToLoadSettings'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            const token = session?.access_token;

            // Save default commission rate only (single global rate)
            const ratesRes = await fetch(`${API_BASE_URL}/admin/settings/commissions`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rate: defaultCommissionRate / 100 })
            });

            // Map frontend flag names to backend flag names
            const backendFlags = {
                maintenance_mode: systemFlags.maintenanceMode,
                registration_enabled: systemFlags.allowNewRegistrations,
                featured_event_limit: systemFlags.featuredEventLimit
            };

            // Save system flags
            const flagsRes = await fetch(`${API_BASE_URL}/admin/settings/flags`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(backendFlags)
            });

            if (ratesRes.ok && flagsRes.ok) {
                toast.success(t('admin.systemSettings.settingsSaved'));
            } else {
                const ratesErr = ratesRes.ok ? '' : await ratesRes.text().catch(() => 'Commission save failed');
                const flagsErr = flagsRes.ok ? '' : await flagsRes.text().catch(() => 'Flags save failed');
                toast.error(t('admin.systemSettings.failedToSaveSomeSettings') + (ratesErr || flagsErr ? ` — ${ratesErr || flagsErr}` : ''));
            }
        } catch {
            toast.error(t('admin.systemSettings.networkError'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateCommissionRate = (city: string, rate: number) => {
        setCommissionRates(prev => 
            prev.map(r => r.city === city ? { ...r, rate } : r)
        );
    };

    const handleAddCity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCity.name.trim()) {
            toast.error(t('admin.systemSettings.cityNameRequired'));
            return;
        }

        const cityKey = newCity.name.toLowerCase().trim();
        if (commissionRates.some(r => r.city.toLowerCase() === cityKey)) {
            toast.error(t('admin.systemSettings.cityAlreadyExists'));
            return;
        }

        const updatedRates = [...commissionRates, { city: newCity.name.trim(), rate: newCity.rate }];
        
        // Convert to backend format
        const ratesObj = updatedRates.reduce((acc, { city, rate }) => {
            acc[city.toLowerCase()] = rate / 100;
            return acc;
        }, {} as Record<string, number>);
        
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/settings/commissions`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rates: ratesObj })
            });

            if (res.ok) {
                setCommissionRates(updatedRates);
                toast.success(t('admin.systemSettings.cityAdded', { name: newCity.name, rate: newCity.rate }));
                setShowAddCityModal(false);
                setNewCity({ name: '', rate: 10 });
            } else {
                toast.error(t('admin.systemSettings.failedToAddCity'));
            }
        } catch {
            toast.error(t('admin.systemSettings.networkError'));
        }
    };

    const handleDeleteCity = async (city: string) => {
        if (!confirm(t('admin.systemSettings.confirmRemoveCity', { city }))) return;

        const updatedRates = commissionRates.filter(r => r.city !== city);
        
        // Convert to backend format
        const ratesObj = updatedRates.reduce((acc, { city, rate }) => {
            acc[city.toLowerCase()] = rate / 100;
            return acc;
        }, {} as Record<string, number>);
        
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/settings/commissions`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rates: ratesObj })
            });

            if (res.ok) {
                setCommissionRates(updatedRates);
                toast.success(t('admin.systemSettings.cityRemoved', { city }));
            } else {
                toast.error(t('admin.systemSettings.failedToRemoveCity'));
            }
        } catch {
            toast.error(t('admin.systemSettings.networkError'));
        }
    };

    const toggleMaintenance = async () => {
        const newMode = !systemFlags.maintenanceMode;
        
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/settings/flags`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    maintenance_mode: newMode,
                    registration_enabled: systemFlags.allowNewRegistrations,
                    featured_event_limit: systemFlags.featuredEventLimit
                })
            });

            if (res.ok) {
                setSystemFlags(prev => ({ ...prev, maintenanceMode: newMode }));
                toast(t(newMode ? 'admin.systemSettings.maintenanceEnabled' : 'admin.systemSettings.maintenanceDisabled'));
            } else {
                toast.error(t('admin.systemSettings.failedToToggleMaintenance'));
            }
        } catch {
            toast.error(t('admin.systemSettings.networkError'));
        }
    };

    const toggleRegistrations = async () => {
        const newValue = !systemFlags.allowNewRegistrations;
        
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/settings/flags`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    maintenance_mode: systemFlags.maintenanceMode,
                    registration_enabled: newValue,
                    featured_event_limit: systemFlags.featuredEventLimit
                })
            });

            if (res.ok) {
                setSystemFlags(prev => ({ ...prev, allowNewRegistrations: newValue }));
                toast(t(newValue ? 'admin.systemSettings.registrationsEnabled' : 'admin.systemSettings.registrationsDisabled'));
            } else {
                toast.error(t('admin.systemSettings.failedToUpdateSetting'));
            }
        } catch {
            toast.error(t('admin.systemSettings.networkError'));
        }
    };

    const handleResetCache = async () => {
        if (!confirm(t('admin.systemSettings.confirmResetCache'))) {
            return;
        }

        setIsResettingCache(true);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/system/cache/reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success(t('admin.systemSettings.cacheResetSuccess'));
            } else {
                toast.error(t('admin.systemSettings.failedToResetCache'));
            }
        } catch {
            toast.error(t('admin.systemSettings.networkError'));
        } finally {
            setIsResettingCache(false);
        }
    };

    const updateFeaturedLimit = async (value: number) => {
        setSystemFlags(prev => ({ ...prev, featuredEventLimit: value }));
        
        try {
            const token = session?.access_token;
            await fetch(`${API_BASE_URL}/admin/settings/flags`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    maintenance_mode: systemFlags.maintenanceMode,
                    registration_enabled: systemFlags.allowNewRegistrations,
                    featured_event_limit: value
                })
            });
        } catch {
            // Silent fail - the save button will handle the actual persistence
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display text-white mb-2">{t('admin.systemSettings.title')}</h1>
                    <p className="text-gray-400">{t('admin.systemSettings.subtitle')}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadSettings}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        {t('admin.systemSettings.refresh')}
                    </button>
                    <button
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t('admin.systemSettings.saveSettings')}
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                </div>
            ) : (
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* City & Commission Control */}
                    <div className="space-y-6">
                        <div className="glass rounded-3xl p-6 border border-white/10">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-blue-400" />
                                    {t('admin.systemSettings.citiesAndCommissions')}
                                </h2>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-medium">{t('admin.systemSettings.commissionRateLabel') || 'Cities Commission Rate'}</p>
                                        <p className="text-gray-500 text-xs">Applies to all cities platform-wide</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={defaultCommissionRate}
                                            onChange={(e) => setDefaultCommissionRate(parseInt(e.target.value) || 0)}
                                            className="w-20 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-right focus:border-[#d3da0c] focus:outline-none"
                                        />
                                        <span className="text-gray-500 text-sm">%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-white/5">
                                <div className="bg-[#d3da0c]/5 border border-[#d3da0c]/20 p-4 rounded-xl flex gap-3">
                                    <Info className="w-5 h-5 text-[#d3da0c] shrink-0" />
                                    <p className="text-gray-400 text-xs leading-relaxed">
                                        {t('admin.systemSettings.commissionInfo')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Feature Flags */}
                    <div className="space-y-6">
                        <div className="glass rounded-3xl p-6 border border-white/10">
                            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-[#d3da0c]" />
                                {t('admin.systemSettings.platformOverrides')}
                            </h2>

                            <div className="space-y-4">
                                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-medium">{t('admin.systemSettings.maintenanceMode')}</p>
                                        <p className="text-gray-500 text-xs">{t('admin.systemSettings.maintenanceModeHint')}</p>
                                    </div>
                                    <button
                                        onClick={toggleMaintenance}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${systemFlags.maintenanceMode ? 'bg-[#d3da0c]' : 'bg-white/10'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${systemFlags.maintenanceMode ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-medium">{t('admin.systemSettings.allowNewRegistrations')}</p>
                                        <p className="text-gray-500 text-xs">{t('admin.systemSettings.allowNewRegistrationsHint')}</p>
                                    </div>
                                    <button
                                        onClick={toggleRegistrations}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${systemFlags.allowNewRegistrations ? 'bg-[#d3da0c]' : 'bg-white/10'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${systemFlags.allowNewRegistrations ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className="text-white font-medium">{t('admin.systemSettings.featuredEventLimit')}</p>
                                        <p className="text-gray-500 text-xs">{t('admin.systemSettings.featuredEventLimitHint')}</p>
                                    </div>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={systemFlags.featuredEventLimit}
                                        onChange={(e) => updateFeaturedLimit(parseInt(e.target.value) || 1)}
                                        className="w-16 px-2 py-1 bg-white/10 border border-white/10 rounded text-white text-right text-sm focus:border-[#d3da0c] focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="glass rounded-3xl p-6 border border-white/10">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-red-500" />
                                {t('admin.systemSettings.dangerZone')}
                            </h2>
                            <p className="text-gray-500 text-sm mb-4">{t('admin.systemSettings.dangerZoneHint')}</p>
                            <button 
                                onClick={handleResetCache}
                                disabled={isResettingCache}
                                className="w-full py-3 bg-red-500/10 text-red-500 border border-red-500/10 rounded-xl font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isResettingCache ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                                {t('admin.systemSettings.resetSystemCache')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add City Modal */}
            {showAddCityModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-white">{t('admin.systemSettings.addNewCity')}</h3>
                            <button 
                                onClick={() => setShowAddCityModal(false)}
                                className="p-2 hover:bg-white/10 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleAddCity} className="space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">{t('admin.systemSettings.cityNameLabel')}</label>
                                <input
                                    type="text"
                                    value={newCity.name}
                                    onChange={(e) => setNewCity({...newCity, name: e.target.value})}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                                    placeholder={t('admin.systemSettings.cityNamePlaceholder')}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">{t('admin.systemSettings.commissionRateLabel')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={newCity.rate}
                                    onChange={(e) => setNewCity({...newCity, rate: parseInt(e.target.value) || 0})}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] transition-colors"
                            >
                                {t('admin.systemSettings.addCityButton')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemSettings;
