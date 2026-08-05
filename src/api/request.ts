import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { toast } from '@/components/ui/toast';
import { API_BASE_URL } from '@/lib/env';
import { authStore } from '@/store/auth-store';
import type { ApiError } from '@/types/auth';

const request = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // The refresh token is an httpOnly cookie; native networking keeps its own
  // cookie jar, and this keeps the behaviour identical when running on web.
  withCredentials: true,
  timeout: 30_000,
});

/** Bare client for refresh calls — using `request` would recurse infinitely. */
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 30_000,
});

request.interceptors.request.use((config) => {
  const token = authStore.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Refresh coordination.
 *
 * When a token expires, several parallel requests typically 401 at once. Without
 * coordination each would fire its own refresh, and because refresh tokens
 * rotate, the second would present an already-retired token and trip the
 * server's reuse detection — logging the user out entirely.
 *
 * So: the first 401 performs the refresh; every other request queues and is
 * replayed with the new token once it resolves.
 */
let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

const flushQueue = (error: unknown, token: string | null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  refreshQueue = [];
};

/** Called when the session cannot be recovered. Set by the auth provider. */
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  onSessionExpired = handler;
};

/** Called when the server demands a password change before anything else. */
let onPasswordChangeRequired: (() => void) | null = null;
export const setPasswordChangeRequiredHandler = (handler: (() => void) | null) => {
  onPasswordChangeRequired = handler;
};

const handleSessionExpiry = () => {
  authStore.clear();
  onSessionExpired?.();
};

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Endpoints where a 401 is the answer itself, not a signal to refresh. */
const isAuthEndpoint = (url?: string): boolean =>
  Boolean(
    url &&
      (url.includes('/auth/login') ||
        url.includes('/auth/refresh') ||
        url.includes('/auth/forgot-password') ||
        url.includes('/auth/reset-password'))
  );

request.interceptors.response.use(
  (response: AxiosResponse) => response,

  async (error: AxiosError<{ error?: ApiError }>) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const apiError = error.response?.data?.error;

    // ------------------------------------------------------------ network
    if (!error.response) {
      // A cancelled request is not a failure worth shouting about.
      if (axios.isCancel(error)) return Promise.reject(error);
      toast.error('Network error', {
        description: 'Could not reach the server. Check your connection.',
      });
      return Promise.reject(error);
    }

    // --------------------------------------------------------------- 401
    if (status === 401 && originalRequest && !isAuthEndpoint(originalRequest.url)) {
      // A stale session (password changed, deactivated, role changed) cannot be
      // recovered by refreshing — the user must sign in again.
      const unrecoverable = ['TOKEN_STALE', 'ACCOUNT_INACTIVE', 'ROLE_INACTIVE'];
      if (apiError && unrecoverable.includes(apiError.code)) {
        handleSessionExpiry();
        toast.error('Session ended', { description: apiError.message });
        return Promise.reject(error);
      }

      if (originalRequest._retry) {
        handleSessionExpiry();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token: string) => {
              originalRequest._retry = true;
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(request(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await refreshClient.post('/api/auth/refresh');
        const newToken: string = data.data.accessToken;

        authStore.setToken(newToken);
        flushQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return request(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        handleSessionExpiry();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // --------------------------------------------------------------- 403
    if (status === 403) {
      // A forced password change is a redirect, not a permission problem.
      const details = apiError?.details as { code?: string } | undefined;
      if (details?.code === 'PASSWORD_CHANGE_REQUIRED') {
        onPasswordChangeRequired?.();
        return Promise.reject(error);
      }

      toast.error('Access denied', {
        description: apiError?.message ?? 'You do not have permission to do that.',
      });
      return Promise.reject(error);
    }

    // --------------------------------------------------------------- 429
    if (status === 429) {
      toast.error('Too many requests', { description: 'Please slow down and try again in a moment.' });
      return Promise.reject(error);
    }

    // --------------------------------------------------------------- 5xx
    if (status && status >= 500) {
      toast.error('Server error', {
        description: apiError?.requestId
          ? `Something went wrong. Reference: ${apiError.requestId}`
          : 'Something went wrong. Please try again.',
      });
    }

    return Promise.reject(error);
  }
);

/** Extracts a displayable message from an axios error. */
export const getErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  if (axios.isAxiosError(error)) {
    const apiError = (error.response?.data as { error?: ApiError } | undefined)?.error;
    if (apiError?.details && Array.isArray(apiError.details)) {
      const issues = apiError.details as Array<{ field: string; message: string }>;
      if (issues.length > 0) return issues.map((i) => i.message).join(', ');
    }
    return apiError?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
};

export { refreshClient };
export default request;
