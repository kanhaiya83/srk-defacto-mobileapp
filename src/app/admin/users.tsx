import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useRoles,
  useSetUserStatus,
  useUpdateUser,
  useUsers,
} from '@/api/admin-queries';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Callout, SwitchRow } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet, Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatRelative } from '@/lib/format';
import { useAuthStore } from '@/store/auth-store';
import type { ManagedUser } from '@/types/auth';
import { useTheme } from '@/theme';

type Filter = 'active' | 'inactive' | 'all';

interface UserForm {
  id?: string;
  name: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  sendWelcomeEmail: boolean;
}

/**
 * User administration.
 *
 * Passwords are never chosen here: a new account gets a server-generated
 * temporary password, shown once and copyable, and the user is forced to change
 * it on first sign-in.
 */
export default function UsersScreen() {
  const theme = useTheme();
  const currentUser = useAuthStore((s) => s.user);
  const { canCreate, canUpdate, canDelete } = useModulePermissions('user');

  const [filter, setFilter] = useState<Filter>('active');
  const list = useUsers({ limit: 100 });
  const roles = useRoles();
  const create = useCreateUser();
  const update = useUpdateUser();
  const setStatus = useSetUserStatus();
  const resetPassword = useResetUserPassword();
  const remove = useDeleteUser();

  const [form, setForm] = useState<UserForm | null>(null);
  const [menuFor, setMenuFor] = useState<ManagedUser | null>(null);
  const [deleteFor, setDeleteFor] = useState<ManagedUser | null>(null);
  const [resetFor, setResetFor] = useState<ManagedUser | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const users = list.data?.data ?? [];

  const filtered = useMemo(() => {
    if (filter === 'all') return users;
    return users.filter((user) => (filter === 'active' ? user.isActive : !user.isActive));
  }, [users, filter]);

  const roleOptions = (roles.data ?? []).map((role) => ({
    value: role._id,
    label: role.name,
    description: role.description || `${role.permissions.length} permissions`,
  }));

  const roleNameOf = (user: ManagedUser) =>
    typeof user.role === 'string' ? (roles.data ?? []).find((role) => role._id === user.role)?.name ?? 'Unknown' : user.role.name;

  const openCreate = () =>
    setForm({ name: '', username: '', email: '', role: '', isActive: true, sendWelcomeEmail: true });

  const openEdit = (user: ManagedUser) =>
    setForm({
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: typeof user.role === 'string' ? user.role : user.role._id,
      isActive: user.isActive,
      sendWelcomeEmail: false,
    });

  const submit = async () => {
    if (!form) return;
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.id && !form.username.trim()) return toast.error('Username is required');
    if (!form.email.trim()) return toast.error('Email is required');
    if (!form.role) return toast.error('Select a role');

    try {
      if (form.id) {
        await update.mutateAsync({
          id: form.id,
          payload: { name: form.name, email: form.email, role: form.role, isActive: form.isActive },
        });
      } else {
        const response = await create.mutateAsync({
          name: form.name,
          username: form.username,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
          sendWelcomeEmail: form.sendWelcomeEmail,
        });
        if (response.temporaryPassword) setTemporaryPassword(response.temporaryPassword);
      }
      setForm(null);
    } catch {
      // `admin-queries` already surfaces the error as a toast.
    }
  };

  const doReset = async () => {
    if (!resetFor) return;
    try {
      const result = await resetPassword.mutateAsync({ id: resetFor._id, payload: { notifyUser: true } });
      setResetFor(null);
      if (result.temporaryPassword) setTemporaryPassword(result.temporaryPassword);
      else toast.success('Password reset', { description: result.message ?? 'The user has been emailed.' });
    } catch {
      // Handled by the mutation's onError.
    }
  };

  return (
    <Screen>
      <Header title="Users" subtitle={`${users.length} accounts`} />

      <ListBody<ManagedUser, Filter>
        items={filtered}
        isLoading={list.isLoading}
        isError={list.isError}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={(item) => [item.name, item.username, item.email]}
        searchPlaceholder="Search name, username, email…"
        filters={[
          { value: 'active', label: 'Active', count: users.filter((user) => user.isActive).length },
          { value: 'inactive', label: 'Inactive', count: users.filter((user) => !user.isActive).length },
          { value: 'all', label: 'All', count: users.length },
        ]}
        filterValue={filter}
        onFilterChange={setFilter}
        emptyTitle="No users"
        emptyDescription="Add the people who need access to the system."
        emptyActionLabel={canCreate ? 'Add user' : undefined}
        onEmptyAction={canCreate ? openCreate : undefined}
        renderItem={(item) => (
          <RecordCard
            title={item.name}
            subtitle={`${item.username} · ${item.email}`}
            icon="person-outline"
            badge={
              item.isActive ? { label: roleNameOf(item), tone: 'primary' } : { label: 'Inactive', tone: 'neutral' }
            }
            accent={item.isActive ? undefined : 'neutral'}
            fields={[
              { label: 'Role', value: roleNameOf(item) },
              { label: 'Last seen', value: item.lastLoginAt ? formatRelative(item.lastLoginAt) : 'Never' },
            ]}
            onPress={canUpdate ? () => openEdit(item) : undefined}
            onMenu={() => setMenuFor(item)}
          />
        )}
      />

      {canCreate && <Fab label="Add user" onPress={openCreate} />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
        actions={[
          { label: 'Edit', icon: 'create-outline', disabled: !canUpdate, onPress: () => menuFor && openEdit(menuFor) },
          {
            label: menuFor?.isActive ? 'Deactivate' : 'Activate',
            icon: menuFor?.isActive ? 'pause-circle-outline' : 'play-circle-outline',
            disabled: !canUpdate || menuFor?._id === currentUser?.id,
            disabledReason: menuFor?._id === currentUser?.id ? 'You cannot deactivate yourself' : undefined,
            onPress: () =>
              menuFor && setStatus.mutate({ id: menuFor._id, isActive: !menuFor.isActive }),
          },
          {
            label: 'Reset password',
            icon: 'key-outline',
            disabled: !canUpdate,
            onPress: () => menuFor && setResetFor(menuFor),
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete || menuFor?._id === currentUser?.id,
            disabledReason: menuFor?._id === currentUser?.id ? 'You cannot delete yourself' : undefined,
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      {/* ------------------------------------------------------- create/edit */}
      <Sheet
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit user' : 'New user'}
        subtitle={form?.id ? undefined : 'They will set their own password on first sign-in'}
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setForm(null)} />
            <Button
              label={form?.id ? 'Save' : 'Create user'}
              style={{ flex: 2 }}
              loading={create.isPending || update.isPending}
              onPress={submit}
            />
          </>
        }
      >
        {form && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <Field label="Full name" required>
              <Input value={form.name} onChangeText={(name) => setForm({ ...form, name })} autoCapitalize="words" />
            </Field>

            <Field label="Username" required hint={form.id ? 'Usernames cannot be changed' : 'Used to sign in'}>
              <Input
                value={form.username}
                onChangeText={(username) => setForm({ ...form, username })}
                autoCapitalize="none"
                autoCorrect={false}
                readOnly={Boolean(form.id)}
              />
            </Field>

            <Field label="Email" required>
              <Input
                value={form.email}
                onChangeText={(email) => setForm({ ...form, email })}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>

            <Field label="Role" required>
              <Select value={form.role} options={roleOptions} onChange={(role) => setForm({ ...form, role })} title="Role" />
            </Field>

            <SwitchRow
              label="Active"
              description="Inactive users cannot sign in"
              value={form.isActive}
              onValueChange={(isActive) => setForm({ ...form, isActive })}
            />

            {!form.id && (
              <SwitchRow
                label="Send welcome email"
                description="Emails the temporary password to the user"
                value={form.sendWelcomeEmail}
                onValueChange={(sendWelcomeEmail) => setForm({ ...form, sendWelcomeEmail })}
              />
            )}
          </ScrollView>
        )}
      </Sheet>

      {/* ------------------------------------------------ temporary password */}
      <Sheet
        open={temporaryPassword !== null}
        onClose={() => setTemporaryPassword(null)}
        title="Temporary password"
        subtitle="Shown once — copy it now"
        footer={<Button label="Done" fullWidth style={{ flex: 1 }} onPress={() => setTemporaryPassword(null)} />}
      >
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
          <Callout
            tone="warning"
            title="This will not be shown again"
            description="The user must change it the first time they sign in."
          />
          <View
            style={{
              padding: theme.spacing.lg,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceAlt,
              alignItems: 'center',
            }}
          >
            <Text variant="title" numeric selectable>
              {temporaryPassword}
            </Text>
          </View>
          <Button
            label="Copy password"
            icon="copy-outline"
            variant="outline"
            fullWidth
            onPress={async () => {
              if (temporaryPassword) {
                await Clipboard.setStringAsync(temporaryPassword);
                toast.success('Copied to clipboard');
              }
            }}
          />
        </View>
      </Sheet>

      <ConfirmSheet
        open={resetFor !== null}
        onClose={() => setResetFor(null)}
        onConfirm={doReset}
        loading={resetPassword.isPending}
        tone="primary"
        confirmLabel="Reset password"
        title="Reset this password?"
        description={
          resetFor
            ? `${resetFor.name} will be signed out everywhere and must set a new password on their next sign-in.`
            : undefined
        }
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={async () => {
          if (!deleteFor) return;
          await remove.mutateAsync(deleteFor._id);
          setDeleteFor(null);
        }}
        loading={remove.isPending}
        title="Delete this user?"
        description={deleteFor ? `${deleteFor.name} will lose access immediately.` : undefined}
      />
    </Screen>
  );
}
