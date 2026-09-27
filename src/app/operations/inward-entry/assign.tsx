import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import {
  useBillAssignments,
  useBillEntriesByGrn,
  useGenerateGrnEntry,
  useInwardEntries,
  useSaveBillAssignments,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, Loading } from '@/components/ui/feedback';
import { Field, NumberInput } from '@/components/ui/field';
import { Callout } from '@/components/ui/misc';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import {
  billTarget,
  isInwardLocked,
  lineCapacity,
  linesForBill,
  totalsMatch,
  weightForBags,
} from '@/features/operations/inward';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatNumber } from '@/lib/format';
import { useTheme } from '@/theme';

type Row = { bags: number | ''; weight: number | '' };

/**
 * Assign one bill's bags and weight to the GRN lines of its grade.
 *
 * Each line takes a number of bags; the weight that goes with them is worked
 * out from the bill's average, as on the web, and can be corrected. Save only
 * goes through when the bill is fully and exactly assigned — the server
 * refuses anything else.
 */
export default function AssignBillScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { grn: grnId, bill: billId } = useLocalSearchParams<{ grn: string; bill: string }>();
  const lookups = useMasterLookups();
  const { canCreate, canUpdate } = useModulePermissions('billing');

  const grnQuery = useGenerateGrnEntry(grnId);
  const billsQuery = useBillEntriesByGrn(grnId);
  const assignmentsQuery = useBillAssignments(grnId);
  const inwards = useInwardEntries();
  const save = useSaveBillAssignments();

  const grn = grnQuery.data;
  const bill = (billsQuery.data ?? []).find((entry) => entry._id === billId);
  const allAssignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const saved = useMemo(() => allAssignments.filter((row) => row.bill_entry_id === billId), [allAssignments, billId]);
  const lines = useMemo(() => (grn && bill ? linesForBill(grn, bill) : []), [grn, bill]);
  const target = bill ? billTarget(bill) : { bags: 0, weight: 0 };

  // Seed once the bill and its saved rows are in; re-seed if the server copy changes.
  const seedKey =
    bill && assignmentsQuery.data
      ? `${bill._id}:${saved.map((row) => `${row.grn_entry_item_id}=${row.assigned_bags}/${row.assigned_weight}`).join(',')}`
      : null;
  const [rows, setRows] = useSyncedState<Record<string, Row>>(seedKey, () => {
    if (saved.length > 0) {
      return Object.fromEntries(saved.map((row) => [row.grn_entry_item_id, { bags: row.assigned_bags, weight: row.assigned_weight }]));
    }
    // One line of this grade: the whole bill obviously goes there.
    if (lines.length === 1 && bill) return { [lines[0]._id]: { bags: target.bags, weight: target.weight } };
    return {};
  });

  const locked = grn ? isInwardLocked(grn, inwards.data ?? []) : false;
  const readOnly = locked || !(canCreate || canUpdate);

  const totals = Object.values(rows).reduce<{ bags: number; weight: number }>(
    (acc, row) => ({ bags: acc.bags + Number(row.bags || 0), weight: acc.weight + Number(row.weight || 0) }),
    { bags: 0, weight: 0 }
  );
  const matches = totalsMatch(totals.bags, totals.weight, target);

  const setBags = (lineId: string, value: number | '') => {
    setRows((current) => {
      const others = Object.entries(current)
        .filter(([key]) => key !== lineId)
        .reduce<{ bags: number; weight: number }>(
          (acc, [, row]) => ({ bags: acc.bags + Number(row.bags || 0), weight: acc.weight + Number(row.weight || 0) }),
          { bags: 0, weight: 0 }
        );
      const bags = value === '' ? '' : Math.max(0, Math.floor(Number(value)));
      return {
        ...current,
        [lineId]: { bags, weight: bags === '' ? '' : weightForBags(Number(bags), target, others) },
      };
    });
  };

  const setWeight = (lineId: string, value: number | '') =>
    setRows((current) => ({ ...current, [lineId]: { bags: current[lineId]?.bags ?? '', weight: value } }));

  /** All of the bill onto one line, the rest cleared — the web's "Full". */
  const assignAllTo = (lineId: string) =>
    setRows(Object.fromEntries(lines.map((line) => [line._id, line._id === lineId ? { bags: target.bags, weight: target.weight } : { bags: '', weight: '' }])));

  const overCapacity = bill
    ? lines.find((line) => Number(rows[line._id]?.bags || 0) > lineCapacity(line, bill, allAssignments))
    : undefined;

  const submit = async () => {
    if (!grn || !bill) return;
    if (overCapacity) {
      toast.error('A line is over its bags', {
        description: `${lookups.gradeName(overCapacity.grade_id)} at ${lookups.subLocationName(overCapacity.location_id, overCapacity.sub_location_id)} can take ${lineCapacity(overCapacity, bill, allAssignments)} more`,
      });
      return;
    }
    if (!matches) {
      toast.error("Totals don't match the bill", {
        description: `Assigned ${formatNumber(totals.bags)} bags · ${formatNumber(totals.weight, 2)} kg; the bill has ${formatNumber(target.bags)} bags · ${formatNumber(target.weight, 2)} kg`,
      });
      return;
    }

    // The server replaces the GRN's whole assignment set, so other bills' rows go along unchanged.
    const others = allAssignments
      .filter((row) => row.bill_entry_id !== bill._id)
      .map((row) => ({
        bill_entry_id: row.bill_entry_id,
        grn_entry_item_id: row.grn_entry_item_id,
        assigned_bags: row.assigned_bags,
        assigned_weight: row.assigned_weight,
      }));
    const mine = Object.entries(rows)
      .filter(([, row]) => Number(row.bags || 0) > 0)
      .map(([lineId, row]) => ({
        bill_entry_id: bill._id,
        grn_entry_item_id: lineId,
        assigned_bags: Number(row.bags),
        assigned_weight: Number(row.weight || 0),
      }));

    try {
      await save.mutateAsync({ grn_id: grn._id, assignments: [...others, ...mine] });
      toast.success(`Bill ${bill.bill_no} assigned`);
      router.back();
    } catch (error) {
      toast.error('Could not save the assignment', { description: getErrorMessage(error) });
    }
  };

  if (grnQuery.isLoading || billsQuery.isLoading || assignmentsQuery.isLoading) {
    return (
      <Screen>
        <Header title="Assign bags" />
        <Loading label="Loading bill…" />
      </Screen>
    );
  }

  if (!grn || !bill) {
    return (
      <Screen>
        <Header title="Assign bags" />
        <EmptyState icon="alert-circle-outline" title="Bill not found" description="It may have been deleted." />
      </Screen>
    );
  }

  const showFull = !readOnly && saved.length === 0 && lines.length > 1;

  return (
    <Screen edges={['top']}>
      <Header
        title={`Assign bill ${bill.bill_no}`}
        subtitle={`${lookups.gradeName(bill.grade_id)} · ${formatNumber(target.bags)} bags · ${formatNumber(target.weight, 2)} kg`}
      />

      <Body bottomOffset={130}>
        {locked && (
          <Callout tone="info" title="Inward created" description="This assignment built the stock and can no longer change." />
        )}
        {lines.length === 0 && (
          <Callout
            tone="warning"
            title="No GRN line has this bill's grade"
            description="Change the bill's grade, or add a line of this grade to the GRN."
          />
        )}

        {lines.map((line) => {
          const row = rows[line._id] ?? { bags: '', weight: '' };
          const capacity = lineCapacity(line, bill, allAssignments);
          const over = Number(row.bags || 0) > capacity;
          return (
            <Card key={line._id}>
              <View style={{ gap: theme.spacing.md }}>
                <View style={{ gap: 2 }}>
                  <Text variant="bodyStrong">
                    {lookups.commodityName(line.commodity_id)} · {lookups.gradeName(line.grade_id)}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {lookups.bagConfigName(line.bag_type_id)} · {lookups.locationName(line.location_id)} /{' '}
                    {lookups.subLocationName(line.location_id, line.sub_location_id)}
                  </Text>
                  <Text variant="caption" tone={capacity === 0 ? 'danger' : 'success'}>
                    {formatNumber(capacity)} of {formatNumber(line.bags_used)} bags free for this bill
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                  <Field label="Bags" style={{ flex: 1 }} error={over ? `Max ${capacity}` : undefined}>
                    <NumberInput
                      value={row.bags}
                      onChangeValue={(value) => setBags(line._id, value)}
                      keyboardType="number-pad"
                      placeholder="0"
                      readOnly={readOnly}
                      error={over}
                    />
                  </Field>
                  <Field label="Weight" style={{ flex: 1.3 }}>
                    <NumberInput
                      value={row.weight}
                      onChangeValue={(value) => setWeight(line._id, value)}
                      suffix="kg"
                      placeholder="0.00"
                      readOnly={readOnly}
                    />
                  </Field>
                </View>
                {showFull && capacity >= target.bags && (
                  <Button
                    label={`Put all ${formatNumber(target.bags)} bags here`}
                    icon="flash-outline"
                    variant="outline"
                    size="sm"
                    onPress={() => assignAllTo(line._id)}
                  />
                )}
              </View>
            </Card>
          );
        })}
      </Body>

      <ActionBar
        summary={
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <Tally
              label="Bags"
              value={`${formatNumber(totals.bags)} / ${formatNumber(target.bags)}`}
              ok={Math.round(totals.bags) === Math.round(target.bags)}
            />
            <Tally
              label="Weight (kg)"
              value={`${formatNumber(totals.weight, 2)} / ${formatNumber(target.weight, 2)}`}
              ok={Math.abs(totals.weight - target.weight) <= 0.01}
            />
          </View>
        }
      >
        <Button label={readOnly ? 'Back' : 'Cancel'} variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        {!readOnly && (
          <Button
            label="Save assignment"
            style={{ flex: 2 }}
            loading={save.isPending}
            disabled={!matches || Boolean(overCapacity)}
            onPress={submit}
          />
        )}
      </ActionBar>
    </Screen>
  );
}

function Tally({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 1 }}>
      <Text variant="bodyStrong" tone={ok ? 'success' : 'danger'} numeric>
        {value}
      </Text>
      <Text variant="micro" tone="faint">
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
