import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useDeleteLot, useLots, type Lot } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber, refId } from '@/lib/format';

type Filter = 'open' | 'complete' | 'all';

const preLotNo = (lot: Lot) => (lot.prelot_id as unknown as { prelot_no?: number } | null)?.prelot_no;

/**
 * Lot input — runs of pre-lot stock through a machine. Open lots come first:
 * they are the ones still taking inputs and waiting for their output.
 */
export default function LotListScreen() {
  const router = useRouter();
  const lookups = useMasterLookups();
  const list = useLots();
  const remove = useDeleteLot();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('lot');

  const [filter, setFilter] = useState<Filter>('open');
  const [menuFor, setMenuFor] = useState<Lot | null>(null);
  const [deleteFor, setDeleteFor] = useState<Lot | null>(null);

  const lots = useMemo(() => list.data ?? [], [list.data]);
  const openCount = lots.filter((lot) => !lot.is_complete).length;
  const filtered = useMemo(
    () => (filter === 'all' ? lots : lots.filter((lot) => (filter === 'complete' ? lot.is_complete : !lot.is_complete))),
    [lots, filter]
  );

  const search = useCallback(
    (lot: Lot) => [
      lot.lot_no,
      lot.remarks,
      preLotNo(lot),
      lookups.commodityName(refId(lot.commodity_id)),
      lookups.machineName(refId(lot.machine_id)),
    ],
    [lookups]
  );

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success(`Lot ${deleteFor.lot_no} deleted`, { description: 'Its inputs are back in the pre-lot.' });
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete the lot', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header title="Lot Input" subtitle={openCount > 0 ? `${openCount} lot${openCount === 1 ? '' : 's'} in progress` : 'No lots running'} />

      <ListBody<Lot, Filter>
        items={filtered}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={search}
        searchPlaceholder="Search lot, pre-lot, machine…"
        filters={[
          { value: 'open', label: 'In progress', count: openCount },
          { value: 'complete', label: 'Complete', count: lots.length - openCount },
          { value: 'all', label: 'All', count: lots.length },
        ]}
        filterValue={filter}
        onFilterChange={setFilter}
        emptyTitle={filter === 'complete' ? 'No completed lots' : 'No lots running'}
        emptyDescription="A lot runs a pre-lot's reserved stock through a machine."
        emptyActionLabel={canCreate && filter !== 'complete' ? 'New lot' : undefined}
        onEmptyAction={canCreate ? () => router.push('/operations/lot/form' as never) : undefined}
        renderItem={(lot) => (
          <RecordCard
            title={`Lot ${lot.lot_no}`}
            subtitle={[
              lookups.commodityName(refId(lot.commodity_id)),
              lookups.machineName(refId(lot.machine_id)),
              preLotNo(lot) !== undefined ? `Pre-lot ${preLotNo(lot)}` : null,
              formatDate(lot.date),
            ]
              .filter((part) => part && part !== '—')
              .join(' · ')}
            icon="enter-outline"
            badge={lot.is_complete ? { label: 'Complete', tone: 'success' } : { label: 'In progress', tone: 'warning' }}
            accent={lot.is_complete ? undefined : 'warning'}
            fields={[
              { label: 'Input', value: `${formatNumber(lot.total_input_bags)} bags`, emphasis: true },
              { label: 'Input weight', value: `${formatNumber(lot.total_input_weight, 2)} kg` },
              { label: 'Output', value: `${formatNumber(lot.total_output_bags)} bags` },
              { label: 'Output weight', value: `${formatNumber(lot.total_output_weight, 2)} kg` },
            ]}
            onPress={() => router.push(`/operations/lot/${lot._id}` as never)}
            onMenu={() => setMenuFor(lot)}
          />
        )}
      />

      {canCreate && <Fab label="New lot" onPress={() => router.push('/operations/lot/form' as never)} />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `Lot ${menuFor.lot_no}` : undefined}
        actions={[
          {
            label: 'View details',
            icon: 'eye-outline',
            onPress: () => menuFor && router.push(`/operations/lot/${menuFor._id}` as never),
          },
          {
            label: 'Edit inputs',
            icon: 'create-outline',
            disabled: !canUpdate || Boolean(menuFor?.is_complete),
            disabledReason: menuFor?.is_complete ? 'Complete — inputs are locked' : 'Your role cannot edit lots',
            onPress: () => menuFor && router.push(`/operations/lot/form?id=${menuFor._id}` as never),
          },
          {
            label: menuFor?.is_complete ? 'View output' : 'Record output',
            icon: 'exit-outline',
            onPress: () => menuFor && router.push(`/operations/lot-output/${menuFor._id}` as never),
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete || Boolean(menuFor?.is_complete),
            disabledReason: menuFor?.is_complete ? 'A completed lot cannot be deleted' : 'Your role cannot delete lots',
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title={deleteFor ? `Delete lot ${deleteFor.lot_no}?` : 'Delete lot?'}
        description={
          deleteFor
            ? `Its ${formatNumber(deleteFor.total_input_bags)} input bags go back to the pre-lot, its output stock is removed and its machine is freed.`
            : undefined
        }
      />
    </Screen>
  );
}
