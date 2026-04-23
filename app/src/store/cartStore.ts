import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  eventId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  selectedTier: string;
  tierName: string;
  maxPerOrder: number;
  availableQuantity: number;
}

interface CartState {
  items: CartItem[];
  isLoading: boolean;
  error: string | null;
  userId: string | null; // Track which user owns this cart

  // Actions
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  setUserId: (userId: string | null) => void; // Set user context
  getCartTotal: () => number;
  getTotalItems: () => number;
  getItemCount: () => number;
  validateCart: () => Promise<{ valid: boolean; errors: string[] }>;
  syncWithServer: (token: string) => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      error: null,
      userId: null,

      addToCart: (item) => {
        set((state) => {
          const existingItemIndex = state.items.findIndex(
            (i) => i.eventId === item.eventId && i.selectedTier === item.selectedTier
          );

          if (existingItemIndex >= 0) {
            // Update existing item
            const updatedItems = [...state.items];
            const existingItem = updatedItems[existingItemIndex];
            const newQuantity = existingItem.quantity + item.quantity;

            // Check max per order
            if (newQuantity > item.maxPerOrder) {
              console.error(`[CartStore] Max per order exceeded: ${newQuantity} > ${item.maxPerOrder}`);
              return { ...state, error: `Maximum ${item.maxPerOrder} tickets per order` };
            }

            updatedItems[existingItemIndex] = {
              ...existingItem,
              quantity: newQuantity,
            };
            return { items: updatedItems, error: null };
          }

          // Add new item
          const newItem: CartItem = {
            id: `${item.eventId}-${item.selectedTier}-${Date.now()}`, // Generate unique ID
            eventId: item.eventId,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
            selectedTier: item.selectedTier,
            tierName: item.tierName,
            maxPerOrder: item.maxPerOrder,
            availableQuantity: item.availableQuantity,
          };
          return {
            items: [...state.items, newItem],
            error: null,
          };
        });
      },

      updateQuantity: (itemId, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((item) => item.id !== itemId),
              error: null,
            };
          }

          return {
            items: state.items.map((item) =>
              item.id === itemId
                ? { ...item, quantity: Math.min(quantity, item.maxPerOrder) }
                : item
            ),
            error: null,
          };
        });
      },

      removeFromCart: (itemId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
          error: null,
        }));
      },

      clearCart: () => set({ items: [], error: null }),

      setUserId: (userId: string | null) => {
        set({ userId });
      },

      getCartTotal: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getItemCount: () => {
        return get().items.length;
      },

      validateCart: async () => {
        const { items } = get();
        const errors: string[] = [];

        if (items.length === 0) {
          errors.push('Cart is empty');
          return { valid: false, errors };
        }

        // Validate each item against server inventory
        set({ isLoading: true });
        try {
          for (const item of items) {
            // Check if ticket tier is still available
            const response = await fetch(`${API_URL}/ticket-tiers/${item.selectedTier}`);
            if (!response.ok) {
              errors.push(`${item.title}: Ticket tier no longer available`);
              continue;
            }

            const tierData = await response.json();

            if (tierData.status === 'sold_out') {
              errors.push(`${item.title}: Tickets are sold out`);
            } else if (tierData.quantity_sold + item.quantity > tierData.quantity) {
              const remaining = tierData.quantity - tierData.quantity_sold;
              errors.push(`${item.title}: Only ${remaining} tickets remaining`);
            }

            if (item.quantity > tierData.max_per_order) {
              errors.push(`${item.title}: Maximum ${tierData.max_per_order} tickets per order`);
            }
          }

          return { valid: errors.length === 0, errors };
        } catch (error: unknown) {
          errors.push(`Validation error: ${(error as { message?: string }).message}`);
          return { valid: false, errors };
        } finally {
          set({ isLoading: false });
        }
      },

      syncWithServer: async (_token: string) => {
        // Cart sync is client-side only — no backend cart API exists yet
        // This preserves cross-session cart data via localStorage (zustand persist)
        return;
      },
    }),
    {
      name: 'cart-storage',
    }
  )
);

export default useCartStore;
