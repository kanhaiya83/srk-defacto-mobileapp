import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useDeleteOutward, useOutwards, type OutwardEntry } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber, formatWeight, refId } from '@/lib/format';

export default function OutwardListScreen() {
  const router = useRouter();
  const lookups = useMasterLookups();
  const list = useOutwards();
  const remove = useDeleteOutward();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('outward');

  const [menuFor, setMenuFor] = useState<OutwardEntry | null>(null);
  const [deleteFor, setDeleteFor] = useState<OutwardEntry | null>(null);

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success(`Outward ${deleteFor.outward_no} deleted`);
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete the outward', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header title="Outwards" subtitle={`${list.data?.length ?? 0} dispatches`} />

      <ListBody<OutwardEntry>
        items={list.data ?? []}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={(item) => [item.outward_no, item.remarks, lookups.vendorName(refId(item.vendor_id))]}
        searchPlaceholder="Search outward no or customer…"
        emptyTitle="No dispatches yet"
        emptyDescription="Dispatch against a pre-outward to move reserved stock out."
        emptyActionLabel={canCreate ? 'New dispatch' : undefined}
        onEmptyAction={canCreate ? () => router.push('/operations/outward/form') : undefined}
        renderItem={(item) => (
          <RecordCard
            title={`Outward ${item.outward_no}`}
            subtitle={`${lookups.vendorName(refId(item.vendor_id))} · ${formatDate(item.date)}`}
            icon="cloud-upload-outline"
            fields={[
              { label: 'Bags', value: formatNumber(item.total_bags), emphasis: true },
              { label: 'Weight', value: formatWeight(item.total_weight) },
              { label: 'Batches', value: item.dispatches?.length ?? 0 },
              { label: 'Group', value: lookups.companyGroupName(refId(item.company_group_id)) },
            ]}
            onPress={() => router.push(`/operations/outward/${item._id}`)}
            onMenu={() => setMenuFor(item)}
          />
        )}
      />

      {canCreate && <Fab label="Dispatch" onPress={() => router.push('/operations/outward/form')} />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `Outward ${menuFor.outward_no}` : undefined}
        actions={[
          {
            label: 'View details',
            icon: 'eye-outline',
            onPress: () => menuFor && router.push(`/operations/outward/${menuFor._id}`),
          },
          {
            label: 'Bills',
            icon: 'receipt-outline',
            onPress: () => menuFor && router.push(`/operations/outward/${menuFor._id}?tab=bills`),
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
        title="Delete this dispatch?"
        description={
          deleteFor
            ? `${formatNumber(deleteFor.total_bags)} dispatched bags will return to their pre-outward reservation.`
            : undefined
        }
      />
    </Screen>
  );
}
