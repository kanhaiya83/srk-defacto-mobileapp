import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  useDeleteInwardWeighBridgeEntry,
  useInwardWeighBridgeEntries,
  type InwardWeighBridgeEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber } from '@/lib/format';

/**
 * WBI Loaded — vehicles weighed in at the gate.
 *
 * A WBI locks once a GRN is raised against it (`is_mutable`/`is_deletable`),
 * so the row actions explain *why* they are unavailable rather than silently
 * disappearing.
 */
export default function WbiInitialScreen() {
  const router = useRouter();
  const lookups = useMasterLookups();
  const list = useInwardWeighBridgeEntries();
  const remove = useDeleteInwardWeighBridgeEntry();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('wbi');

  const [menuFor, setMenuFor] = useState<InwardWeighBridgeEntry | null>(null);
  const [deleteFor, setDeleteFor] = useState<InwardWeighBridgeEntry | null>(null);

  const search = useCallback(
    (item: InwardWeighBridgeEntry) => [item.wbi_id, item.vehicle_no, item.driver_name, item.slip_number, item.mobile_no],
    []
  );

  // A WBI linked to a GRN can still be edited while the empty weight is
  // outstanding — that is the whole point of the WBI Empty screen.
  const canEditEntry = (item: InwardWeighBridgeEntry) => item.is_mutable || !(item.empty_weight > 0);

  const handleDelete = async () => {
    if (!deleteFor) return;
    if (!deleteFor.is_deletable) {
      toast.error('This WBI entry is used in a GRN and cannot be deleted');
      setDeleteFor(null);
      return;
    }
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success('Entry deleted');
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete entry', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header
        title="WBI Loaded"
        subtitle={list.data ? `${list.data.length} weigh-ins` : 'Loaded vehicles weighed in at the gate'}
      />

      <ListBody<InwardWeighBridgeEntry>
        items={list.data ?? []}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={search}
        searchPlaceholder="Search WBI, vehicle, driver…"
        emptyTitle="No weigh bridge entries yet"
        emptyDescription="Weigh in the first loaded vehicle to get started."
        emptyActionLabel={canCreate ? 'New WBI entry' : undefined}
        onEmptyAction={canCreate ? () => router.push('/operations/wbi/form?mode=initial') : undefined}
        renderItem={(item) => {
          const weighed = item.empty_weight > 0;
          return (
            <RecordCard
              title={`WBI ${item.wbi_id}`}
              subtitle={`${item.vehicle_no || 'No vehicle'} · ${formatDate(item.date)}`}
              badge={{ label: weighed ? 'Closed' : 'Open', tone: weighed ? 'success' : 'warning' }}
              accent={weighed ? undefined : 'warning'}
              fields={[
                { label: 'Driver', value: item.driver_name },
                { label: 'Source', value: lookups.sourceLocationName(item.source_location_id) },
                { label: 'Bags', value: formatNumber(item.total_bags), emphasis: true },
                { label: 'Loaded', value: `${formatNumber(item.weight_fully_loaded)} kg` },
              ]}
              onPress={() => router.push(`/operations/wbi/${item._id}`)}
              onMenu={() => setMenuFor(item)}
            />
          );
        }}
      />

      {canCreate && <Fab onPress={() => router.push('/operations/wbi/form?mode=initial')} label="Weigh in" />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `WBI ${menuFor.wbi_id}` : undefined}
        actions={[
          {
            label: 'View details',
            icon: 'eye-outline',
            onPress: () => menuFor && router.push(`/operations/wbi/${menuFor._id}`),
          },
          {
            label: 'Edit',
            icon: 'create-outline',
            disabled: !canUpdate || !(menuFor && canEditEntry(menuFor)),
            disabledReason: 'Locked — used in a GRN and the empty weight is recorded',
            onPress: () => menuFor && router.push(`/operations/wbi/form?mode=initial&id=${menuFor._id}`),
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete || !menuFor?.is_deletable,
            disabledReason: 'Locked — used in a GRN',
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="Delete this weigh-in?"
        description={deleteFor ? `WBI ${deleteFor.wbi_id} for ${deleteFor.vehicle_no || 'this vehicle'} will be removed.` : undefined}
      />
    </Screen>
  );
}
