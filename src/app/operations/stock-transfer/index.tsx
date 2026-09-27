import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useCancelStockTransfer, useStockTransfers, type StockTransfer } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Header, Screen } from '@/components/ui/screen';
import { Sheet, SheetBody } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber, formatWeight, refId } from '@/lib/format';

type Filter = 'ACTIVE' | 'CANCELLED' | 'ALL';

const nameOf = (value: unknown, field: string) =>
  value && typeof value === 'object' ? ((value as Record<string, unknown>)[field] as string | undefined) : undefined;

/**
 * Stock transfers. A transfer is never edited, only cancelled — which undoes
 * it as long as the moved stock has not been used since.
 */
export default function StockTransferListScreen() {
  const router = useRouter();
  const lookups = useMasterLookups();
  const list = useStockTransfers();
  const cancel = useCancelStockTransfer();
  const { canCreate, canUpdate } = useModulePermissions('stock-transfer');

  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [menuFor, setMenuFor] = useState<StockTransfer | null>(null);
  const [cancelFor, setCancelFor] = useState<StockTransfer | null>(null);
  const [reason, setReason] = useState('');

  const transfers = useMemo(() => list.data ?? [], [list.data]);
  const active = transfers.filter((item) => item.status === 'ACTIVE').length;
  const filtered = filter === 'ALL' ? transfers : transfers.filter((item) => item.status === filter);

  const place = useCallback(
    (location: unknown, sub: string, company: unknown, group: unknown) => {
      const locationId = refId(location);
      return [
        `${nameOf(location, 'location_name') ?? lookups.locationName(locationId)} / ${lookups.subLocationName(locationId, sub)}`,
        nameOf(company, 'company_name') ?? (company ? lookups.companyName(refId(company)) : null) ?? nameOf(group, 'group_name'),
      ]
        .filter((part) => part && part !== '—')
        .join(' · ');
    },
    [lookups]
  );

  const entryNo = (item: StockTransfer) => nameOf(item.from_stock_ledger_id, 'entry_no');

  const search = useCallback(
    (item: StockTransfer) => [
      item.transfer_no,
      item.remarks,
      entryNo(item),
      nameOf(item.to_stock_ledger_id, 'entry_no'),
      place(item.from_location_id, item.from_sub_location_id, item.from_company_id, item.from_company_group_id),
      place(item.to_location_id, item.to_sub_location_id, item.to_company_id, item.to_company_group_id),
    ],
    [place]
  );

  const doCancel = async () => {
    if (!cancelFor) return;
    try {
      await cancel.mutateAsync({ id: cancelFor._id, reason: reason.trim() || undefined });
      toast.success(`Transfer ${cancelFor.transfer_no} cancelled`, { description: 'The stock is back where it came from.' });
      setCancelFor(null);
    } catch (error) {
      toast.error('Could not cancel the transfer', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header title="Stock Transfer" subtitle={`${active} active transfer${active === 1 ? '' : 's'}`} />

      <ListBody<StockTransfer, Filter>
        items={filtered}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={search}
        searchPlaceholder="Search transfer, entry, location…"
        filters={[
          { value: 'ACTIVE', label: 'Active', count: active },
          { value: 'CANCELLED', label: 'Cancelled', count: transfers.length - active },
          { value: 'ALL', label: 'All', count: transfers.length },
        ]}
        filterValue={filter}
        onFilterChange={setFilter}
        emptyTitle={filter === 'CANCELLED' ? 'No cancelled transfers' : 'No transfers yet'}
        emptyDescription="Move stock to another location or company within its group."
        emptyActionLabel={canCreate && filter !== 'CANCELLED' ? 'New transfer' : undefined}
        onEmptyAction={canCreate ? () => router.push('/operations/stock-transfer/form' as never) : undefined}
        renderItem={(item) => (
          <RecordCard
            title={`Transfer ${item.transfer_no}`}
            subtitle={`${place(item.from_location_id, item.from_sub_location_id, item.from_company_id, item.from_company_group_id)} → ${place(item.to_location_id, item.to_sub_location_id, item.to_company_id, item.to_company_group_id)}`}
            icon="swap-horizontal-outline"
            badge={item.status === 'ACTIVE' ? { label: 'Active', tone: 'success' } : { label: 'Cancelled', tone: 'neutral' }}
            accent={item.status === 'CANCELLED' ? 'neutral' : undefined}
            fields={[
              { label: 'Bags', value: formatNumber(item.bags), emphasis: true },
              { label: 'Weight', value: formatWeight(item.weight) },
              { label: 'Entry', value: [entryNo(item), nameOf(item.to_stock_ledger_id, 'entry_no')].filter(Boolean).join(' → ') || null },
              { label: 'Date', value: formatDate(item.date) },
            ]}
            footer={
              item.status === 'CANCELLED' && item.cancelled_reason ? (
                <Text variant="caption" tone="muted">
                  Cancelled: {item.cancelled_reason}
                </Text>
              ) : undefined
            }
            onMenu={item.status === 'ACTIVE' && canUpdate ? () => setMenuFor(item) : undefined}
          />
        )}
      />

      {canCreate && <Fab label="Transfer" onPress={() => router.push('/operations/stock-transfer/form' as never)} />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `Transfer ${menuFor.transfer_no}` : undefined}
        actions={[
          {
            label: 'Cancel transfer',
            icon: 'close-circle-outline',
            tone: 'danger',
            onPress: () => {
              if (!menuFor) return;
              setReason('');
              setCancelFor(menuFor);
            },
          },
        ]}
      />

      <Sheet
        open={cancelFor !== null}
        onClose={() => setCancelFor(null)}
        title={cancelFor ? `Cancel transfer ${cancelFor.transfer_no}?` : undefined}
        subtitle="The bags go back to the entry they came from"
        footer={
          <>
            <Button label="Keep it" variant="outline" style={{ flex: 1 }} onPress={() => setCancelFor(null)} />
            <Button label="Cancel transfer" variant="danger" style={{ flex: 2 }} loading={cancel.isPending} onPress={doCancel} />
          </>
        }
      >
        {cancelFor && (
          <SheetBody>
            <Text tone="muted">
              {formatNumber(cancelFor.bags)} bags ({formatWeight(cancelFor.weight)}) return to{' '}
              {entryNo(cancelFor) ?? 'the source entry'}. Not possible once the moved stock has been used.
            </Text>
            <Field label="Reason">
              <Input value={reason} onChangeText={setReason} placeholder="Optional" />
            </Field>
          </SheetBody>
        )}
      </Sheet>
    </Screen>
  );
}
