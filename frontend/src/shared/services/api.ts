import axios from 'axios';
import toast from 'react-hot-toast';
import { COOKIE_SESSION, useAuthStore } from '../../store/authStore';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipToast?: boolean;
  }
}

/**
 * Resolves the API Base URL from the environment (VITE_API_URL).
 * Normalizes trailing slashes and ensures /api routing.
 */
const resolveBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  const configuredUrl = typeof envUrl === 'string' ? envUrl.trim() : '';
  if (!configuredUrl && import.meta.env.DEV) {
    return 'http://localhost:5000/api';
  }
  if (!configuredUrl) {
    return '';
  }

  if (configuredUrl.startsWith('/')) {
    const path = configuredUrl.replace(/\/+$/, '');
    return path.endsWith('/api') ? path : `${path}/api`;
  }

  const apiUrl = new URL(configuredUrl);
  const browserHost = typeof window === 'undefined' ? '' : window.location.hostname;
  const isLoopback = (host: string) => host === 'localhost' || host === '127.0.0.1';

  if (isLoopback(browserHost) && isLoopback(apiUrl.hostname)) {
    apiUrl.hostname = browserHost;
  }

  const baseUrl = apiUrl.toString().replace(/\/+$/, '');
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
};

/**
 * Shared, configured Axios instance for all frontend HTTP communication.
 */
export const api = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor: Attach Authorization Bearer token from authStore.
 */
api.interceptors.request.use(
  (config) => {
    if (!config.baseURL) {
      const message =
        'The API server is not configured for this deployment. Set VITE_API_URL to your public backend API URL.';
      if (!config.skipToast) {
        toast.error(message, { id: message });
      }
      return Promise.reject(new Error(message));
    }

    const token = useAuthStore.getState().token;
    if (token && token !== COOKIE_SESSION) {
      if (config.headers && typeof config.headers.set === 'function') {
        if (!config.headers.has('Authorization')) {
          config.headers.set('Authorization', `Bearer ${token}`);
        }
      } else {
        config.headers = config.headers || {};
        if (!config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Extracts a clear, user-friendly error message from Axios errors,
 * validation error arrays, HTTP status codes, or network failures.
 */
export const extractErrorMessage = (error: any): string => {
  if (error?.response?.data) {
    const data = error.response.data;

    // Handle array of validation errors (e.g., Zod error list)
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const details = data.errors
        .map((errItem: any) => {
          if (typeof errItem === 'string') return errItem;
          if (errItem?.message) {
            return errItem.field ? `${errItem.field}: ${errItem.message}` : errItem.message;
          }
          return null;
        })
        .filter(Boolean)
        .join(', ');

      if (details) {
        return data.message ? `${data.message} (${details})` : details;
      }
    }

    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }

    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim();
    }
  }

  const status = error?.response?.status;
  if (status === 401) {
    return 'Session expired or unauthorized. Please log in again.';
  }
  if (status === 403) {
    return 'Access denied: You do not have permission to access this resource.';
  }
  if (status === 404) {
    return 'The requested resource was not found.';
  }
  if (status === 429) {
    return 'Too many requests. Please slow down and try again shortly.';
  }
  if (status && status >= 500) {
    return 'Internal server error. Please try again later.';
  }

  if (error?.code === 'ECONNABORTED') {
    return 'Request timeout. The server took too long to respond.';
  }

  if (!error?.response && error?.request) {
    return 'Network error: Unable to connect to the server. Please check your internet connection.';
  }

  if (typeof error?.message === 'string' && error.message !== 'Network Error') {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
};

/**
 * Response Interceptor:
 * 1. Unwraps data directly for ease of use.
 * 2. Clears authentication state on 401 Unauthorized.
 * 3. Shows clear messages via toast (deduplicated by message id).
 * 4. Rejects with an enhanced Error holding clear message and response context.
 */
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }

    const message = extractErrorMessage(error);

    // Show clear toast notification unless skipToast is enabled
    const skipToast = Boolean((error.config as { skipToast?: boolean } | undefined)?.skipToast);
    if (!skipToast) {
      toast.error(message, { id: message });
    }

    const enhancedError = new Error(message);
    (enhancedError as any).response = error.response;
    (enhancedError as any).status = error.response?.status;
    (enhancedError as any).code = error.code;
    return Promise.reject(enhancedError);
  }
);

export default api;
