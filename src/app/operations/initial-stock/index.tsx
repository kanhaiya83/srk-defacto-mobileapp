import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { useDeleteInitialStock, useInitialStocks, type InitialStockEntry } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { initialStockUsed } from '@/features/operations/stock';
import { useModulePermissions, usePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate, formatNumber, refId } from '@/lib/format';

/**
 * Initial stock — opening balances entered when the system went live. Each
 * becomes a stock entry; once any of it is used it can only grow or shrink
 * down to what was used, and can no longer be deleted.
 */
export default function InitialStockListScreen() {
  const router = useRouter();
  const lookups = useMasterLookups();
  const { can } = usePermissions();
  const list = useInitialStocks();
  const remove = useDeleteInitialStock();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('initial-stock');

  const [menuFor, setMenuFor] = useState<InitialStockEntry | null>(null);
  const [deleteFor, setDeleteFor] = useState<InitialStockEntry | null>(null);

  const entries = list.data ?? [];
  const totalBags = entries.reduce((sum, entry) => sum + (entry.bags || 0), 0);

  const holder = useCallback(
    (entry: InitialStockEntry) =>
      entry.company_id
        ? (entry.company_id?.company_name ?? lookups.companyName(refId(entry.company_id)))
        : (entry.company_group_id?.group_name ?? lookups.companyGroupName(refId(entry.company_group_id))),
    [lookups]
  );

  const search = useCallback(
    (entry: InitialStockEntry) => [
      `IS-${entry.stock_no}`,
      lookups.commodityName(refId(entry.commodity_id)),
      lookups.gradeName(refId(entry.grade_id)),
      lookups.locationName(refId(entry.location_id)),
      holder(entry),
      entry.remarks,
    ],
    [lookups, holder]
  );

  const menuUsed = menuFor ? initialStockUsed(menuFor).bags : 0;

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success(`IS-${deleteFor.stock_no} deleted`, { description: 'Its stock is removed from the ledger.' });
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header title="Initial Stock" subtitle={`${entries.length} opening entries · ${formatNumber(totalBags)} bags`} />

      <ListBody<InitialStockEntry>
        items={entries}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={search}
        searchPlaceholder="Search IS no, commodity, location…"
        emptyTitle="No opening stock"
        emptyDescription="Enter stock that existed before the system went live."
        emptyActionLabel={canCreate ? 'Add opening stock' : undefined}
        onEmptyAction={canCreate ? () => router.push('/operations/initial-stock/form' as never) : undefined}
        renderItem={(item) => {
          const used = initialStockUsed(item).bags;
          const locationId = refId(item.location_id);
          return (
            <RecordCard
              title={`IS-${item.stock_no}`}
              subtitle={[
                lookups.commodityName(refId(item.commodity_id)),
                lookups.gradeName(refId(item.grade_id)),
                lookups.bagConfigName(refId(item.bag_type_id)),
                holder(item),
              ]
                .filter((part) => part && part !== '—')
                .join(' · ')}
              icon="archive-outline"
              badge={used > 0 ? { label: `${formatNumber(used)} used`, tone: 'info' } : undefined}
              fields={[
                { label: 'Bags', value: formatNumber(item.bags), emphasis: true },
                { label: 'Weight', value: `${formatNumber(item.weight, 2)} kg` },
                { label: 'Value', value: formatCurrency(item.amount) },
                { label: 'Rate', value: item.weight ? `${formatCurrency(item.amount / item.weight)}/kg` : null },
                { label: 'Location', value: `${lookups.locationName(locationId)} / ${lookups.subLocationName(locationId, item.sub_location_id)}` },
                { label: 'Date', value: formatDate(item.date) },
              ]}
              onPress={canUpdate ? () => router.push(`/operations/initial-stock/form?id=${item._id}` as never) : undefined}
              onMenu={() => setMenuFor(item)}
            />
          );
        }}
      />

      {canCreate && <Fab label="Opening stock" onPress={() => router.push('/operations/initial-stock/form' as never)} />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `IS-${menuFor.stock_no}` : undefined}
        actions={[
          {
            label: 'Edit quantities',
            icon: 'create-outline',
            disabled: !canUpdate,
            disabledReason: 'Your role cannot edit opening stock',
            onPress: () => menuFor && router.push(`/operations/initial-stock/form?id=${menuFor._id}` as never),
          },
          {
            label: 'Open stock entry',
            icon: 'cube-outline',
            disabled: !can('inventory:read') || !refId(menuFor?.stock_ledger_id),
            disabledReason: 'Needs inventory access',
            onPress: () => menuFor && router.push(`/operations/inventory/${refId(menuFor.stock_ledger_id)}` as never),
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete || menuUsed > 0,
            disabledReason: menuUsed > 0 ? `${formatNumber(menuUsed)} bags already used — cannot delete` : 'Your role cannot delete opening stock',
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title={deleteFor ? `Delete IS-${deleteFor.stock_no}?` : 'Delete?'}
        description={deleteFor ? `${formatNumber(deleteFor.bags)} bags are removed from stock.` : undefined}
      />
    </Screen>
  );
}
