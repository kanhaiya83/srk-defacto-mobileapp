import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useMachines } from '@/api/masters-api';
import {
  useCreateLot,
  useLot,
  useLots,
  usePreLot,
  usePreLots,
  useStockLedger,
  useUpdateLot,
  type Lot,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { EmptyState, Loading } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Callout, DetailRow, SwitchRow } from '@/components/ui/misc';
import { Select, type Option } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { dayOf, localDay, lotInputLines, lotInputSources, machineBusyWith } from '@/features/operations/lot';
import { useMasterLookups } from '@/features/operations/lookups';
import { preLotTotals } from '@/features/operations/prelot';
import { StockLinesEditor, lineTotals, type StockLine } from '@/features/operations/stock-lines';
import { usePermissions } from '@/hooks/use-permissions';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatCurrency, formatDate, formatNumber, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

interface FormState {
  date: string;
  prelot_id: string;
  machine_id: string;
  lock_machine: boolean;
  remarks: string;
  lines: StockLine[];
}

type ErrorKey = keyof FormState;

/**
 * Lot input — create and edit. A lot runs one pre-lot's reserved stock through
 * one machine; its inputs can only come from what the pre-lot still holds.
 */
export default function LotFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id, prelot } = useLocalSearchParams<{ id?: string; prelot?: string }>();
  const isEdit = Boolean(id);
  const lookups = useMasterLookups();
  const { can } = usePermissions();

  const existing = useLot(id ?? '');
  const lot = existing.data;
  const lots = useLots();
  const preLots = usePreLots();
  const machines = useMachines();
  const create = useCreateLot();
  const update = useUpdateLot();

  const [error, setError] = useState<{ key: ErrorKey; message: string } | null>(null);

  const machineOf = (value: Lot) => (machines.data ?? []).find((machine) => machine._id === refId(value.machine_id));
  const [form, setForm] = useSyncedState<FormState>(
    isEdit ? (lot && machines.data ? lot._id : null) : 'new',
    () =>
      lot
        ? {
            date: dayOf(lot.date) || today(),
            prelot_id: refId(lot.prelot_id),
            machine_id: refId(lot.machine_id),
            // Show the lock as it stands, so saving never flips it by accident.
            lock_machine: machineOf(lot)?.locked_in_lot?._id === lot._id,
            remarks: lot.remarks ?? '',
            lines: lotInputLines(lot),
          }
        : { date: today(), prelot_id: prelot ?? '', machine_id: '', lock_machine: true, remarks: '', lines: [] }
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (error?.key === key) setError(null);
  };

  const preLotQuery = usePreLot(form.prelot_id);
  const preLot = preLotQuery.data;
  const ledger = useStockLedger(
    preLot ? { company_group_id: refId(preLot.company_group_id), commodity_id: refId(preLot.commodity_id) } : {}
  );

  const sources = useMemo(
    () => lotInputSources(preLot, lot, ledger.data ?? [], lookups),
    [preLot, lot, ledger.data, lookups]
  );
  const totals = lineTotals(form.lines, sources);

  const preLotOptions = useMemo<Option[]>(
    () =>
      (preLots.data ?? [])
        .map((entry) => ({ entry, free: preLotTotals(entry).remainingBags }))
        .filter(({ entry, free }) => free > 0 || entry._id === form.prelot_id)
        .sort((a, b) => b.entry.prelot_no - a.entry.prelot_no)
        .map(({ entry, free }) => ({
          value: entry._id,
          label: `Pre-lot ${entry.prelot_no}`,
          description: [
            lookups.commodityName(refId(entry.commodity_id)),
            entry.company_group?.group_name,
            `${formatNumber(free)} bags free`,
          ]
            .filter((part) => part && part !== '—')
            .join(' · '),
        })),
    [preLots.data, form.prelot_id, lookups]
  );

  const machineOptions = useMemo<Option[]>(
    () =>
      (machines.data ?? [])
        .map((machine) => {
          const busy = machineBusyWith(machine, lots.data ?? [], lot?._id);
          return {
            value: machine._id,
            label: machine.machine_name,
            description: busy ? `Busy with lot ${busy}` : machine.remark || undefined,
            disabled: busy !== null,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    [machines.data, lots.data, lot?._id]
  );

  const readOnly = Boolean(lot?.is_complete);
  const preLotDate = dayOf(preLot?.date);

  const validate = (): { key: ErrorKey; message: string } | null => {
    if (!form.prelot_id) return { key: 'prelot_id', message: 'Select a pre-lot' };
    if (!form.machine_id) return { key: 'machine_id', message: 'Select a machine' };
    if (form.lines.length === 0) return { key: 'lines', message: 'Add at least one input' };
    if (preLotDate && form.date < preLotDate) {
      return { key: 'date', message: `The lot cannot be dated before its pre-lot (${formatDate(preLotDate)})` };
    }
    if (form.lines.some((line) => line.date < form.date)) return { key: 'lines', message: 'An input is dated before the lot' };
    return null;
  };

  const submit = async () => {
    const failure = validate();
    if (failure) {
      setError(failure);
      toast.error(failure.message);
      return;
    }
    const base = {
      date: form.date,
      machine_id: form.machine_id,
      lock_machine: form.lock_machine,
      remarks: form.remarks,
      inputs: form.lines.map((line) => ({
        stock_ledger_id: line.sourceId,
        bags_consumed: line.bags,
        consumed_weight: line.weight,
        date: line.date,
      })),
    };
    try {
      if (lot) {
        await update.mutateAsync({ id: lot._id, data: base as Partial<Lot> });
        toast.success(`Lot ${lot.lot_no} updated`);
        router.back();
      } else {
        const created = await create.mutateAsync({
          ...base,
          prelot_id: form.prelot_id,
          commodity_id: refId(preLot?.commodity_id),
          outputs: [],
          waste_bags: 0,
        } as unknown as Parameters<typeof create.mutateAsync>[0]);
        toast.success(`Lot ${created.lot_no} created`, { description: 'Record its output when the run is done.' });
        router.replace(`/operations/lot/${created._id}` as never);
      }
    } catch (err) {
      toast.error(lot ? 'Could not update the lot' : 'Could not create the lot', { description: getErrorMessage(err) });
    }
  };

  if (isEdit && (existing.isLoading || (lot && !machines.data))) {
    return (
      <Screen>
        <Header title="Lot" />
        <Loading label="Loading lot…" />
      </Screen>
    );
  }
  if (isEdit && !lot) {
    return (
      <Screen>
        <Header title="Lot" />
        <EmptyState icon="alert-circle-outline" title="Lot not found" description="It may have been deleted." />
      </Screen>
    );
  }

  const errorFor = (key: ErrorKey) => (error?.key === key ? error.message : undefined);
  const changePreLot = (value: string) => {
    if (value === form.prelot_id) return;
    if (form.lines.length > 0) toast.info('Inputs cleared', { description: 'They came from the previous pre-lot.' });
    setForm((current) => ({ ...current, prelot_id: value, lines: [] }));
    if (error?.key === 'prelot_id') setError(null);
  };

  return (
    <Screen edges={['top']}>
      <Header
        title={lot ? `${readOnly ? 'Lot' : 'Edit lot'} ${lot.lot_no}` : 'New lot'}
        subtitle={readOnly ? 'Complete — read only' : 'Stock this run consumes'}
      />

      <Body bottomOffset={130}>
        {readOnly && (
          <Callout tone="success" icon="checkmark-done-outline" title="This lot is complete" description="Its inputs can no longer change." />
        )}

        <Card>
          <SectionHeader title="Run" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Pre-lot" required error={errorFor('prelot_id')} hint={lot ? 'A lot stays with its pre-lot' : undefined}>
              <Select
                value={form.prelot_id}
                options={preLotOptions}
                onChange={changePreLot}
                title="Pre-lot"
                placeholder="Choose the stock to process"
                disabled={isEdit}
                error={Boolean(errorFor('prelot_id'))}
              />
            </Field>

            {preLot && (
              <View style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs }}>
                <DetailRow label="Commodity" value={lookups.commodityName(refId(preLot.commodity_id))} />
                <DetailRow label="Company group" value={preLot.company_group?.group_name ?? lookups.companyGroupName(refId(preLot.company_group_id))} />
                <DetailRow label="Pre-lot date" value={formatDate(preLot.date)} />
              </View>
            )}

            <Field label="Date" required error={errorFor('date')} hint={preLotDate ? `Not before ${formatDate(preLotDate)}` : undefined}>
              <DateField
                value={form.date}
                onChange={(value) => set('date', value)}
                minimumDate={localDay(preLotDate)}
                disabled={readOnly}
                error={Boolean(errorFor('date'))}
              />
            </Field>

            <Field label="Machine" required error={errorFor('machine_id')}>
              <Select
                value={form.machine_id}
                options={machineOptions}
                onChange={(value) => set('machine_id', value)}
                title="Machine"
                disabled={readOnly}
                error={Boolean(errorFor('machine_id'))}
                onCreate={!readOnly && can('machine:create') ? () => router.push('/masters/machine/new' as never) : undefined}
                createLabel="Add machine"
              />
            </Field>
            <SwitchRow
              label="Lock machine to this lot"
              description="Keeps it off other lots until this one is complete"
              value={form.lock_machine}
              onValueChange={(value) => set('lock_machine', value)}
              disabled={readOnly}
            />
          </View>
        </Card>

        <SectionHeader title="Inputs" caption={`${form.lines.length} from the pre-lot`} />
        {errorFor('lines') && <Callout tone="danger" title={errorFor('lines')!} />}
        <StockLinesEditor
          sources={sources}
          lines={form.lines}
          onChange={(lines) => set('lines', lines)}
          withDate
          minDate={form.date}
          defaultDate={form.date}
          readOnly={readOnly}
          noun="input"
          sourcesLoading={preLotQuery.isFetching && !preLot}
          emptyHint={form.prelot_id ? 'Pick the reserved stock this run consumes.' : 'Choose a pre-lot first — it decides what is available.'}
        />

        <Field label="Remarks">
          <Input value={form.remarks} onChangeText={(value) => set('remarks', value)} multiline editable={!readOnly} />
        </Field>
      </Body>

      <ActionBar
        summary={
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="caption" tone="muted" numeric>
              {formatNumber(totals.bags)} bags · {formatNumber(totals.weight, 2)} kg
            </Text>
            <Text variant="caption" tone="muted" numeric>
              {totals.weight ? `${formatCurrency(totals.value)} · ${formatCurrency(totals.value / totals.weight)}/kg` : ''}
            </Text>
          </View>
        }
      >
        {readOnly ? (
          <Button label="Back" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        ) : (
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
            <Button
              label={lot ? 'Save changes' : 'Create lot'}
              style={{ flex: 2 }}
              loading={create.isPending || update.isPending}
              onPress={submit}
            />
          </>
        )}
      </ActionBar>
    </Screen>
  );
}
