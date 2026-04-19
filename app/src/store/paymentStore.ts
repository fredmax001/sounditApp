import { create } from 'zustand';
import { loadStripe, type Stripe as StripeType, type StripeCardElement } from '@stripe/stripe-js';
import { useAuthStore } from './authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ============================================
// TYPES
// ============================================
export interface PaymentState {
  stripe: StripeType | null;
  clientSecret: string | null;
  isLoading: boolean;
  error: string | null;
  paymentStatus: 'idle' | 'processing' | 'succeeded' | 'failed';

  // Actions
  initializeStripe: () => Promise<void>;
  createPaymentIntent: (amount: number, currency?: string, metadata?: Record<string, string>) => Promise<string>;
  processPayment: (paymentMethodId: string) => Promise<boolean>;
  confirmCardPayment: (clientSecret: string, cardElement: StripeCardElement) => Promise<boolean>;
  refundPayment: (paymentIntentId: string, amount?: number, reason?: string) => Promise<boolean>;
  getPaymentMethods: () => Promise<unknown[]>;
  savePaymentMethod: (paymentMethodId: string) => Promise<boolean>;
  removePaymentMethod: (paymentMethodId: string) => Promise<boolean>;
  reset: () => void;
}

// ============================================
// PAYMENT STORE - PRODUCTION VERSION
// Uses real Stripe integration via backend API
// ============================================
export const usePaymentStore = create<PaymentState>((set, get) => ({
  stripe: null,
  clientSecret: null,
  isLoading: false,
  error: null,
  paymentStatus: 'idle',

  // Initialize Stripe
  initializeStripe: async () => {
    try {
      const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

      if (!stripePublishableKey) {
        throw new Error('Stripe publishable key not configured');
      }

      const stripe = await loadStripe(stripePublishableKey);
      set({ stripe });
    } catch (error: unknown) {
      set({ error: (error as { message?: string }).message });
      console.error('Stripe initialization error:', error);
    }
  },

  // Create payment intent via backend API
  createPaymentIntent: async (amount: number, currency = 'cny', metadata?: Record<string, string>) => {
    set({ isLoading: true, error: null });

    try {
      const token = useAuthStore.getState().session?.access_token || localStorage.getItem('auth-token');
      const response = await fetch(`${API_URL}/payments/stripe/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          amount,
          currency,
          metadata,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create payment intent');
      }

      const data = await response.json();

      set({
        clientSecret: data.client_secret,
        isLoading: false,
      });

      return data.client_secret;
    } catch (error: unknown) {
      set({ error: (error as { message?: string }).message, isLoading: false });
      throw error;
    }
  },

  // Process payment with saved payment method
  processPayment: async (paymentMethodId: string) => {
      void paymentMethodId;
    set({ isLoading: true, error: null, paymentStatus: 'processing' });

    try {
      throw new Error('Server-side payment confirmation is not available in the current backend API');
    } catch (error: unknown) {
      set({
        error: (error as { message?: string }).message,
        isLoading: false,
        paymentStatus: 'failed',
      });
      return false;
    }
  },

  // Confirm card payment with Stripe Elements
  confirmCardPayment: async (clientSecret: string, cardElement: StripeCardElement) => {
    set({ isLoading: true, error: null, paymentStatus: 'processing' });

    try {
      const { stripe } = get();
      if (!stripe) throw new Error('Stripe not initialized');

      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              // Can add billing details here
            },
          },
        }
      );

      if (error) {
        throw new Error((error as { message?: string }).message);
      }

      if (paymentIntent.status === 'succeeded') {
        set({ paymentStatus: 'succeeded', isLoading: false });
        return true;
      } else {
        throw new Error(`Payment status: ${paymentIntent.status}`);
      }
    } catch (error: unknown) {
      set({
        error: (error as { message?: string }).message,
        isLoading: false,
        paymentStatus: 'failed',
      });
      return false;
    }
  },

  // Refund payment via backend API
  refundPayment: async (orderId: string, amount?: number, reason?: string) => {
    set({ isLoading: true, error: null });

    try {
      const token = useAuthStore.getState().session?.access_token || localStorage.getItem('auth-token');
      const response = await fetch(`${API_URL}/payments/orders/${orderId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          amount,
          reason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Refund failed');
      }

      set({ isLoading: false });
      return true;
    } catch (error: unknown) {
      set({ error: (error as { message?: string }).message, isLoading: false });
      return false;
    }
  },

  // Get saved payment methods
  getPaymentMethods: async () => {
    set({ isLoading: false, error: 'Payment methods are not available in the current backend API' });
    return [];
  },

  // Save payment method for future use
  savePaymentMethod: async (paymentMethodId: string) => {
      void paymentMethodId;
    set({ isLoading: false, error: 'Saving payment methods is not available in the current backend API' });
    return false;
  },

  // Remove saved payment method
  removePaymentMethod: async (paymentMethodId: string) => {
      void paymentMethodId;
    set({ isLoading: false, error: 'Removing payment methods is not available in the current backend API' });
    return false;
  },

  // Reset state
  reset: () => {
    set({
      clientSecret: null,
      error: null,
      paymentStatus: 'idle',
    });
  },
}));

export default usePaymentStore;
