import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';

import { authApi } from '@/api/auth-api';
import { setPasswordChangeRequiredHandler, setSessionExpiredHandler } from '@/api/request';
import { Loading } from '@/components/ui/feedback';
import { Screen } from '@/components/ui/screen';
import { sessionStorage } from '@/lib/session-storage';
import { useAuthStore } from '@/store/auth-store';

/**
 * Restores the session on launch and keeps navigation in sync with it.
 *
 * Boot order matters: the stored token is put back first so the very first
 * screen can render signed-in, then it is verified against `/auth/me`. If that
 * fails the axios interceptor tries the refresh cookie, and only if that also
 * fails is the user sent to sign-in — so a warehouse phone that has been asleep
 * for a week still opens straight into the app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segments = useSegments();

  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);
  const setInitializing = useAuthStore((s) => s.setInitializing);
  const clearSession = useAuthStore((s) => s.clearSession);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const hasBootstrapped = useRef(false);

  useEffect(() => {
    if (hasBootstrapped.current) return;
    hasBootstrapped.current = true;

    const bootstrap = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          sessionStorage.getAccessToken(),
          sessionStorage.getUser(),
        ]);

        if (storedToken && storedUser) {
          // Optimistic: render the app immediately, then confirm.
          setSession(storedUser, storedToken);
          try {
            setUser(await authApi.me());
          } catch {
            clearSession();
          }
        } else {
          const { accessToken, user: freshUser } = await authApi.refresh();
          setSession(freshUser, accessToken);
        }
      } catch {
        // No recoverable session — expected on first launch and after logout.
        clearSession();
      } finally {
        setInitializing(false);
      }
    };

    void bootstrap();
  }, [setSession, setUser, clearSession, setInitializing]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession();
      router.replace('/login');
    });
    setPasswordChangeRequiredHandler(() => router.replace('/change-password'));
    return () => {
      setSessionExpiredHandler(null);
      setPasswordChangeRequiredHandler(null);
    };
  }, [router, clearSession]);

  // ------------------------------------------------------------------ routing
  useEffect(() => {
    if (isInitializing) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onChangePassword = segments.includes('change-password');

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
      return;
    }
    if (isAuthenticated && inAuthGroup) {
      router.replace('/');
      return;
    }
    // A forced password change outranks everything else the user might do.
    if (isAuthenticated && user?.mustChangePassword && !onChangePassword) {
      router.replace('/change-password');
    }
  }, [isInitializing, isAuthenticated, user?.mustChangePassword, segments, router]);

  if (isInitializing) {
    return (
      <Screen>
        <Loading label="Restoring your session…" />
      </Screen>
    );
  }

  return <>{children}</>;
}
