import { useRouter } from 'expo-router';
import { useState } from 'react';

import { authApi } from '@/api/auth-api';
import { getErrorMessage } from '@/api/request';
import { PasswordStrength } from '@/components/auth/password-strength';
import { Button } from '@/components/ui/button';
import { Field, PasswordInput } from '@/components/ui/field';
import { Callout } from '@/components/ui/misc';
import { Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { isPasswordValid } from '@/lib/password-policy';
import { useAuthStore } from '@/store/auth-store';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const forced = Boolean(user?.mustChangePassword);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const reused = newPassword.length > 0 && newPassword === currentPassword;
  const canSubmit =
    currentPassword.length > 0 && isPasswordValid(newPassword) && !mismatch && !reused && confirmPassword.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword, confirmPassword });
      // Changing a password invalidates every issued token, this device's
      // included — so the only honest next step is a fresh sign-in.
      toast.success('Password changed', { description: 'Please sign in again with your new password.' });
      clearSession();
      router.replace('/login');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to change password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title="Change password"
        onBack={forced ? null : () => router.back()}
        subtitle={user?.email}
      />
      <Body>
        {forced && (
          <Callout
            tone="warning"
            title="A new password is required"
            description="Your administrator asked you to set your own password before continuing."
          />
        )}

        <Field label="Current password">
          <PasswordInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            autoFocus
            leftIcon="lock-closed-outline"
            editable={!submitting}
          />
        </Field>

        <Field label="New password" error={reused ? 'Choose a password you have not used here' : undefined}>
          <PasswordInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            error={reused}
            leftIcon="key-outline"
            editable={!submitting}
          />
        </Field>

        <PasswordStrength value={newPassword} />

        <Field label="Confirm new password" error={mismatch ? 'Passwords do not match' : undefined}>
          <PasswordInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            error={mismatch}
            leftIcon="key-outline"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            editable={!submitting}
          />
        </Field>

        {!!error && <Callout tone="danger" title="Could not change password" description={error} />}

        <Button
          label="Change password"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />

        <Text variant="caption" tone="faint" style={{ textAlign: 'center' }}>
          All your other devices will be signed out.
        </Text>
      </Body>
    </Screen>
  );
}
