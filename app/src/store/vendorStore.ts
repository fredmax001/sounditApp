import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { detail?: string } }; message?: string };
    return e.response?.data?.detail || e.message || 'Unknown error';
  }
  return 'Unknown error';
}


export interface Product {
    id: number;
    vendor_id: number;
    name: string;
    description?: string;
    price: number;
    currency: string;
    image_url?: string;
    images?: string[];
    category?: string;
    stock_quantity: number;
    status: 'active' | 'inactive' | 'sold_out';
    wechat_qr_url?: string;
    alipay_qr_url?: string;
    payment_instructions?: string;
    created_at?: string;
    updated_at?: string;
}

export interface VendorProfile {
    id: number;
    user_id: number;
    business_name: string;
    description?: string;
    vendor_type?: 'food' | 'merch' | 'service' | 'beverage';
    logo_url?: string;
    banner_url?: string;
    city_id?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    social_links?: {
        instagram?: string;
        wechat?: string;
    };
    rating: number;
    reviews_count: number;
    is_verified: boolean;
    verification_status: 'pending' | 'verified' | 'rejected';
}

export interface Order {
    id: number;
    order_number: string;
    customer_name: string;
    customer_email: string;
    items: {
        product_id: string;
        product_name: string;
        quantity: number;
        price: number;
    }[];
    total_amount: number;
    currency: string;
    status: 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled';
    event_id?: string;
    event_name?: string;
    created_at: string;
}

interface VendorState {
    profile: VendorProfile | null;
    products: Product[];
    orders: Order[];
    isLoading: boolean;
    error: string | null;

    fetchProfile: (token: string) => Promise<void>;
    updateProfile: (token: string, data: Partial<VendorProfile>) => Promise<void>;
    fetchProducts: (token: string) => Promise<void>;
    addProduct: (token: string, product: Omit<Product, 'id' | 'vendor_id' | 'created_at' | 'updated_at'>) => Promise<void>;
    updateProduct: (token: string, productId: number, updates: Partial<Product>) => Promise<void>;
    deleteProduct: (token: string, productId: number) => Promise<void>;
    uploadProductImage: (token: string, file: File) => Promise<string>;
    fetchOrders: (token: string, status?: string) => Promise<void>;
    updateOrderStatus: (token: string, orderId: number, status: Order['status']) => Promise<void>;
}

export const useVendorStore = create<VendorState>()(
    persist(
        (set) => ({
            profile: null,
            products: [],
            orders: [],
            isLoading: false,
            error: null,

            fetchProfile: async (token) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await axios.get(`${API_URL}/vendors/profile`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    set({ profile: response.data, isLoading: false });
                } catch (err: unknown) {
                    set({ error: getErrorMessage(err), isLoading: false });
                }
            },

            updateProfile: async (token, data) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await axios.put(`${API_URL}/vendors/profile`, data, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    set({ profile: response.data, isLoading: false });
                } catch (err: unknown) {
                    set({ error: getErrorMessage(err), isLoading: false });
                }
            },

            fetchProducts: async (token) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await axios.get(`${API_URL}/vendors/products`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    set({ products: response.data || [], isLoading: false });
                } catch (err: unknown) {
                    set({ error: getErrorMessage(err), isLoading: false });
                }
            },

            addProduct: async (token, product) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await axios.post(`${API_URL}/vendors/products`, product, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    set((state) => ({ products: [...state.products, response.data], isLoading: false }));
                } catch (err: unknown) {
                    set({ error: getErrorMessage(err), isLoading: false });
                }
            },

            updateProduct: async (token, productId, updates) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await axios.put(`${API_URL}/vendors/products/${productId}`, updates, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    set((state) => ({
                        products: state.products.map((p) => (p.id === productId ? response.data : p)),
                        isLoading: false
                    }));
                } catch (err: unknown) {
                    set({ error: getErrorMessage(err), isLoading: false });
                }
            },

            deleteProduct: async (token, productId) => {
                set({ isLoading: true, error: null });
                try {
                    await axios.delete(`${API_URL}/vendors/products/${productId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    set((state) => ({
                        products: state.products.filter((p) => p.id !== productId),
                        isLoading: false
                    }));
                } catch (err: unknown) {
                    set({ error: getErrorMessage(err), isLoading: false });
                }
            },

            uploadProductImage: async (token, file) => {
                // Validate file
                if (!file.type.startsWith('image/')) {
                    throw new Error('Please select a valid image file');
                }
                if (file.size > 5 * 1024 * 1024) { // 5MB
                    throw new Error('Image size must be less than 5MB');
                }

                const formData = new FormData();
                formData.append('file', file);

                const response = await axios.post(`${API_URL}/media/upload`, formData, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    }
                });

                return response.data.url;
            },

            fetchOrders: async (token, status) => {
                set({ isLoading: true, error: null });
                try {
                    const params: Record<string, unknown> = {};
                    if (status) params.status = status;

                    const response = await axios.get(`${API_URL}/vendors/orders`, {
                        params,
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    set({ orders: response.data || [], isLoading: false });
                } catch (err: unknown) {
                    set({ error: getErrorMessage(err), isLoading: false });
                }
            },

            updateOrderStatus: async (token, orderId, status) => {
                set({ isLoading: true, error: null });
                try {
                    await axios.patch(`${API_URL}/vendors/orders/${orderId}`, { status }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    set((state) => ({
                        orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
                        isLoading: false
                    }));
                } catch (err: unknown) {
                    set({ error: getErrorMessage(err), isLoading: false });
                }
            },
        }),
        {
            name: 'vendor-storage',
            partialize: (state) => ({ profile: state.profile }),
        }
    )
);

export default useVendorStore;
