import axios from 'axios';

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// For backwards compatibility with existing code
export const getApiUrl = () => import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

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

// Global axios interceptor for PLAN_RESTRICTED errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error?.response?.data;
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
