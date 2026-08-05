import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { authApi } from '@/api/auth-api';
import { getErrorMessage } from '@/api/request';
import { PasswordStrength } from '@/components/auth/password-strength';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Field, PasswordInput } from '@/components/ui/field';
import { Callout } from '@/components/ui/misc';
import { Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { isPasswordValid } from '@/lib/password-policy';

/**
 * Reached from the emailed link via the `mobileapp://reset-password?token=…`
 * deep link (see `scheme` in app.json).
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = isPasswordValid(password) && !mismatch && confirmPassword.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !token) return;
    setError(null);
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password, confirmPassword });
      toast.success('Password reset', { description: 'You can now sign in with your new password.' });
      router.replace('/login');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to reset password'));
    } finally {
      setSubmitting(false);
    }
  };

  // A missing token means the link was mistyped or truncated by a mail client.
  if (!token) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title="Reset password" onBack={() => router.replace('/login')} />
        <EmptyState
          icon="warning-outline"
          title="Invalid reset link"
          description="This link is missing its security token. Please request a new password reset."
          actionLabel="Request a new link"
          onAction={() => router.replace('/forgot-password')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Choose a new password" onBack={() => router.replace('/login')} />
      <Body>
        <Text variant="body" tone="muted">
          Pick something you have not used here before.
        </Text>

        <Field label="New password">
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            autoFocus
            leftIcon="lock-closed-outline"
            editable={!submitting}
          />
        </Field>

        <PasswordStrength value={password} />

        <Field label="Confirm password" error={mismatch ? 'Passwords do not match' : undefined}>
          <PasswordInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            error={mismatch}
            leftIcon="lock-closed-outline"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            editable={!submitting}
          />
        </Field>

        {!!error && <Callout tone="danger" title="Could not reset password" description={error} />}

        <Button
          label="Reset password"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />
      </Body>
    </Screen>
  );
}
