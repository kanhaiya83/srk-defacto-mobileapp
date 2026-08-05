import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { useCreateOutward, usePreOutwards, useStockLedgerAll } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button, IconButton } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { Callout, DetailRow } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { formatDate, formatNumber, formatWeight, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

interface DispatchLine {
  stock_ledger_id: string;
  bags_dispatched: number;
  dispatched_weight: number;
  /** Reserved and not yet dispatched — the ceiling for this line. */
  remaining: number;
  label: string;
  sublabel: string;
}

/**
 * Outward — dispatching against a pre-outward reservation.
 *
 * Every line is pre-filled with what is still owed on that reservation, because
 * the normal case is "send everything that was reserved". Partial dispatch is
 * just editing a number down.
 */
export default function OutwardFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const lookups = useMasterLookups();
  const preOutwards = usePreOutwards();
  const ledger = useStockLedgerAll();
  const create = useCreateOutward();

  const [preoutwardId, setPreoutwardId] = useState('');
  const [date, setDate] = useState(today());
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<DispatchLine[]>([]);

  const openPreOutwards = useMemo(
    () => (preOutwards.data ?? []).filter((entry) => (entry.total_bags_remaining ?? 0) > 0),
    [preOutwards.data]
  );

  const selected = openPreOutwards.find((entry) => entry._id === preoutwardId);

  const choosePreOutward = (id: string) => {
    setPreoutwardId(id);
    const preOutward = openPreOutwards.find((entry) => entry._id === id);
    if (!preOutward) {
      setLines([]);
      return;
    }

    setLines(
      (preOutward.allocations ?? [])
        .map((allocation) => {
          const ledgerId = refId(allocation.stock_ledger_id);
          const entry = (ledger.data ?? []).find((row) => row._id === ledgerId);
          const remaining =
            allocation.remaining_bags ?? allocation.bags_allocated - (allocation.dispatched_bags ?? 0);
          const perBag =
            allocation.effective_weight_per_bag ??
            allocation.weight_per_bag ??
            (allocation.bags_allocated ? allocation.allocated_weight / allocation.bags_allocated : 0);

          return {
            stock_ledger_id: ledgerId,
            bags_dispatched: Math.max(0, remaining),
            dispatched_weight: Number((Math.max(0, remaining) * perBag).toFixed(2)),
            remaining: Math.max(0, remaining),
            label: entry?.entry_no ?? allocation.entry_no ?? 'Batch',
            sublabel: entry
              ? `${lookups.commodityName(refId(entry.commodity_id))} · ${lookups.gradeName(refId(entry.grade_id))}`
              : 'Reserved stock',
          } satisfies DispatchLine;
        })
        .filter((line) => line.remaining > 0)
    );
  };

  const totals = lines.reduce(
    (acc, line) => ({ bags: acc.bags + line.bags_dispatched, weight: acc.weight + line.dispatched_weight }),
    { bags: 0, weight: 0 }
  );

  const submit = async () => {
    if (!preoutwardId) return toast.error('Select a pre-outward');
    const active = lines.filter((line) => line.bags_dispatched > 0);
    if (active.length === 0) return toast.error('Dispatch at least one bag');
    const over = active.find((line) => line.bags_dispatched > line.remaining);
    if (over) return toast.error(`${over.label}: only ${formatNumber(over.remaining)} bags are reserved`);

    try {
      await create.mutateAsync({
        date,
        preoutward_id: preoutwardId,
        remarks: remarks || undefined,
        dispatches: active.map((line) => ({
          stock_ledger_id: line.stock_ledger_id,
          preoutward_id: preoutwardId,
          bags_dispatched: line.bags_dispatched,
          dispatched_weight: line.dispatched_weight,
        })),
      });
      toast.success('Dispatch recorded', { description: `${formatNumber(totals.bags)} bags out` });
      router.back();
    } catch (error) {
      toast.error('Could not record the dispatch', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen edges={['top']}>
      <Header title="New dispatch" subtitle="Send out reserved stock" />

      <Body>
        <Field label="Pre-outward" required>
          <Select
            value={preoutwardId}
            options={openPreOutwards.map((entry) => ({
              value: entry._id,
              label: `Pre-outward ${entry.preout_no}`,
              description: `${formatNumber(entry.total_bags_remaining)} bags awaiting dispatch · ${formatDate(entry.date)}`,
            }))}
            onChange={choosePreOutward}
            title="Pre-outward"
            placeholder={openPreOutwards.length ? 'Select a reservation' : 'Nothing is reserved for dispatch'}
          />
        </Field>

        <Field label="Dispatch date" required>
          <DateField value={date} onChange={setDate} />
        </Field>

        {!preoutwardId && (
          <Callout
            tone="info"
            title="Start with a reservation"
            description="Stock must be reserved on a pre-outward before it can leave the yard."
          />
        )}

        {selected && (
          <>
            <SectionHeader
              title="Dispatch lines"
              caption={`From pre-outward ${selected.preout_no} · ${lookups.companyGroupName(refId(selected.company_group_id))}`}
            />

            <Animated.View layout={LinearTransition.duration(180)} style={{ gap: theme.spacing.md }}>
              {lines.map((line, index) => (
                <Animated.View key={line.stock_ledger_id} entering={FadeIn.duration(160)}>
                  <Card>
                    <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="bodyStrong">{line.label}</Text>
                        <Text variant="caption" tone="muted">
                          {line.sublabel} · {formatNumber(line.remaining)} reserved
                        </Text>
                      </View>
                      <IconButton
                        icon="close"
                        tone="danger"
                        accessibilityLabel={`Skip ${line.label}`}
                        onPress={() => setLines((current) => current.filter((_, i) => i !== index))}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                      <Field label="Bags" style={{ flex: 1 }}>
                        <NumberInput
                          value={line.bags_dispatched || ''}
                          error={line.bags_dispatched > line.remaining}
                          onChangeValue={(value) =>
                            setLines((current) =>
                              current.map((row, i) =>
                                i === index
                                  ? {
                                      ...row,
                                      bags_dispatched: Number(value || 0),
                                      dispatched_weight:
                                        row.remaining > 0
                                          ? Number(
                                              (
                                                (Number(value || 0) * row.dispatched_weight) /
                                                (row.bags_dispatched || row.remaining)
                                              ).toFixed(2)
                                            )
                                          : row.dispatched_weight,
                                    }
                                  : row
                              )
                            )
                          }
                        />
                      </Field>
                      <Field label="Weight" style={{ flex: 1 }}>
                        <NumberInput
                          value={line.dispatched_weight || ''}
                          suffix="kg"
                          onChangeValue={(value) =>
                            setLines((current) =>
                              current.map((row, i) => (i === index ? { ...row, dispatched_weight: Number(value || 0) } : row))
                            )
                          }
                        />
                      </Field>
                    </View>
                  </Card>
                </Animated.View>
              ))}
            </Animated.View>

            {lines.length === 0 && (
              <Callout tone="warning" title="Nothing left to dispatch" description="Every reserved bag on this pre-outward has already gone out." />
            )}

            <Card>
              <SectionHeader title="Totals" />
              <DetailRow label="Bags out" value={formatNumber(totals.bags)} emphasis />
              <DetailRow label="Weight out" value={formatWeight(totals.weight)} />
            </Card>

            <Field label="Remarks">
              <Input value={remarks} onChangeText={setRemarks} placeholder="Vehicle, driver, notes" />
            </Field>
          </>
        )}
      </Body>

      <ActionBar>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button
          label="Record dispatch"
          style={{ flex: 2 }}
          loading={create.isPending}
          disabled={!preoutwardId || totals.bags === 0}
          onPress={submit}
        />
      </ActionBar>
    </Screen>
  );
}
