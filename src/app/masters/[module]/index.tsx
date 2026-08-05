import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { EmptyState } from '@/components/ui/feedback';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { getMasterConfig } from '@/features/masters/registry';
import { useDeleteResource, useResourceList, type MasterRecord } from '@/features/masters/use-resource';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDateTime } from '@/lib/format';

/**
 * One screen for all fifteen masters, driven by the registry.
 *
 * Row actions live behind an overflow menu rather than swipe gestures: delete
 * is irreversible here, and a gesture that can be triggered while scrolling is
 * the wrong affordance for it.
 */
export default function MasterListScreen() {
  const router = useRouter();
  const { module } = useLocalSearchParams<{ module: string }>();
  const config = getMasterConfig(module);

  const { canCreate, canUpdate, canDelete } = useModulePermissions(module ?? '');

  const list = useResourceList<MasterRecord>(config?.resource ?? '', Boolean(config));
  const remove = useDeleteResource(config?.resource ?? '');

  const [menuFor, setMenuFor] = useState<MasterRecord | null>(null);
  const [deleteFor, setDeleteFor] = useState<MasterRecord | null>(null);

  const search = useCallback(
    (item: MasterRecord) => (config ? config.search(item) : []),
    [config]
  );

  if (!config) {
    return (
      <Screen>
        <Header title="Not found" />
        <EmptyState icon="help-circle-outline" title="Unknown master" description={`No master is registered for “${module}”.`} />
      </Screen>
    );
  }

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success(`${config.singular} deleted`);
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete', { description: getErrorMessage(error) });
    }
  };

  const openForm = (id: string) => router.push(`/masters/${config.key}/${id}` as never);

  return (
    <Screen>
      <Header
        title={config.title}
        subtitle={list.data ? `${list.data.length} records` : config.description}
      />

      <ListBody<MasterRecord>
        items={list.data ?? []}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={search}
        searchPlaceholder={`Search ${config.title.toLowerCase()}…`}
        emptyTitle={`No ${config.title.toLowerCase()} yet`}
        emptyDescription={config.description}
        emptyActionLabel={canCreate && !config.editOnly ? `Add ${config.singular}` : undefined}
        onEmptyAction={canCreate && !config.editOnly ? () => openForm('new') : undefined}
        renderItem={(item) => (
          <RecordCard
            title={config.primary(item)}
            subtitle={config.secondary?.(item)}
            icon={config.icon}
            fields={config.cardFields?.(item)}
            onPress={canUpdate ? () => openForm(item._id) : undefined}
            onMenu={canUpdate || canDelete ? () => setMenuFor(item) : undefined}
          />
        )}
      />

      {canCreate && !config.editOnly && <Fab onPress={() => openForm('new')} label={config.singular} />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? config.primary(menuFor) : undefined}
        actions={[
          {
            label: 'Edit',
            icon: 'create-outline',
            disabled: !canUpdate,
            disabledReason: 'Your role cannot edit this',
            onPress: () => menuFor && openForm(menuFor._id),
          },
          ...(config.editOnly
            ? []
            : [
                {
                  label: 'Delete',
                  icon: 'trash-outline' as const,
                  tone: 'danger' as const,
                  disabled: !canDelete,
                  disabledReason: 'Your role cannot delete this',
                  onPress: () => menuFor && setDeleteFor(menuFor),
                },
              ]),
          {
            label: menuFor?.updatedAt ? `Updated ${formatDateTime(menuFor.updatedAt)}` : 'Never updated',
            icon: 'time-outline',
            disabled: true,
            onPress: () => {},
          },
        ]}
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title={`Delete this ${config.singular.toLowerCase()}?`}
        description={
          deleteFor
            ? `“${config.primary(deleteFor)}” will be removed. Records already referencing it are unaffected.`
            : undefined
        }
      />
    </Screen>
  );
}
