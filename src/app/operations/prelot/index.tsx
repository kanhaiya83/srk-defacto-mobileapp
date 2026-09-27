import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useDeletePreLot, useLots, usePreLots, type PreLot } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { lotsOf, preLotTotals } from '@/features/operations/prelot';
import { useModulePermissions, usePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate, formatNumber, refId } from '@/lib/format';

type Filter = 'all' | 'open' | 'used';

/**
 * Pre-lots — stock set aside for processing.
 *
 * What an operator looks for is how much of each basket is still free for a
 * lot, so that is the headline number and the filter.
 */
export default function PreLotListScreen() {
  const router = useRouter();
  const lookups = useMasterLookups();
  const { can } = usePermissions();
  const list = usePreLots();
  const lots = useLots();
  const remove = useDeletePreLot();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('prelot');

  const [filter, setFilter] = useState<Filter>('all');
  const [menuFor, setMenuFor] = useState<PreLot | null>(null);
  const [deleteFor, setDeleteFor] = useState<PreLot | null>(null);

  const rows = useMemo(
    () =>
      (list.data ?? []).map((preLot) => ({
        preLot,
        totals: preLotTotals(preLot),
        lots: lotsOf(preLot, lots.data ?? []).length,
      })),
    [list.data, lots.data]
  );
  type Row = (typeof rows)[number];

  const counts = useMemo(() => {
    const open = rows.filter((row) => row.totals.remainingBags > 0).length;
    return { open, used: rows.length - open };
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((row) => (filter === 'open' ? row.totals.remainingBags > 0 : row.totals.remainingBags <= 0));
  }, [rows, filter]);

  const search = useCallback(
    ({ preLot, totals }: Row) => [
      preLot.prelot_no,
      preLot.remarks,
      lookups.commodityName(refId(preLot.commodity_id)),
      preLot.company_group?.group_name,
      ...totals.entries.map((entry) => entry.entryNo),
    ],
    [lookups]
  );

  const menuRow = menuFor ? rows.find((row) => row.preLot._id === menuFor._id) : undefined;

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success(`Pre-lot ${deleteFor.prelot_no} deleted`, { description: 'Its stock is free again.' });
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete the pre-lot', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header title="Pre-Lot" subtitle={`${rows.length} pre-lot${rows.length === 1 ? '' : 's'} · ${counts.open} with stock free`} />

      <ListBody<Row, Filter>
        items={filtered}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => {
          void list.refetch();
          void lots.refetch();
        }}
        refreshing={list.isRefetching}
        keyExtractor={({ preLot }) => preLot._id}
        searchFields={search}
        searchPlaceholder="Search pre-lot, commodity, inward…"
        filters={[
          { value: 'all', label: 'All', count: rows.length },
          { value: 'open', label: 'Stock free', count: counts.open },
          { value: 'used', label: 'Used up', count: counts.used },
        ]}
        filterValue={filter}
        onFilterChange={setFilter}
        emptyTitle={filter === 'all' ? 'No pre-lots yet' : 'Nothing here'}
        emptyDescription="Reserve stock here before creating the lot that will process it."
        emptyActionLabel={canCreate && filter === 'all' ? 'New pre-lot' : undefined}
        onEmptyAction={canCreate ? () => router.push('/operations/prelot/form' as never) : undefined}
        renderItem={({ preLot, totals, lots: lotCount }) => {
          const usedUp = totals.remainingBags <= 0;
          return (
            <RecordCard
              title={`Pre-lot ${preLot.prelot_no}`}
              subtitle={[
                lookups.commodityName(refId(preLot.commodity_id)),
                preLot.company_group?.group_name ?? lookups.companyGroupName(refId(preLot.company_group_id)),
                formatDate(preLot.date),
              ]
                .filter((part) => part && part !== '—')
                .join(' · ')}
              icon="albums-outline"
              badge={
                usedUp
                  ? { label: 'Used up', tone: 'neutral' }
                  : lotCount > 0
                    ? { label: `${lotCount} lot${lotCount === 1 ? '' : 's'}`, tone: 'info' }
                    : { label: 'Reserved', tone: 'warning' }
              }
              fields={[
                { label: 'Free for lots', value: `${formatNumber(totals.remainingBags)} bags`, emphasis: true },
                { label: 'Reserved', value: `${formatNumber(totals.bags)} bags` },
                { label: 'Weight', value: `${formatNumber(totals.weight, 2)} kg` },
                { label: 'Avg rate', value: totals.ratePerKg ? `${formatCurrency(totals.ratePerKg)}/kg` : null },
              ]}
              onPress={() => router.push(`/operations/prelot/${preLot._id}` as never)}
              onMenu={() => setMenuFor(preLot)}
            />
          );
        }}
      />

      {canCreate && <Fab label="Pre-lot" onPress={() => router.push('/operations/prelot/form' as never)} />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `Pre-lot ${menuFor.prelot_no}` : undefined}
        actions={[
          {
            label: 'View details',
            icon: 'eye-outline',
            onPress: () => menuFor && router.push(`/operations/prelot/${menuFor._id}` as never),
          },
          {
            label: 'Create lot from it',
            icon: 'cube-outline',
            disabled: !can('lot:create') || !menuRow || menuRow.totals.remainingBags <= 0,
            disabledReason: !can('lot:create') ? 'Your role cannot create lots' : 'No stock left for a lot',
            onPress: () => menuFor && router.push(`/operations/lot?prelot=${menuFor._id}` as never),
          },
          {
            label: 'Edit',
            icon: 'create-outline',
            disabled: !canUpdate,
            disabledReason: 'Your role cannot edit pre-lots',
            onPress: () => menuFor && router.push(`/operations/prelot/form?id=${menuFor._id}` as never),
          },
          {
            label: 'Delete and free the stock',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete || (menuRow?.lots ?? 0) > 0,
            disabledReason: !canDelete ? 'Your role cannot delete pre-lots' : 'Lots use this pre-lot — delete them first',
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title={deleteFor ? `Delete pre-lot ${deleteFor.prelot_no}?` : 'Delete pre-lot?'}
        description={
          deleteFor
            ? `${formatNumber(preLotTotals(deleteFor).bags)} reserved bags go back to available stock.`
            : undefined
        }
      />
    </Screen>
  );
}
