import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  useBillAssignments,
  useBillEntriesByGrn,
  useCreateInwardEntry,
  useDeleteBillEntry,
  useGenerateGrnEntry,
  useInwardEntries,
  useInwardWeighBridgeEntries,
  type BillEntry,
  type InwardEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { EmptyState, ErrorState, Loading } from '@/components/ui/feedback';
import { Callout, DetailRow, ProgressBar } from '@/components/ui/misc';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { billStatus, billTarget, assignedTo, grnReadiness, lineTotals } from '@/features/operations/inward';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatNumber } from '@/lib/format';
import { useTheme } from '@/theme';

const STATUS_BADGE = {
  assigned: { label: 'Assigned', tone: 'success' },
  partial: { label: 'Partly assigned', tone: 'warning' },
  unassigned: { label: 'Not assigned', tone: 'danger' },
} as const;

/**
 * One GRN on its way to inward — the web's "Manage Bills & Assign".
 *
 * Bills are listed with how far each has been assigned to the GRN's lines;
 * assigning happens on its own screen, one bill at a time, so the bag and
 * weight fields get the whole screen above the keyboard.
 */
export default function GrnBillingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lookups = useMasterLookups();
  const billing = useModulePermissions('billing');
  const { canCreate: canCreateInward } = useModulePermissions('inward-entry');

  const grnQuery = useGenerateGrnEntry(id);
  const billsQuery = useBillEntriesByGrn(id);
  const assignmentsQuery = useBillAssignments(id);
  const inwards = useInwardEntries();
  const wbis = useInwardWeighBridgeEntries();
  const deleteBill = useDeleteBillEntry();
  const createInward = useCreateInwardEntry();

  const [menuFor, setMenuFor] = useState<BillEntry | null>(null);
  const [deleteFor, setDeleteFor] = useState<BillEntry | null>(null);
  const [confirmInward, setConfirmInward] = useState(false);

  const grn = grnQuery.data;
  const bills = useMemo(() => billsQuery.data ?? [], [billsQuery.data]);
  const assignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const perLine = useMemo(() => lineTotals(assignments), [assignments]);

  if (grnQuery.isLoading) {
    return (
      <Screen>
        <Header title="GRN billing" />
        <Loading label="Loading GRN…" />
      </Screen>
    );
  }

  if (grnQuery.isError || !grn) {
    return (
      <Screen>
        <Header title="GRN billing" />
        <ErrorState
          message={grnQuery.error ? getErrorMessage(grnQuery.error) : 'GRN not found'}
          onRetry={() => void grnQuery.refetch()}
        />
      </Screen>
    );
  }

  const state = grnReadiness(grn, bills, assignments, (inwards.data ?? []) as InwardEntry[]);
  const locked = state.created;
  const vehicle = (wbis.data ?? []).find((wbi) => wbi.wbi_id === grn.wbi_id)?.vehicle_no;

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await deleteBill.mutateAsync(deleteFor._id);
      toast.success(`Bill ${deleteFor.bill_no} deleted`);
    } catch (error) {
      toast.error('Could not delete the bill', { description: getErrorMessage(error) });
    }
    setDeleteFor(null);
  };

  const handleCreateInward = async () => {
    try {
      await createInward.mutateAsync({ grn_id: grn._id } as InwardEntry);
      toast.success('Inward entries created', { description: `GRN ${grn.grn_id} is now in stock` });
      setConfirmInward(false);
      router.back();
    } catch (error) {
      toast.error('Could not create inward entries', { description: getErrorMessage(error) });
      setConfirmInward(false);
    }
  };

  const openAssign = (bill: BillEntry) =>
    router.push(`/operations/inward-entry/assign?grn=${grn._id}&bill=${bill._id}` as never);

  return (
    <Screen edges={['top']}>
      <Header
        title={`GRN ${grn.grn_id}`}
        subtitle={[vehicle, `${formatNumber(state.total)} bags`].filter(Boolean).join(' · ')}
      />

      <Body>
        {locked ? (
          <Callout
            tone="info"
            title="Inward created"
            description="The bills' quantities, amounts and assignments are locked. Bill no, date, e-way no, agent and remarks can still be corrected."
          />
        ) : state.blocker ? (
          <Callout tone="warning" title={state.blocker} description="Every bag must be billed and assigned to a line before inward." />
        ) : (
          <Callout tone="success" title="Ready for inward" description="All bills are entered and assigned." />
        )}

        <Card>
          <SectionHeader title="Progress" />
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ gap: theme.spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" tone="muted">
                  Billed
                </Text>
                <Text variant="caption" numeric>
                  {formatNumber(state.billedBags)} / {formatNumber(state.total)} bags
                </Text>
              </View>
              <ProgressBar value={state.total ? state.billedBags / state.total : 0} tone={state.billedBags >= state.total ? 'success' : 'warning'} />
            </View>
            <View style={{ gap: theme.spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" tone="muted">
                  Assigned
                </Text>
                <Text variant="caption" numeric>
                  {formatNumber(state.assignedBags)} / {formatNumber(state.total)} bags
                </Text>
              </View>
              <ProgressBar value={state.total ? state.assignedBags / state.total : 0} tone={state.assignedBags >= state.total ? 'success' : 'warning'} />
            </View>
            <View>
              <DetailRow label="Billed weight" value={`${formatNumber(state.billedWeight, 2)} kg`} />
              <DetailRow label="Billed amount" value={formatCurrency(state.billedAmount)} />
            </View>
          </View>
        </Card>

        <SectionHeader title="GRN lines" caption="Bags each line has taken from the bills" />
        {(grn.entries ?? []).map((item) => {
          const taken = perLine[item._id] ?? { bags: 0, weight: 0 };
          const full = taken.bags >= (item.bags_used || 0);
          return (
            <RecordCard
              key={item._id}
              title={`${lookups.commodityName(item.commodity_id)} · ${lookups.gradeName(item.grade_id)}`}
              subtitle={`${lookups.bagConfigName(item.bag_type_id)} · ${lookups.locationName(item.location_id)} / ${lookups.subLocationName(item.location_id, item.sub_location_id)}`}
              badge={{ label: full ? 'Covered' : `${formatNumber((item.bags_used || 0) - taken.bags)} open`, tone: full ? 'success' : 'neutral' }}
              fields={[
                { label: 'Bags', value: formatNumber(item.bags_used) },
                { label: 'Assigned', value: `${formatNumber(taken.bags)} bags · ${formatNumber(taken.weight, 2)} kg` },
              ]}
            />
          );
        })}

        <SectionHeader
          title={`Bills (${bills.length})`}
          action={
            !locked && billing.canCreate ? (
              <Button
                label="Add bill"
                icon="add"
                size="sm"
                variant="outline"
                onPress={() => router.push(`/operations/inward-entry/bill?grn=${grn._id}` as never)}
              />
            ) : undefined
          }
        />

        {bills.length === 0 && (
          <EmptyState
            icon="receipt-outline"
            title="No bills yet"
            description="Enter each purchase bill for this truck, then assign its bags to the GRN lines."
            compact
          />
        )}

        {bills.map((bill) => {
          const status = billStatus(bill, assignments);
          const done = assignedTo(bill, assignments);
          const target = billTarget(bill);
          return (
            <RecordCard
              key={bill._id}
              title={`Bill ${bill.bill_no}`}
              subtitle={[
                lookups.companyName(bill.company_id),
                lookups.vendorName(bill.party_id),
                lookups.gradeName(bill.grade_id),
              ].join(' · ')}
              badge={STATUS_BADGE[status]}
              accent={status === 'assigned' ? undefined : 'warning'}
              fields={[
                { label: 'Bags', value: formatNumber(bill.total_bags) },
                { label: 'Weight', value: `${formatNumber(bill.bill_weight, 2)} kg` },
                { label: 'Rate', value: bill.rate ? `${formatCurrency(bill.rate)}/kg` : null },
                { label: 'Amount', value: formatCurrency(bill.amount) },
              ]}
              onPress={() => router.push(`/operations/inward-entry/bill?grn=${grn._id}&id=${bill._id}` as never)}
              onMenu={() => setMenuFor(bill)}
              footer={
                <View style={{ gap: theme.spacing.sm }}>
                  {status !== 'assigned' && (
                    <Text variant="caption" tone="muted">
                      Assigned {formatNumber(done.bags)} of {formatNumber(target.bags)} bags ·{' '}
                      {formatNumber(done.weight, 2)} of {formatNumber(target.weight, 2)} kg
                    </Text>
                  )}
                  <Button
                    label={locked ? 'View assignment' : status === 'assigned' ? 'Change assignment' : 'Assign bags to lines'}
                    icon="git-branch-outline"
                    variant={status === 'assigned' || locked ? 'outline' : 'primary'}
                    size="sm"
                    fullWidth
                    onPress={() => openAssign(bill)}
                  />
                </View>
              }
            />
          );
        })}
      </Body>

      {!locked && canCreateInward && (
        <ActionBar
          summary={
            state.blocker ? (
              <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
                {state.blocker}
              </Text>
            ) : undefined
          }
        >
          <Button
            label="Create inward"
            icon="download-outline"
            style={{ flex: 1 }}
            disabled={!state.canCreateInward}
            onPress={() => setConfirmInward(true)}
          />
        </ActionBar>
      )}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `Bill ${menuFor.bill_no}` : undefined}
        actions={[
          {
            label: locked ? 'Correct paperwork' : 'Edit bill',
            icon: 'create-outline',
            disabled: !billing.canUpdate,
            disabledReason: 'Your role cannot edit bills',
            onPress: () => menuFor && router.push(`/operations/inward-entry/bill?grn=${grn._id}&id=${menuFor._id}` as never),
          },
          {
            label: locked ? 'View assignment' : 'Assign bags',
            icon: 'git-branch-outline',
            onPress: () => menuFor && openAssign(menuFor),
          },
          {
            label: 'Delete bill',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: locked || !billing.canDelete,
            disabledReason: locked ? 'Locked — inward created' : 'Your role cannot delete bills',
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={deleteBill.isPending}
        title="Delete this bill?"
        description={deleteFor ? `Bill ${deleteFor.bill_no} and its bag assignments will be removed.` : undefined}
      />

      <ConfirmSheet
        open={confirmInward}
        onClose={() => setConfirmInward(false)}
        onConfirm={handleCreateInward}
        loading={createInward.isPending}
        tone="primary"
        confirmLabel="Create inward"
        title={`Create inward for GRN ${grn.grn_id}?`}
        description="This books the assigned bags into stock and locks the GRN and its bills' quantities and amounts."
      />
    </Screen>
  );
}
