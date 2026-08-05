import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/components/auth/auth-provider';
import { ToastProvider } from '@/components/ui/toast';
import { ThemeProvider } from '@/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Query defaults tuned for a field app on a patchy connection: data stays
 * usable while it refetches, and a failed request is retried twice before the
 * user is told anything — but never for a 4xx, which will not succeed on a
 * second attempt.
 */
const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 1000 * 60 * 30,
        retry: (failureCount, error) => {
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  });

export default function RootLayout() {
  const scheme = useColorScheme();
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    // React Query's default focus tracking is web-only; wiring it to AppState
    // means returning from the lock screen refreshes what is on screen.
    const subscription = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
    });
    onlineManager.setOnline(true);
    void SplashScreen.hideAsync();
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
              <AuthProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                  }}
                >
                  <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                  <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                  <Stack.Screen name="change-password" options={{ animation: 'slide_from_bottom' }} />
                </Stack>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
