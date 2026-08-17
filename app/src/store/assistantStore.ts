import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

export interface AssistantMessage {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  payload_json?: Record<string, unknown> | null;
  created_at?: string;
}

export interface AssistantSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ExtractedEvent {
  title?: string;
  title_cn?: string;
  description?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  venue?: string;
  address?: string;
  city?: string;
  lineup?: string[];
  ticket_price?: number | null;
  currency?: string;
  tags?: string[];
  event_type?: string;
  raw_text?: string;
  confidence?: number;
  missing_fields?: string[];
}

export interface ExtractedProduct {
  name: string;
  price: number;
  description?: string;
  category?: string;
  currency?: string;
  stock_quantity?: number;
}

export interface AssistantDraft {
  id: number;
  draft_type: 'event' | 'product';
  status: 'draft' | 'published' | 'discarded';
  title: string;
  payload_json: {
    products?: ExtractedProduct[];
    title?: string;
    description?: string;
    start_date?: string;
    start_time?: string;
    [key: string]: unknown;
  };
  source_media_url?: string;
  published_event_id?: number | null;
  published_product_ids?: number[];
  created_at: string;
  updated_at: string;
}

interface AssistantState {
  isOpen: boolean;
  sessionId: number | null;
  messages: AssistantMessage[];
  drafts: AssistantDraft[];
  isLoading: boolean;
  isUploading: boolean;
  config: { enabled: boolean; max_upload_size: number } | null;
  userContext: Record<string, unknown>;

  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setUserContext: (ctx: Record<string, unknown>) => void;
  fetchConfig: () => Promise<void>;
  sendMessage: (message: string, token: string) => Promise<void>;
  loadMessages: (sessionId: number, token: string) => Promise<void>;
  extractEvent: (file: File | null, text?: string, token?: string) => Promise<AssistantDraft | null>;
  extractProducts: (file: File | null, text?: string, token?: string) => Promise<AssistantDraft | null>;
  fetchDrafts: (token: string) => Promise<void>;
  updateDraft: (draftId: number, payload: Record<string, unknown>, token: string) => Promise<void>;
  publishDraft: (draftId: number, token: string) => Promise<{ event_id?: number; product_ids?: number[]; message?: string }>;
  discardDraft: (draftId: number, token: string) => Promise<void>;
  resetSession: () => void;
}

const SIA_STORAGE_KEY = 'sia_chat_messages';

async function apiFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  }
  return res.json();
}

const loadStoredMessages = (): AssistantMessage[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SIA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveMessages = (messages: AssistantMessage[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SIA_STORAGE_KEY, JSON.stringify(messages.slice(-100)));
  } catch {
    // Ignore storage errors
  }
};

export const useAssistantStore = create<AssistantState>((set, get) => ({
  isOpen: false,
  sessionId: null,
  messages: loadStoredMessages(),
  drafts: [],
  isLoading: false,
  isUploading: false,
  config: null,
  userContext: {},

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  setUserContext: (ctx) => set({ userContext: { ...get().userContext, ...ctx } }),

  fetchConfig: async () => {
    try {
      const data = await fetch(`${API_BASE_URL}/assistant/config`).then((r) => r.json());
      set({ config: data });
    } catch {
      set({ config: { enabled: false, max_upload_size: 10_485_760 } });
    }
  },

  resetSession: () => {
    set({ sessionId: null, messages: [] });
    saveMessages([]);
  },

  sendMessage: async (message, token) => {
    set({ isLoading: true });
    try {
      const history = get().messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const body = JSON.stringify({
        message,
        session_id: get().sessionId || undefined,
        user_context: get().userContext,
        history,
      });

      const data = await apiFetch('/assistant/chat', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      set((s) => {
        const nextMessages: AssistantMessage[] = [
          ...s.messages,
          { role: 'user', content: message },
          {
            role: 'assistant',
            content: data.message,
            payload_json: {
              intent: data.intent,
              draft_id: data.draft_id,
              source: data.source,
              confidence: data.confidence,
              suggested_actions: data.suggested_actions,
              related_events: data.related_events,
              escalated: data.escalated,
            },
          },
        ];
        saveMessages(nextMessages);
        return {
          sessionId: data.session_id,
          messages: nextMessages,
        };
      });
    } finally {
      set({ isLoading: false });
    }
  },

  loadMessages: async (sessionId, token) => {
    const data = await apiFetch(`/assistant/sessions/${sessionId}/messages`, token);
    set({ sessionId, messages: data.messages || [] });
  },

  extractEvent: async (file, text, token) => {
    if (!token) return null;
    set({ isUploading: true });
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (text) formData.append('text', text);
      const sessionId = get().sessionId;
      if (sessionId) formData.append('session_id', String(sessionId));

      const data = await apiFetch('/assistant/extract-event', token, {
        method: 'POST',
        body: formData,
      });

      const draft: AssistantDraft = {
        id: data.draft_id,
        draft_type: 'event',
        status: 'draft',
        title: data.draft?.title || 'Event Draft',
        payload_json: data.draft || {},
        source_media_url: data.media_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      set((s) => ({
        drafts: [draft, ...s.drafts],
        messages: [
          ...s.messages,
          {
            role: 'assistant',
            content: `I extracted a draft event: **${draft.title}** (confidence ${Math.round((data.confidence || 0) * 100)}%).${data.missing_fields?.length ? ` Missing: ${data.missing_fields.join(', ')}.` : ''}`,
            payload_json: { draft_id: draft.id, intent: 'extract_event' },
          },
        ],
      }));

      return draft;
    } finally {
      set({ isUploading: false });
    }
  },

  extractProducts: async (file, text, token) => {
    if (!token) return null;
    set({ isUploading: true });
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (text) formData.append('text', text);
      const sessionId = get().sessionId;
      if (sessionId) formData.append('session_id', String(sessionId));

      const data = await apiFetch('/assistant/extract-products', token, {
        method: 'POST',
        body: formData,
      });

      const draft: AssistantDraft = {
        id: data.draft_id,
        draft_type: 'product',
        status: 'draft',
        title: `${data.count || 0} Product Draft(s)`,
        payload_json: { products: data.products || [] },
        source_media_url: data.media_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      set((s) => ({
        drafts: [draft, ...s.drafts],
        messages: [
          ...s.messages,
          {
            role: 'assistant',
            content: `I found ${data.count || 0} product(s) in your menu. Review and publish when ready.`,
            payload_json: { draft_id: draft.id, intent: 'extract_products' },
          },
        ],
      }));

      return draft;
    } finally {
      set({ isUploading: false });
    }
  },

  fetchDrafts: async (token) => {
    const data = await apiFetch('/assistant/drafts', token);
    set({ drafts: data.drafts || [] });
  },

  updateDraft: async (draftId, payload, token) => {
    await apiFetch(`/assistant/drafts/${draftId}`, token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload_json: payload }),
    });
    await get().fetchDrafts(token);
  },

  publishDraft: async (draftId, token) => {
    const data = await apiFetch(`/assistant/drafts/${draftId}/publish`, token, {
      method: 'POST',
    });
    await get().fetchDrafts(token);
    return data;
  },

  discardDraft: async (draftId, token) => {
    await apiFetch(`/assistant/drafts/${draftId}`, token, {
      method: 'DELETE',
    });
    set((s) => ({
      drafts: s.drafts.filter((d) => d.id !== draftId),
    }));
  },
}));
