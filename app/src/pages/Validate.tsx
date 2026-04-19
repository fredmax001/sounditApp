/**
 * Validate Page
 * Accessed when scanning QR codes containing secure URLs
 * Validates ticket and shows result
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    CheckCircle,
    AlertCircle,
    Loader2,
    ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';

interface ValidationResult {
    valid: boolean;
    status: string;
    ticket_id?: string;
    event_id?: number;
    user_id?: string;
    validated_at?: string;
    message: string;
    used_at?: string;
    current_status?: string;
}

const ValidatePage = () => {
    const { t } = useTranslation();
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { session, isAuthenticated } = useAuthStore();

    const [result, setResult] = useState<ValidationResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const validateTicket = async () => {
            if (!token) {
                setError(t('validate.invalidToken'));
                setIsLoading(false);
                return;
            }

            try {
                // If not authenticated, show message
                if (!isAuthenticated || !session) {
                    setError(t('validate.loginToValidate'));
                    setIsLoading(false);
                    return;
                }

                const response = await fetch(
                    `${API_BASE_URL}/payments/validate/${token}`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const data = await response.json();
                setResult(data);

                if (data.valid) {
                    toast.success(t('validate.toastSuccess'));
                } else {
                    toast.error(data.message || t('validate.toastFailed'));
                }
            } catch (err) {
                console.error('Validation error:', err);
                setError(t('validate.networkError'));
                toast.error(t('validate.validationFailedToast'));
            } finally {
                setIsLoading(false);
            }
        };

        validateTicket();
    }, [token, session, isAuthenticated]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                    <Loader2 className="w-12 h-12 text-green-400" />
                </motion.div>
                <p className="text-white mt-4">{t('validate.validating')}</p>
            </div>
        );
    }

    if (error || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-white text-2xl font-bold text-center mb-2">
                        {t('validate.authRequired')}
                    </h1>
                    <p className="text-gray-400 text-center mb-6">
                        {error || t('validate.loginPrompt')}
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full py-3 bg-green-400 text-black rounded-xl font-bold hover:bg-green-300 transition"
                    >
                        {t('validate.goToLogin')}
                    </button>
                </div>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center">
                <p className="text-white">{t('validate.noResult')}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 bg-[#0A0A0A] border-b border-white/10">
                <button
                    onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
                    className="p-2 text-white hover:bg-white/10 rounded-full"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-white font-semibold">{t('validate.ticketValidation')}</h1>
            </div>

            {/* Result Container */}
            <div className="flex-1 flex flex-col items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md"
                >
                    {result.valid ? (
                        <div className="bg-[#111111] rounded-2xl p-8 border border-green-400/20">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>

                            <h2 className="text-white text-2xl font-bold text-center mb-2">
                                {t('validate.validTicket')}
                            </h2>

                            <p className="text-gray-400 text-center mb-6">
                                {t('validate.successMessage')}
                            </p>

                            <div className="space-y-3 bg-white/5 rounded-xl p-4 mb-6">
                                <div>
                                    <p className="text-gray-500 text-sm">{t('validate.ticketId')}</p>
                                    <p className="text-white font-mono text-sm">{result.ticket_id}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-sm">{t('validate.validatedAt')}</p>
                                    <p className="text-white">
                                        {new Date(result.validated_at || '').toLocaleString()}
                                    </p>
                                </div>
                                {result.event_id && (
                                    <div>
                                        <p className="text-gray-500 text-sm">{t('validate.eventId')}</p>
                                        <p className="text-white">{result.event_id}</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => navigate('/dashboard')}
                                className="w-full py-3 bg-green-400 text-black rounded-xl font-bold hover:bg-green-300 transition"
                            >
                                {t('validate.backToDashboard')}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-[#111111] rounded-2xl p-8 border border-red-400/20">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-8 h-8 text-red-500" />
                            </div>

                            <h2 className="text-white text-2xl font-bold text-center mb-2">
                                {t('validate.invalidTicket')}
                            </h2>

                            <p className="text-gray-400 text-center mb-6">
                                {result.message}
                            </p>

                            {result.status === 'already_used' && (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                                    <p className="text-yellow-200 text-sm">
                                        {t('validate.alreadyUsedOn')}{' '}
                                        <strong>{new Date(result.used_at || '').toLocaleString()}</strong>
                                    </p>
                                </div>
                            )}

                            {result.status === 'cancelled' && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                                    <p className="text-red-200 text-sm">
                                        {t('validate.cancelledMessage')}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={() => navigate('/dashboard')}
                                className="w-full py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition"
                            >{t('validate.backToDashboard')}</button>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default ValidatePage;
