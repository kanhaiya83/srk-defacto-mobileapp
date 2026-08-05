import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useDeleteSaleOrder, useSaleOrders, useUpdateSaleOrder, type SaleOrder } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate, formatNumber, refId, refLabel } from '@/lib/format';

type Filter = 'open' | 'completed' | 'all';

export const orderTotals = (order: SaleOrder) =>
  (order.orders ?? []).reduce(
    (acc, line) => ({
      bags: acc.bags + (line.bags || 0),
      weight: acc.weight + (line.total_weight || 0),
      value: acc.value + (line.total_weight || 0) * (line.rate || 0),
    }),
    { bags: 0, weight: 0, value: 0 }
  );

export default function SaleOrderListScreen() {
  const router = useRouter();
  const lookups = useMasterLookups();
  const list = useSaleOrders();
  const update = useUpdateSaleOrder();
  const remove = useDeleteSaleOrder();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('saleorder');

  const [filter, setFilter] = useState<Filter>('open');
  const [menuFor, setMenuFor] = useState<SaleOrder | null>(null);
  const [deleteFor, setDeleteFor] = useState<SaleOrder | null>(null);

  const orders = list.data ?? [];
  const openCount = orders.filter((order) => !order.is_completed).length;

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter((order) => (filter === 'completed' ? order.is_completed : !order.is_completed));
  }, [orders, filter]);

  const search = useCallback(
    (order: SaleOrder) => [order.order_no, refLabel(order.vendor_id, 'vendor_name')],
    []
  );

  const toggleComplete = async (order: SaleOrder) => {
    try {
      await update.mutateAsync({ id: order._id, data: { is_completed: !order.is_completed } });
      toast.success(order.is_completed ? 'Order reopened' : 'Order marked complete');
    } catch (error) {
      toast.error('Could not update the order', { description: getErrorMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success(`Order ${deleteFor.order_no} deleted`);
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete the order', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header title="Sale Orders" subtitle={openCount > 0 ? `${openCount} open` : 'All orders closed'} />

      <ListBody<SaleOrder, Filter>
        items={filtered}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={search}
        searchPlaceholder="Search order no or customer…"
        filters={[
          { value: 'open', label: 'Open', count: openCount },
          { value: 'completed', label: 'Completed', count: orders.length - openCount },
          { value: 'all', label: 'All', count: orders.length },
        ]}
        filterValue={filter}
        onFilterChange={setFilter}
        emptyTitle="No sale orders yet"
        emptyDescription="Record what a customer has ordered so dispatch can be planned against it."
        emptyActionLabel={canCreate ? 'New sale order' : undefined}
        onEmptyAction={canCreate ? () => router.push('/operations/saleorder/form') : undefined}
        renderItem={(item) => {
          const totals = orderTotals(item);
          const overdue =
            !item.is_completed && item.delivery_by_date && new Date(item.delivery_by_date) < new Date();
          return (
            <RecordCard
              title={`Order ${item.order_no}`}
              subtitle={`${lookups.vendorName(refId(item.vendor_id)) } · ${formatDate(item.date)}`}
              badge={
                item.is_completed
                  ? { label: 'Completed', tone: 'success' }
                  : overdue
                    ? { label: 'Overdue', tone: 'danger' }
                    : { label: 'Open', tone: 'warning' }
              }
              accent={overdue ? 'danger' : undefined}
              fields={[
                { label: 'Lines', value: item.orders?.length ?? 0 },
                { label: 'Bags', value: formatNumber(totals.bags), emphasis: true },
                { label: 'Weight', value: `${formatNumber(totals.weight)} kg` },
                { label: 'Deliver by', value: item.delivery_by_date ? formatDate(item.delivery_by_date) : null },
              ]}
              footer={undefined}
              onPress={() => router.push(`/operations/saleorder/${item._id}`)}
              onMenu={() => setMenuFor(item)}
            />
          );
        }}
      />

      {canCreate && <Fab onPress={() => router.push('/operations/saleorder/form')} label="New order" />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `Order ${menuFor.order_no}` : undefined}
        actions={[
          {
            label: 'View details',
            icon: 'eye-outline',
            onPress: () => menuFor && router.push(`/operations/saleorder/${menuFor._id}`),
          },
          {
            label: menuFor?.is_completed ? 'Reopen order' : 'Mark complete',
            icon: menuFor?.is_completed ? 'refresh-outline' : 'checkmark-circle-outline',
            disabled: !canUpdate,
            disabledReason: 'Your role cannot change orders',
            onPress: () => menuFor && toggleComplete(menuFor),
          },
          {
            label: 'Edit',
            icon: 'create-outline',
            disabled: !canUpdate,
            onPress: () => menuFor && router.push(`/operations/saleorder/form?id=${menuFor._id}`),
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete,
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="Delete this sale order?"
        description={
          deleteFor
            ? `Order ${deleteFor.order_no} worth ${formatCurrency(orderTotals(deleteFor).value)} will be removed.`
            : undefined
        }
      />
    </Screen>
  );
}
