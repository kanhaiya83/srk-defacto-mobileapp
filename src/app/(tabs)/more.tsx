import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { authApi } from '@/api/auth-api';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfirmSheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { Header, Screen } from '@/components/ui/screen';
import { ADMIN } from '@/config/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { API_BASE_URL } from '@/lib/env';
import { formatDateTime, initialsOf } from '@/lib/format';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

export default function MoreTab() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [confirm, setConfirm] = useState<null | 'logout' | 'logoutAll'>(null);
  const [busy, setBusy] = useState(false);

  const adminItems = ADMIN.filter((item) => can(item.permission ?? `${item.module}:read`));

  const signOut = async (everywhere: boolean) => {
    setBusy(true);
    try {
      // Best effort — the server revokes the refresh token, but a network
      // failure must not trap someone in a session they asked to leave.
      if (everywhere) {
        await authApi.logoutAll();
        toast.success('Signed out of all devices');
      } else {
        await authApi.logout();
      }
    } catch {
      if (everywhere) toast.error('Could not sign out other sessions');
    } finally {
      setBusy(false);
      setConfirm(null);
      queryClient.clear();
      clearSession();
      router.replace('/login');
    }
  };

  return (
    <Screen>
      <Header title="More" onBack={null} large />

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primary,
              }}
            >
              <Text variant="heading" style={{ color: theme.colors.primaryText }}>
                {initialsOf(user?.name)}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="heading" numberOfLines={1}>
                {user?.name}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {user?.email}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Badge label={user?.role.name ?? 'No role'} tone="primary" />
                {user?.isSuperAdmin && <Badge label="Super admin" tone="warning" />}
              </View>
            </View>
          </View>

          {!!user?.lastLoginAt && (
            <Text variant="caption" tone="faint" style={{ marginTop: theme.spacing.md }}>
              Last signed in {formatDateTime(user.lastLoginAt)}
            </Text>
          )}
        </Card>

        {adminItems.length > 0 && (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" tone="muted">
              ADMINISTRATION
            </Text>
            {adminItems.map((item) => (
              <MenuRow
                key={item.path}
                icon={item.icon}
                label={item.label}
                description={item.description}
                onPress={() => router.push(item.path as never)}
              />
            ))}
          </View>
        )}

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            ACCOUNT
          </Text>
          <MenuRow
            icon="key-outline"
            label="Change password"
            description="Update the password for this account"
            onPress={() => router.push('/change-password')}
          />
          <MenuRow
            icon="phone-portrait-outline"
            label="Sign out of all devices"
            description="Ends every active session, including this one"
            onPress={() => setConfirm('logoutAll')}
          />
          <MenuRow icon="log-out-outline" label="Sign out" tone="danger" onPress={() => setConfirm('logout')} />
        </View>

        <View style={{ gap: 2, alignItems: 'center', paddingTop: theme.spacing.md }}>
          <Text variant="caption" tone="faint">
            Defacto ERP · Mobile
          </Text>
          <Text variant="caption" tone="faint">
            {API_BASE_URL.replace(/^https?:\/\//, '')}
          </Text>
        </View>
      </ScrollView>

      <ConfirmSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => signOut(confirm === 'logoutAll')}
        loading={busy}
        tone="primary"
        title={confirm === 'logoutAll' ? 'Sign out everywhere?' : 'Sign out?'}
        description={
          confirm === 'logoutAll'
            ? 'Every device signed in as you will be signed out immediately.'
            : 'You will need your password to sign back in.'
        }
        confirmLabel="Sign out"
      />
    </Screen>
  );
}

function MenuRow({
  icon,
  label,
  description,
  onPress,
  tone = 'default',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.colors.danger : theme.colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tone === 'danger' ? theme.colors.dangerSoft : theme.colors.primarySoft,
        }}
      >
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong" tone={tone === 'danger' ? 'danger' : 'default'}>
          {label}
        </Text>
        {!!description && (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {description}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={17} color={theme.colors.faintText} />
    </Pressable>
  );
}
