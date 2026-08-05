import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  useDeleteGenerateGrnEntry,
  useGenerateGrnEntries,
  useInwardWeighBridgeEntries,
  type GenerateGrnEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber } from '@/lib/format';

type Filter = 'all' | 'short' | 'complete';

export const bagsUsedIn = (grn: GenerateGrnEntry) =>
  grn.entries?.reduce((sum, entry) => sum + (entry.bags_used || 0), 0) ?? 0;

/**
 * GRN list.
 *
 * The number that matters here is "bags still unaccounted for" — a GRN that
 * does not add up to its weigh-in is the thing someone has to go and fix, so it
 * is filterable and flagged on the row.
 */
export default function GrnListScreen() {
  const router = useRouter();
  const list = useGenerateGrnEntries();
  const { data: wbis } = useInwardWeighBridgeEntries();
  const remove = useDeleteGenerateGrnEntry();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('grn');

  const [filter, setFilter] = useState<Filter>('all');
  const [menuFor, setMenuFor] = useState<GenerateGrnEntry | null>(null);
  const [deleteFor, setDeleteFor] = useState<GenerateGrnEntry | null>(null);

  const entries = list.data ?? [];

  const counts = useMemo(() => {
    const short = entries.filter((grn) => bagsUsedIn(grn) < (grn.total_bags || 0)).length;
    return { short, complete: entries.length - short };
  }, [entries]);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    const isShort = (grn: GenerateGrnEntry) => bagsUsedIn(grn) < (grn.total_bags || 0);
    return entries.filter((grn) => (filter === 'short' ? isShort(grn) : !isShort(grn)));
  }, [entries, filter]);

  const search = useCallback((item: GenerateGrnEntry) => [item.grn_id, item.wbi_id], []);

  const vehicleFor = (grn: GenerateGrnEntry) =>
    (wbis ?? []).find((wbi) => wbi.wbi_id === grn.wbi_id)?.vehicle_no ?? '';

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success(`GRN ${deleteFor.grn_id} deleted`);
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete the GRN', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header title="GRN Entries" subtitle="Goods receipt notes raised against weigh-ins" />

      <ListBody<GenerateGrnEntry, Filter>
        items={filtered}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={search}
        searchPlaceholder="Search GRN or WBI…"
        filters={[
          { value: 'all', label: 'All', count: entries.length },
          { value: 'short', label: 'Bags short', count: counts.short },
          { value: 'complete', label: 'Complete', count: counts.complete },
        ]}
        filterValue={filter}
        onFilterChange={setFilter}
        emptyTitle="No GRN entries yet"
        emptyDescription="Raise a GRN against a weighed-in vehicle to book its goods."
        emptyActionLabel={canCreate ? 'New GRN' : undefined}
        onEmptyAction={canCreate ? () => router.push('/operations/grn/form') : undefined}
        renderItem={(item) => {
          const used = bagsUsedIn(item);
          const total = item.total_bags || 0;
          const short = total - used;
          return (
            <RecordCard
              title={`GRN ${item.grn_id}`}
              subtitle={`WBI ${item.wbi_id}${vehicleFor(item) ? ` · ${vehicleFor(item)}` : ''} · ${formatDate(item.date)}`}
              badge={
                short > 0
                  ? { label: `${formatNumber(short)} short`, tone: 'warning' }
                  : { label: 'Complete', tone: 'success' }
              }
              accent={short > 0 ? 'warning' : undefined}
              fields={[
                { label: 'Total bags', value: formatNumber(total) },
                { label: 'Bags used', value: formatNumber(used), emphasis: true },
                { label: 'Line items', value: item.entries?.length ?? 0 },
                { label: 'Status', value: item.is_mutable ? 'Editable' : 'In inward entry' },
              ]}
              onPress={() => router.push(`/operations/grn/${item._id}`)}
              onMenu={() => setMenuFor(item)}
            />
          );
        }}
      />

      {canCreate && <Fab onPress={() => router.push('/operations/grn/form')} label="New GRN" />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `GRN ${menuFor.grn_id}` : undefined}
        actions={[
          {
            label: 'View details',
            icon: 'eye-outline',
            onPress: () => menuFor && router.push(`/operations/grn/${menuFor._id}`),
          },
          {
            label: 'Edit',
            icon: 'create-outline',
            disabled: !canUpdate || !menuFor?.is_mutable,
            disabledReason: 'Locked — used in an inward entry',
            onPress: () => menuFor && router.push(`/operations/grn/form?id=${menuFor._id}`),
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete || !menuFor?.is_deletable,
            disabledReason: 'Locked — used in an inward entry',
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="Delete this GRN?"
        description={deleteFor ? `GRN ${deleteFor.grn_id} and its ${deleteFor.entries?.length ?? 0} line items will be removed.` : undefined}
      />
    </Screen>
  );
}
