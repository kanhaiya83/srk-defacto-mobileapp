import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody, type ListFilter } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { EmptyState } from '@/components/ui/feedback';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { MasterDetailsSheet } from '@/features/masters/master-details';
import { useReferenceNames } from '@/features/masters/reference';
import { getMasterConfig } from '@/features/masters/registry';
import { useDeleteResource, useResourceList, type MasterRecord } from '@/features/masters/use-resource';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDateTime, refId } from '@/lib/format';

const ALL = 'all';

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
  const names = useReferenceNames(config?.uses);

  const [menuFor, setMenuFor] = useState<MasterRecord | null>(null);
  const [deleteFor, setDeleteFor] = useState<MasterRecord | null>(null);
  const [detailsFor, setDetailsFor] = useState<MasterRecord | null>(null);
  const [group, setGroup] = useState<string>(ALL);

  const search = useCallback(
    (item: MasterRecord) => (config ? config.search(item, names) : []),
    [config, names]
  );

  // Grades and item rates are grouped by commodity on the web; here each group is a chip.
  const groupBy = config?.groupBy;
  const groups = useMemo<ListFilter<string>[]>(() => {
    if (!groupBy) return [];
    const counts = new Map<string, number>();
    for (const item of list.data ?? []) {
      const id = refId(item[groupBy.key]);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const chips = Array.from(counts, ([id, count]) => ({
      value: id,
      label: names(groupBy.source, id) ?? 'Unknown',
      count,
    })).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    return [{ value: ALL, label: 'All', count: list.data?.length ?? 0 }, ...chips];
  }, [groupBy, list.data, names]);

  const activeGroup = groups.some((chip) => chip.value === group) ? group : ALL;
  const items = useMemo(
    () =>
      groupBy && activeGroup !== ALL
        ? (list.data ?? []).filter((item) => refId(item[groupBy.key]) === activeGroup)
        : (list.data ?? []),
    [groupBy, activeGroup, list.data]
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
      // The server refuses to delete a record still in use and names where it is used.
      toast.error('Could not delete', { description: getErrorMessage(error) });
      setDeleteFor(null);
    }
  };

  const openForm = (id: string) => router.push(`/masters/${config.key}/${id}` as never);

  return (
    <Screen>
      <Header
        title={config.title}
        subtitle={list.data ? `${list.data.length} record${list.data.length === 1 ? '' : 's'}` : config.description}
      />

      <ListBody<MasterRecord>
        items={items}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={search}
        searchPlaceholder={`Search ${config.title.toLowerCase()}…`}
        filters={groups.length > 2 ? groups : undefined}
        filterValue={activeGroup}
        onFilterChange={setGroup}
        emptyTitle={`No ${config.title.toLowerCase()} yet`}
        emptyDescription={config.description}
        emptyActionLabel={canCreate && !config.editOnly ? `Add ${config.singular}` : undefined}
        onEmptyAction={canCreate && !config.editOnly ? () => openForm('new') : undefined}
        renderItem={(item) => (
          <RecordCard
            title={config.primary(item, names)}
            subtitle={config.secondary?.(item, names)}
            icon={config.icon}
            badge={config.badge?.(item)}
            fields={config.cardFields?.(item, names)}
            onPress={() => (canUpdate ? openForm(item._id) : setDetailsFor(item))}
            onMenu={() => setMenuFor(item)}
          />
        )}
      />

      {canCreate && !config.editOnly && <Fab onPress={() => openForm('new')} label={config.singular} />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? config.primary(menuFor, names) : undefined}
        actions={[
          {
            label: 'View details',
            icon: 'eye-outline',
            onPress: () => setDetailsFor(menuFor),
          },
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

      <MasterDetailsSheet
        config={config}
        record={detailsFor}
        names={names}
        onClose={() => setDetailsFor(null)}
        onEdit={
          canUpdate && detailsFor
            ? () => {
                const id = detailsFor._id;
                setDetailsFor(null);
                openForm(id);
              }
            : undefined
        }
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title={`Delete this ${config.singular.toLowerCase()}?`}
        description={
          deleteFor
            ? `“${config.primary(deleteFor, names)}” will be permanently removed. If stock, bills or other records still use it, the delete is refused.`
            : undefined
        }
      />
    </Screen>
  );
}
