/**
 * Smart Notification Engine - Frontend Behaviour Tracker (Phase 1)
 * Seamlessly tracks user interactions to build dynamic interest profiles.
 */
import { API_BASE_URL } from '@/config/api';

export interface ActivityPayload {
  action_type: 'view' | 'like' | 'share' | 'follow' | 'unfollow' | 'watch' | 'save' | 'purchase' | 'attend';
  entity_type: 'event' | 'artist' | 'dj' | 'venue' | 'reel' | 'community_post' | 'product';
  entity_id?: number | string;
  category?: string;
  metadata?: Record<string, any>;
}

// In-memory cache to debounce identical view events within a session (prevents spamming backend)
const recentEvents = new Set<string>();

export const trackActivity = async (payload: ActivityPayload): Promise<void> => {
  const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
  if (!token) return; // Only track authenticated interactions for interest scoring

  // Debounce key: action + entity_type + entity_id
  const key = `${payload.action_type}:${payload.entity_type}:${payload.entity_id || ''}`;
  if (payload.action_type === 'view' && recentEvents.has(key)) {
    return;
  }
  if (payload.action_type === 'view') {
    recentEvents.add(key);
    setTimeout(() => recentEvents.delete(key), 60000); // 1-minute client debounce
  }

  try {
    const numId = typeof payload.entity_id === 'string' ? parseInt(payload.entity_id, 10) : payload.entity_id;
    await fetch(`${API_BASE_URL}/activity/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action_type: payload.action_type,
        entity_type: payload.entity_type,
        entity_id: isNaN(numId as any) ? null : numId,
        category: payload.category,
        metadata: payload.metadata,
      }),
      // Use keepalive so requests complete even during page transitions
      keepalive: true,
    });
  } catch {
    // Non-blocking telemetry
  }
};
