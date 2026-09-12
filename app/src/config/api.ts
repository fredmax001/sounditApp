import axios from 'axios';

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

// For backwards compatibility with existing code
export const getApiUrl = () => import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

// Helper to get full API URL with path
export const getFullApiUrl = (path: string) => {
  const base = getApiUrl();
  // Remove leading slash from path if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  // Remove trailing /api/v1 from base if path already includes it
  if (cleanPath.startsWith('api/v1')) {
    return `${base.replace('/api/v1', '')}/${cleanPath}`;
  }
  return `${base}/${cleanPath}`;
};

// Global axios interceptor for PLAN_RESTRICTED errors and 401 auth failures
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error?.response?.data;
    const status = error?.response?.status;

    if (status === 401) {
      // Token expired or invalid — clear auth and redirect to login.
      // BUT: don't redirect if this is a login/register attempt itself —
      // a 401 there means wrong credentials, not an expired session.
      const requestUrl = error?.config?.url || '';
      const isAuthEndpoint = requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/register') ||
        requestUrl.includes('/auth/verify');

      if (!isAuthEndpoint) {
        localStorage.removeItem('auth-token');
        localStorage.removeItem('refresh-token');
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }

    if (data?.code === 'PLAN_RESTRICTED' || (typeof data?.detail === 'object' && data?.detail?.code === 'PLAN_RESTRICTED')) {
      const detail = typeof data.detail === 'object' ? data.detail : data;
      window.dispatchEvent(new CustomEvent('plan-restricted', {
        detail: {
          featureName: detail.feature || detail.feature_name,
          requiredPlan: detail.required_plan,
          currentPlan: detail.current_plan,
          message: detail.message,
        }
      }));
    }
    return Promise.reject(error);
  }
);
