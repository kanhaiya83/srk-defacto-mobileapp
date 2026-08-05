import { create } from 'zustand';

import { sessionStorage } from '@/lib/session-storage';
import type { AuthUser, Permission } from '@/types/auth';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  /** True until the boot-time session restore settles. */
  isInitializing: boolean;
  isAuthenticated: boolean;

  setSession: (user: AuthUser, accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  setAccessToken: (token: string | null) => void;
  setInitializing: (value: boolean) => void;
  clearSession: () => void;

  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
  canAll: (...permissions: Permission[]) => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  isInitializing: true,
  isAuthenticated: false,

  setSession: (user, accessToken) => {
    void sessionStorage.setAccessToken(accessToken);
    void sessionStorage.setUser(user);
    set({ user, accessToken, isAuthenticated: true, isInitializing: false });
  },

  setUser: (user) => {
    void sessionStorage.setUser(user);
    set({ user });
  },

  setAccessToken: (accessToken) => {
    void sessionStorage.setAccessToken(accessToken);
    set({ accessToken, isAuthenticated: Boolean(accessToken) });
  },

  setInitializing: (isInitializing) => set({ isInitializing }),

  clearSession: () => {
    void sessionStorage.clear();
    set({ user: null, accessToken: null, isAuthenticated: false, isInitializing: false });
  },

  /**
   * Permission checks are pure client-side UI hints. They decide what to render,
   * never what is allowed — the server enforces the same rules independently, so
   * a tampered client gains nothing but a broken screen.
   */
  can: (permission) => {
    const { user } = get();
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return user.permissions.includes(permission);
  },

  canAny: (...permissions) => permissions.some((p) => get().can(p)),

  canAll: (...permissions) => permissions.every((p) => get().can(p)),
}));

/** Non-reactive accessor for use outside React (the axios interceptor). */
export const authStore = {
  getToken: () => useAuthStore.getState().accessToken,
  setToken: (token: string | null) => useAuthStore.getState().setAccessToken(token),
  clear: () => useAuthStore.getState().clearSession(),
  getUser: () => useAuthStore.getState().user,
};
