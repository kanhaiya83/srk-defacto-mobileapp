import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { authApi } from '@/api/auth-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/field';
import { Callout } from '@/components/ui/misc';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const passwordRef = useRef<TextInput>(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const { accessToken, user, mustChangePassword } = await authApi.login(identifier.trim(), password);
      setSession(user, accessToken);

      if (mustChangePassword) {
        toast.info('Choose a new password to continue');
        router.replace('/change-password');
        return;
      }

      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      router.replace('/');
    } catch (err) {
      // Shown inline rather than as a toast — it is the primary result of the
      // form, not an incidental notification.
      setError(getErrorMessage(err, 'Unable to sign in'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: theme.spacing.xl,
            gap: theme.spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.duration(400)} style={{ gap: theme.spacing.md }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="cube" size={26} color={theme.colors.primaryText} />
            </View>
            <View style={{ gap: 4 }}>
              <Text variant="display">Defacto</Text>
              <Text variant="body" tone="muted">
                Sign in to manage inward, processing and dispatch.
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ gap: theme.spacing.lg }}>
            <Field label="Email or username">
              <Input
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="you@company.com"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                keyboardType="email-address"
                returnKeyType="next"
                editable={!submitting}
                leftIcon="person-outline"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </Field>

            <Field label="Password">
              <PasswordInput
                ref={passwordRef}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
                returnKeyType="go"
                editable={!submitting}
                leftIcon="lock-closed-outline"
                onSubmitEditing={handleSubmit}
              />
            </Field>

            {!!error && <Callout tone="danger" title="Sign-in failed" description={error} />}

            <Button
              label={submitting ? 'Signing in…' : 'Sign in'}
              size="lg"
              fullWidth
              loading={submitting}
              disabled={!canSubmit}
              onPress={handleSubmit}
            />

            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/forgot-password')}
              hitSlop={8}
              style={{ alignSelf: 'center' }}
            >
              <Text variant="label" tone="primary">
                Forgot password?
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
