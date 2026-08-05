import * as SecureStore from 'expo-secure-store';

import type { AuthUser } from '@/types/auth';

/**
 * Session persistence.
 *
 * The web client keeps its access token in memory only, because anything in
 * `localStorage` is readable by any script on the page. A phone has no such
 * ambient-script problem, and an app that logs you out every cold start is
 * unusable in a warehouse. So the token goes to the OS keystore (Keychain /
 * EncryptedSharedPreferences) instead — encrypted at rest and readable only by
 * this app — and is still verified against the server on every boot.
 */

const TOKEN_KEY = 'defacto.accessToken';
const USER_KEY = 'defacto.user';

const read = async (key: string) => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const write = async (key: string, value: string | null) => {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // A keystore failure must never break sign-in; the session simply won't
    // survive a cold start.
  }
};

export const sessionStorage = {
  getAccessToken: () => read(TOKEN_KEY),
  setAccessToken: (token: string | null) => write(TOKEN_KEY, token),

  async getUser(): Promise<AuthUser | null> {
    const raw = await read(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
  setUser: (user: AuthUser | null) => write(USER_KEY, user ? JSON.stringify(user) : null),

  async clear() {
    await Promise.all([write(TOKEN_KEY, null), write(USER_KEY, null)]);
  },
};
