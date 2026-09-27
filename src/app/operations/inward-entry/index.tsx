import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  useAllBillAssignments,
  useBillEntries,
  useCreateInwardEntry,
  useGenerateGrnEntries,
  useInwardEntries,
  useInwardWeighBridgeEntries,
  type GenerateGrnEntry,
  type InwardEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { grnReadiness, inwardItemIds, inwardTotals, isFullyAllocated } from '@/features/operations/inward';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';

type Tab = 'pending' | 'created';

/**
 * Inward entry — turning received goods into billed, booked stock.
 *
 * Pending holds GRNs whose bags are all placed but not yet in stock: each one
 * needs its bills entered and assigned to its lines before "Create inward".
 * Created lists the resulting inward entries.
 */
export default function InwardEntryScreen() {
  const router = useRouter();
  const lookups = useMasterLookups();
  const { canCreate } = useModulePermissions('inward-entry');

  const grns = useGenerateGrnEntries();
  const bills = useBillEntries();
  const assignments = useAllBillAssignments();
  const inwards = useInwardEntries();
  const wbis = useInwardWeighBridgeEntries();
  const createInward = useCreateInwardEntry();

  const [tab, setTab] = useState<Tab>('pending');
  const [confirmFor, setConfirmFor] = useState<GenerateGrnEntry | null>(null);

  const inwardList = useMemo(() => inwards.data ?? [], [inwards.data]);
  const doneLines = useMemo(() => inwardItemIds(inwardList), [inwardList]);

  /** Fully allocated GRNs with at least one line not yet in stock — the web's "Pending Inward". */
  const pending = useMemo(
    () =>
      (grns.data ?? []).filter(
        (grn) => isFullyAllocated(grn) && !(grn.entries ?? []).every((item) => doneLines.has(item._id))
      ),
    [grns.data, doneLines]
  );

  const readinessFor = useCallback(
    (grn: GenerateGrnEntry) =>
      grnReadiness(
        grn,
        (bills.data ?? []).filter((bill) => bill.grn_id === grn._id),
        (assignments.data ?? []).filter((row) => row.grn_id === grn._id),
        inwardList
      ),
    [bills.data, assignments.data, inwardList]
  );

  const vehicleFor = useCallback(
    (grn?: { wbi_id?: string } | null) => (wbis.data ?? []).find((wbi) => wbi.wbi_id === grn?.wbi_id)?.vehicle_no,
    [wbis.data]
  );

  const grnCommodities = useCallback(
    (grn: GenerateGrnEntry) =>
      [...new Set((grn.entries ?? []).map((item) => lookups.commodityName(item.commodity_id)))].join(', '),
    [lookups]
  );

  const searchPending = useCallback(
    (grn: GenerateGrnEntry) => [
      grn.grn_id,
      grn.wbi_id,
      vehicleFor(grn),
      grnCommodities(grn),
      ...(grn.entries ?? []).map((item) => lookups.gradeName(item.grade_id)),
      ...(grn.entries ?? []).map((item) => lookups.locationName(item.location_id)),
    ],
    [vehicleFor, grnCommodities, lookups]
  );

  const searchCreated = useCallback(
    (entry: InwardEntry) => {
      const item = entry.grn_entry_item_data;
      return [
        entry.entry_no,
        entry.grn?.grn_id,
        vehicleFor(entry.grn),
        lookups.companyName(inwardTotals(entry).companyId),
        lookups.commodityName(item?.commodity_id),
        lookups.gradeName(item?.grade_id),
        lookups.locationName(item?.location_id),
      ];
    },
    [vehicleFor, lookups]
  );

  const handleCreateInward = async () => {
    if (!confirmFor) return;
    try {
      await createInward.mutateAsync({ grn_id: confirmFor._id } as InwardEntry);
      toast.success('Inward entries created', { description: `GRN ${confirmFor.grn_id} is now in stock` });
    } catch (error) {
      toast.error('Could not create inward entries', { description: getErrorMessage(error) });
    }
    setConfirmFor(null);
  };

  const tabs = [
    { value: 'pending' as const, label: 'Pending', count: pending.length },
    { value: 'created' as const, label: 'Created', count: inwardList.length },
  ];
  const loading = grns.isLoading || inwards.isLoading || bills.isLoading || assignments.isLoading;
  const refresh = () => {
    void grns.refetch();
    void bills.refetch();
    void assignments.refetch();
    void inwards.refetch();
  };
  const refreshing = grns.isRefetching || bills.isRefetching || assignments.isRefetching || inwards.isRefetching;

  return (
    <Screen>
      <Header
        title="Inward Entry"
        subtitle={pending.length > 0 ? `${pending.length} GRN${pending.length === 1 ? '' : 's'} waiting for inward` : 'Nothing waiting for inward'}
      />

      {tab === 'pending' ? (
        <ListBody<GenerateGrnEntry, Tab>
          items={pending}
          isLoading={loading}
          isError={grns.isError}
          errorMessage={grns.error ? getErrorMessage(grns.error) : undefined}
          onRefresh={refresh}
          refreshing={refreshing}
          keyExtractor={(grn) => grn._id}
          searchFields={searchPending}
          searchPlaceholder="Search GRN, vehicle, commodity…"
          filters={tabs}
          filterValue={tab}
          onFilterChange={setTab}
          emptyTitle="Nothing waiting for inward"
          emptyDescription="A GRN appears here once all its bags are placed on its lines."
          renderItem={(grn) => {
            const state = readinessFor(grn);
            return (
              <RecordCard
                title={`GRN ${grn.grn_id}`}
                subtitle={[vehicleFor(grn), grnCommodities(grn), formatDate(grn.date)].filter(Boolean).join(' · ')}
                badge={
                  state.canCreateInward
                    ? { label: 'Ready', tone: 'success' }
                    : { label: state.billedBags < state.total ? 'To bill' : 'To assign', tone: 'warning' }
                }
                accent={state.canCreateInward ? 'success' : 'warning'}
                fields={[
                  { label: 'Bags', value: formatNumber(state.total) },
                  { label: 'Bills', value: formatNumber((bills.data ?? []).filter((bill) => bill.grn_id === grn._id).length) },
                  { label: 'Billed', value: `${formatNumber(state.billedBags)} / ${formatNumber(state.total)}` },
                  { label: 'Assigned', value: `${formatNumber(state.assignedBags)} / ${formatNumber(state.total)}` },
                ]}
                onPress={() => router.push(`/operations/inward-entry/grn/${grn._id}` as never)}
                footer={
                  state.canCreateInward && canCreate ? (
                    <Button
                      label="Create inward"
                      icon="download-outline"
                      size="sm"
                      fullWidth
                      onPress={() => setConfirmFor(grn)}
                    />
                  ) : (
                    <Button
                      label={state.blocker ? `Bills & assignment · ${state.blocker}` : 'Bills & assignment'}
                      icon="receipt-outline"
                      variant="outline"
                      size="sm"
                      fullWidth
                      onPress={() => router.push(`/operations/inward-entry/grn/${grn._id}` as never)}
                    />
                  )
                }
              />
            );
          }}
        />
      ) : (
        <ListBody<InwardEntry, Tab>
          items={inwardList}
          isLoading={loading}
          isError={inwards.isError}
          errorMessage={inwards.error ? getErrorMessage(inwards.error) : undefined}
          onRefresh={refresh}
          refreshing={refreshing}
          keyExtractor={(entry) => entry._id}
          searchFields={searchCreated}
          searchPlaceholder="Search inward, GRN, company…"
          filters={tabs}
          filterValue={tab}
          onFilterChange={setTab}
          emptyTitle="No inward entries yet"
          emptyDescription="They appear here once a GRN's bills are assigned and its inward is created."
          renderItem={(entry) => {
            const totals = inwardTotals(entry);
            const item = entry.grn_entry_item_data;
            return (
              <RecordCard
                title={`Inward ${entry.entry_no}`}
                subtitle={[
                  `GRN ${entry.grn?.grn_id ?? '—'}`,
                  vehicleFor(entry.grn),
                  lookups.companyName(totals.companyId),
                  formatDate(entry.createdAt),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                icon="download-outline"
                fields={[
                  {
                    label: 'Commodity',
                    value: `${lookups.commodityName(item?.commodity_id)} · ${lookups.gradeName(item?.grade_id)}`,
                  },
                  { label: 'Bills', value: formatNumber(totals.count) },
                  { label: 'Bags', value: formatNumber(totals.bags), emphasis: true },
                  { label: 'Weight', value: `${formatNumber(totals.weight, 2)} kg` },
                  { label: 'Amount', value: formatCurrency(totals.amount) },
                  { label: 'Location', value: lookups.locationName(item?.location_id) },
                ]}
                onPress={() => router.push(`/operations/challan-report/${entry._id}` as never)}
              />
            );
          }}
        />
      )}

      <ConfirmSheet
        open={confirmFor !== null}
        onClose={() => setConfirmFor(null)}
        onConfirm={handleCreateInward}
        loading={createInward.isPending}
        tone="primary"
        confirmLabel="Create inward"
        title={confirmFor ? `Create inward for GRN ${confirmFor.grn_id}?` : ''}
        description="This books the assigned bags into stock and locks the GRN and its bills' quantities and amounts."
      />
    </Screen>
  );
}
