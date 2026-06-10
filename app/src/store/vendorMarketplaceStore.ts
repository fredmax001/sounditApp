import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface CartItem {
    product_id: number;
    name: string;
    price: number;
    image_url?: string;
    quantity: number;
}

export interface VendorOrderItem {
    id: number;
    product_id: number;
    product_name: string;
    product_price: number;
    quantity: number;
    subtotal: number;
}

export interface VendorOrder {
    id: number;
    vendor_id: number;
    user_id: number;
    event_id?: number;
    customer_name: string;
    customer_phone?: string;
    delivery_location?: string;
    customer_notes?: string;
    payment_method: string;
    payment_screenshot: string;
    total_amount: number;
    currency: string;
    status: string;
    order_code?: string;
    order_qr_code?: string;
    rejection_reason?: string;
    created_at: string;
    updated_at?: string;
    items: VendorOrderItem[];
}

interface VendorMarketplaceState {
    cart: Record<string, CartItem[]>; // keyed by vendor_id
    orders: VendorOrder[];
    isLoading: boolean;
    error: string | null;

    getCart: (vendorId: string | number) => CartItem[];
    addToCart: (vendorId: string | number, item: CartItem) => void;
    removeFromCart: (vendorId: string | number, productId: number) => void;
    updateQty: (vendorId: string | number, productId: number, qty: number) => void;
    clearCart: (vendorId: string | number) => void;
    getCartTotal: (vendorId: string | number) => number;
    getCartCount: (vendorId: string | number) => number;

    fetchOrders: (token: string) => Promise<void>;
    checkout: (token: string, vendorId: number, data: CheckoutData) => Promise<VendorOrder | null>;
}

interface CheckoutData {
    items: { product_id: number; quantity: number }[];
    customer_name: string;
    customer_phone?: string;
    delivery_location?: string;
    customer_notes?: string;
    payment_method: string;
    event_id?: number;
    payment_screenshot: File;
}

export const useVendorMarketplaceStore = create<VendorMarketplaceState>()(
    persist(
        (set, get) => ({
            cart: {},
            orders: [],
            isLoading: false,
            error: null,

            getCart: (vendorId) => {
                return get().cart[String(vendorId)] || [];
            },

            addToCart: (vendorId, item) => {
                const key = String(vendorId);
                set((state) => {
                    const current = state.cart[key] || [];
                    const existing = current.find((c) => c.product_id === item.product_id);
                    let updated;
                    if (existing) {
                        updated = current.map((c) =>
                            c.product_id === item.product_id
                                ? { ...c, quantity: c.quantity + item.quantity }
                                : c
                        );
                    } else {
                        updated = [...current, item];
                    }
                    return { cart: { ...state.cart, [key]: updated } };
                });
            },

            removeFromCart: (vendorId, productId) => {
                const key = String(vendorId);
                set((state) => {
                    const current = state.cart[key] || [];
                    const updated = current.filter((c) => c.product_id !== productId);
                    const newCart = { ...state.cart, [key]: updated };
                    if (updated.length === 0) {
                        delete newCart[key];
                    }
                    return { cart: newCart };
                });
            },

            updateQty: (vendorId, productId, qty) => {
                const key = String(vendorId);
                if (qty <= 0) {
                    get().removeFromCart(vendorId, productId);
                    return;
                }
                set((state) => {
                    const current = state.cart[key] || [];
                    const updated = current.map((c) =>
                        c.product_id === productId ? { ...c, quantity: qty } : c
                    );
                    return { cart: { ...state.cart, [key]: updated } };
                });
            },

            clearCart: (vendorId) => {
                const key = String(vendorId);
                set((state) => {
                    const newCart = { ...state.cart };
                    delete newCart[key];
                    return { cart: newCart };
                });
            },

            getCartTotal: (vendorId) => {
                const items = get().getCart(vendorId);
                return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            },

            getCartCount: (vendorId) => {
                const items = get().getCart(vendorId);
                return items.reduce((sum, item) => sum + item.quantity, 0);
            },

            fetchOrders: async (token) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await axios.get(`${API_URL}/vendor-orders/my-orders`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    set({ orders: res.data.orders || [], isLoading: false });
                } catch (err: any) {
                    set({ error: err.response?.data?.detail || 'Failed to fetch orders', isLoading: false });
                }
            },

            checkout: async (token, vendorId, data) => {
                set({ isLoading: true, error: null });
                try {
                    const formData = new FormData();
                    formData.append('vendor_id', String(vendorId));
                    formData.append('items', JSON.stringify(data.items));
                    formData.append('customer_name', data.customer_name);
                    if (data.customer_phone) formData.append('customer_phone', data.customer_phone);
                    if (data.delivery_location) formData.append('delivery_location', data.delivery_location);
                    if (data.customer_notes) formData.append('customer_notes', data.customer_notes);
                    formData.append('payment_method', data.payment_method);
                    if (data.event_id) formData.append('event_id', String(data.event_id));
                    formData.append('payment_screenshot', data.payment_screenshot);

                    const res = await axios.post(`${API_URL}/vendor-orders/`, formData, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data',
                        }
                    });
                    set({ isLoading: false });
                    return res.data as VendorOrder;
                } catch (err: any) {
                    set({ error: err.response?.data?.detail || 'Checkout failed', isLoading: false });
                    return null;
                }
            },
        }),
        {
            name: 'vendor-marketplace-cart',
            partialize: (state) => ({ cart: state.cart }),
        }
    )
);
