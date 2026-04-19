import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface AxiosError {
    response?: {
        data?: {
            detail?: string;
        };
    };
}

interface OTPResult {
    success: boolean;
    error?: string;
    message?: string;
}

interface OTPState {
    isLoading: boolean;
    lastSentAt: number | null;
    generateEmailOTP: (email: string, purpose?: string) => Promise<OTPResult>;
    generateSMSOTP: (phone: string, purpose?: string) => Promise<OTPResult>;
    verifyOTP: (identifier: string, code: string) => Promise<OTPResult>;
    verifyEmailOTP: (email: string, otp: string) => Promise<OTPResult>;
    canResend: () => boolean;
    getRemainingCooldown: () => number;
}

// Cooldown period in seconds
const COOLDOWN_SECONDS = 60;

export const useOTPStore = create<OTPState>((set, get) => ({
    isLoading: false,
    lastSentAt: null,

    generateEmailOTP: async (email, purpose = 'login') => {
        if (!get().canResend()) {
            return {
                success: false,
                error: `Please wait ${get().getRemainingCooldown()} seconds before requesting another code`
            };
        }

        set({ isLoading: true });
        try {
            await axios.post(`${API_URL}/otp/email/send`, { email, purpose });
            set({ isLoading: false, lastSentAt: Date.now() });
            return { success: true, message: 'Verification code sent to your email' };
        } catch (error: unknown) {
            set({ isLoading: false });
            console.error('Failed to send email OTP:', error);
            return {
                success: false,
                error: (error as AxiosError).response?.data?.detail || 'Failed to send verification code'
            };
        }
    },

    generateSMSOTP: async (phone, purpose = 'login') => {
        if (!get().canResend()) {
            return {
                success: false,
                error: `Please wait ${get().getRemainingCooldown()} seconds before requesting another code`
            };
        }

        set({ isLoading: true });
        try {
            await axios.post(`${API_URL}/otp/sms/send`, { phone, purpose });
            set({ isLoading: false, lastSentAt: Date.now() });
            return { success: true, message: 'Verification code sent to your phone' };
        } catch (error: unknown) {
            set({ isLoading: false });
            console.error('Failed to send SMS OTP:', error);
            return {
                success: false,
                error: (error as AxiosError).response?.data?.detail || 'Failed to send verification code'
            };
        }
    },

    verifyOTP: async (identifier, code) => {
        set({ isLoading: true });
        try {
            const response = await axios.post(`${API_URL}/otp/verify`, { identifier, code });
            set({ isLoading: false });
            if (response.data.success) {
                return { success: true, message: 'Verification successful' };
            }
            return { success: false, error: response.data.message || 'Verification failed' };
        } catch (error: unknown) {
            set({ isLoading: false });
            console.error('Failed to verify OTP:', error);
            return {
                success: false,
                error: (error as AxiosError).response?.data?.detail || 'Invalid or expired verification code'
            };
        }
    },

    verifyEmailOTP: async (email, otp) => {
        return get().verifyOTP(email, otp);
    },

    canResend: () => {
        const { lastSentAt } = get();
        if (!lastSentAt) return true;
        return (Date.now() - lastSentAt) >= COOLDOWN_SECONDS * 1000;
    },

    getRemainingCooldown: () => {
        const { lastSentAt } = get();
        if (!lastSentAt) return 0;
        const remaining = Math.ceil((COOLDOWN_SECONDS * 1000 - (Date.now() - lastSentAt)) / 1000);
        return Math.max(0, remaining);
    },
}));

export default useOTPStore;
