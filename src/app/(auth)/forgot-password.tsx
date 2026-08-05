import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { authApi } from '@/api/auth-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Callout } from '@/components/ui/misc';
import { Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim());
      // The server deliberately returns the same response whether or not the
      // account exists, so this must not imply that it was found.
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to send reset email'));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="" onBack={() => router.back()} />
        <Body>
          <Animated.View entering={FadeIn.duration(300)} style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.xl }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.successSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="mail-open-outline" size={26} color={theme.colors.success} />
            </View>
            <Text variant="display">Check your email</Text>
            <Text variant="body" tone="muted">
              If an account exists for {email.trim()}, a password reset link has been sent. The link expires shortly, so
              use it soon.
            </Text>
            <Button label="Back to sign in" variant="outline" fullWidth onPress={() => router.replace('/login')} />
          </Animated.View>
        </Body>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Reset password" onBack={() => router.back()} />
      <Body>
        <Text variant="body" tone="muted">
          Enter your email address and we will send you a link to reset your password.
        </Text>

        <Field label="Email address">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            leftIcon="mail-outline"
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            editable={!submitting}
          />
        </Field>

        {!!error && <Callout tone="danger" title="Could not send the link" description={error} />}

        <Button
          label="Send reset link"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={email.trim().length === 0}
          onPress={handleSubmit}
        />
      </Body>
    </Screen>
  );
}
