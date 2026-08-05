import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  useCreateRole,
  useDeleteRole,
  usePermissionCatalogue,
  useRoles,
  useUpdateRole,
} from '@/api/admin-queries';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Callout, SwitchRow } from '@/components/ui/misc';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet, Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useModulePermissions } from '@/hooks/use-permissions';
import type { Action, Role } from '@/types/auth';
import { useTheme } from '@/theme';

const ACTIONS: Action[] = ['read', 'create', 'update', 'delete'];

interface RoleForm {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
  permissions: Set<string>;
}

/**
 * Roles and permissions.
 *
 * The matrix is grouped by module category and collapsed by default — with
 * ~40 modules × 4 actions, an always-open grid is unusable on a phone. Each
 * module row can be granted wholesale, which is how permissions are actually
 * assigned in practice.
 */
export default function RolesScreen() {
  const theme = useTheme();
  const roles = useRoles();
  const catalogue = usePermissionCatalogue();
  const create = useCreateRole();
  const update = useUpdateRole();
  const remove = useDeleteRole();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('role');

  const [form, setForm] = useState<RoleForm | null>(null);
  const [menuFor, setMenuFor] = useState<Role | null>(null);
  const [deleteFor, setDeleteFor] = useState<Role | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>('master');

  const grouped = useMemo(() => {
    const byCategory = new Map<string, typeof catalogue.data>();
    for (const module of catalogue.data ?? []) {
      const list = byCategory.get(module.category) ?? [];
      byCategory.set(module.category, [...(list ?? []), module]);
    }
    return [...byCategory.entries()];
  }, [catalogue.data]);

  const openCreate = () =>
    setForm({ name: '', description: '', isActive: true, permissions: new Set() });

  const openEdit = (role: Role) =>
    setForm({
      id: role._id,
      name: role.name,
      description: role.description ?? '',
      isActive: role.isActive,
      permissions: new Set(role.permissions),
    });

  const toggle = (permission: string) =>
    setForm((current) => {
      if (!current) return current;
      const next = new Set(current.permissions);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return { ...current, permissions: next };
    });

  const toggleModule = (moduleKey: string, actions: Action[], grantAll: boolean) =>
    setForm((current) => {
      if (!current) return current;
      const next = new Set(current.permissions);
      actions.forEach((action) => {
        const permission = `${moduleKey}:${action}`;
        if (grantAll) next.add(permission);
        else next.delete(permission);
      });
      return { ...current, permissions: next };
    });

  const submit = async () => {
    if (!form) return;
    if (!form.name.trim()) return toast.error('Role name is required');
    if (form.permissions.size === 0) return toast.error('Grant at least one permission');

    const payload = {
      name: form.name.trim(),
      description: form.description || undefined,
      permissions: [...form.permissions],
      isActive: form.isActive,
    };

    try {
      if (form.id) await update.mutateAsync({ id: form.id, payload });
      else await create.mutateAsync(payload);
      setForm(null);
    } catch {
      // Surfaced by the mutation's onError.
    }
  };

  return (
    <Screen>
      <Header title="Roles" subtitle={`${roles.data?.length ?? 0} roles`} />

      <ListBody<Role>
        items={roles.data ?? []}
        isLoading={roles.isLoading}
        isError={roles.isError}
        onRefresh={() => void roles.refetch()}
        refreshing={roles.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={(item) => [item.name, item.description]}
        searchPlaceholder="Search roles…"
        emptyTitle="No roles yet"
        emptyDescription="A role bundles the permissions a group of people needs."
        emptyActionLabel={canCreate ? 'Add role' : undefined}
        onEmptyAction={canCreate ? openCreate : undefined}
        renderItem={(item) => (
          <RecordCard
            title={item.name}
            subtitle={item.description || `${item.permissions.length} permissions`}
            icon="shield-checkmark-outline"
            badge={
              item.isSystem
                ? { label: 'System', tone: 'info' }
                : item.isActive
                  ? { label: 'Active', tone: 'success' }
                  : { label: 'Inactive', tone: 'neutral' }
            }
            fields={[
              { label: 'Permissions', value: item.permissions.length, emphasis: true },
              { label: 'Users', value: item.userCount ?? 0 },
            ]}
            onPress={canUpdate ? () => openEdit(item) : undefined}
            onMenu={() => setMenuFor(item)}
          />
        )}
      />

      {canCreate && <Fab label="Add role" onPress={openCreate} />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
        actions={[
          {
            label: 'Edit permissions',
            icon: 'create-outline',
            disabled: !canUpdate,
            onPress: () => menuFor && openEdit(menuFor),
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete || Boolean(menuFor?.isSystem),
            disabledReason: menuFor?.isSystem ? 'System roles cannot be deleted' : undefined,
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <Sheet
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit role' : 'New role'}
        subtitle={form ? `${form.permissions.size} permissions granted` : undefined}
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setForm(null)} />
            <Button
              label={form?.id ? 'Save role' : 'Create role'}
              style={{ flex: 2 }}
              loading={create.isPending || update.isPending}
              onPress={submit}
            />
          </>
        }
      >
        {form && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            {form.id && (
              <Callout
                tone="warning"
                title="Changing a role signs its users out"
                description="Affected users must sign in again so the new permissions take effect."
              />
            )}

            <Field label="Role name" required>
              <Input value={form.name} onChangeText={(name) => setForm({ ...form, name })} autoCapitalize="words" />
            </Field>

            <Field label="Description">
              <Input
                value={form.description}
                onChangeText={(description) => setForm({ ...form, description })}
                placeholder="Who is this role for?"
              />
            </Field>

            <SwitchRow
              label="Active"
              description="Users of an inactive role cannot sign in"
              value={form.isActive}
              onValueChange={(isActive) => setForm({ ...form, isActive })}
            />

            <Text variant="label" tone="muted">
              PERMISSIONS
            </Text>

            {grouped.map(([category, modules]) => {
              const isOpen = openCategory === category;
              const granted = (modules ?? []).reduce(
                (sum, module) =>
                  sum + module.actions.filter((action) => form.permissions.has(`${module.key}:${action}`)).length,
                0
              );

              return (
                <View key={category} style={{ gap: theme.spacing.sm }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    onPress={() => setOpenCategory(isOpen ? null : category)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      padding: theme.spacing.md,
                      borderRadius: theme.radius.md,
                      backgroundColor: pressed ? theme.colors.surfaceActive : theme.colors.surfaceAlt,
                    })}
                  >
                    <Text variant="bodyStrong" style={{ flex: 1, textTransform: 'capitalize' }}>
                      {category}
                    </Text>
                    {granted > 0 && <Badge label={`${granted}`} tone="primary" />}
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={17} color={theme.colors.faintText} />
                  </Pressable>

                  {isOpen &&
                    (modules ?? []).map((module) => {
                      const all = module.actions.every((action) => form.permissions.has(`${module.key}:${action}`));
                      return (
                        <View key={module.key} style={{ gap: theme.spacing.sm, paddingLeft: theme.spacing.sm }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                            <Text variant="label" style={{ flex: 1 }}>
                              {module.label}
                            </Text>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`${all ? 'Revoke' : 'Grant'} all on ${module.label}`}
                              onPress={() => toggleModule(module.key, module.actions, !all)}
                              hitSlop={6}
                            >
                              <Text variant="caption" tone="primary">
                                {all ? 'Clear' : 'All'}
                              </Text>
                            </Pressable>
                          </View>

                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                            {ACTIONS.filter((action) => module.actions.includes(action)).map((action) => {
                              const permission = `${module.key}:${action}`;
                              const active = form.permissions.has(permission);
                              return (
                                <Pressable
                                  key={permission}
                                  accessibilityRole="checkbox"
                                  accessibilityState={{ checked: active }}
                                  accessibilityLabel={`${action} on ${module.label}`}
                                  onPress={() => toggle(permission)}
                                  style={{
                                    paddingHorizontal: theme.spacing.md,
                                    paddingVertical: 6,
                                    borderRadius: theme.radius.pill,
                                    borderWidth: 1,
                                    borderColor: active ? theme.colors.primary : theme.colors.border,
                                    backgroundColor: active ? theme.colors.primarySoft : 'transparent',
                                  }}
                                >
                                  <Text variant="caption" tone={active ? 'primary' : 'muted'}>
                                    {action}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                </View>
              );
            })}
          </ScrollView>
        )}
      </Sheet>

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={async () => {
          if (!deleteFor) return;
          await remove.mutateAsync(deleteFor._id);
          setDeleteFor(null);
        }}
        loading={remove.isPending}
        title="Delete this role?"
        description={
          deleteFor
            ? `${deleteFor.name} will be removed. Users still assigned to it will lose access.`
            : undefined
        }
      />
    </Screen>
  );
}
