import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  useCreatePreLot,
  usePreLot,
  useStockLedger,
  useUpdatePreLot,
  type PreLot,
  type PreLotAllocation,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { EmptyState, Loading } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Callout } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import {
  StockLinesEditor,
  lineTotals,
  newLineKey,
  type StockLine,
  type StockSource,
} from '@/features/operations/stock-lines';
import { stockEntrySubtitle, stockEntryTitle } from '@/features/operations/prelot';
import { usePermissions } from '@/hooks/use-permissions';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatCurrency, formatNumber, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

type Allocation = PreLotAllocation & { consumed_weight_by_lots?: number };

interface FormState {
  date: string;
  commodity_id: string;
  company_group_id: string;
  remarks: string;
  lines: StockLine[];
}

/**
 * The server reports what lots consumed per stock entry, repeated on every
 * allocation row of that entry. Spread it over the rows in order so each row
 * knows how far it can shrink.
 */
function linesFrom(allocations: Allocation[]): StockLine[] {
  const left = new Map<string, { bags: number; weight: number }>();
  for (const allocation of allocations) {
    const id = refId(allocation.stock_ledger_id);
    if (!left.has(id)) {
      left.set(id, { bags: allocation.consumed_by_lots ?? 0, weight: allocation.consumed_weight_by_lots ?? 0 });
    }
  }
  return allocations.map((allocation) => {
    const id = refId(allocation.stock_ledger_id);
    const pool = left.get(id)!;
    const floorBags = Math.min(pool.bags, allocation.bags_allocated);
    const floorWeight = Math.min(pool.weight, allocation.allocated_weight);
    pool.bags -= floorBags;
    pool.weight -= floorWeight;
    return {
      key: allocation._id ?? newLineKey(),
      sourceId: id,
      bags: allocation.bags_allocated,
      weight: allocation.allocated_weight,
      date: allocation.date ? String(allocation.date).slice(0, 10) : today(),
      floorBags: floorBags || undefined,
      floorWeight: floorWeight || undefined,
    };
  });
}

/**
 * Pre-lot — create and edit. Reserves bags of one commodity, from one company
 * group's stock, for the lots that will process them.
 */
export default function PreLotFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const lookups = useMasterLookups();
  const { can } = usePermissions();

  const existing = usePreLot(id ?? '');
  const create = useCreatePreLot();
  const update = useUpdatePreLot();
  const preLot = existing.data;

  const [error, setError] = useState<{ key: keyof FormState; message: string } | null>(null);

  const firstGroup = lookups.companyGroupOptions[0]?.value ?? '';
  const [form, setForm] = useSyncedState<FormState>(
    isEdit ? (preLot?._id ?? null) : firstGroup ? 'new' : null,
    () =>
      preLot
        ? {
            date: preLot.date ? String(preLot.date).slice(0, 10) : today(),
            commodity_id: refId(preLot.commodity_id),
            company_group_id: refId(preLot.company_group_id ?? preLot.company_group?._id),
            remarks: preLot.remarks ?? '',
            lines: linesFrom(preLot.allocations ?? []),
          }
        : // Stock is held per company group; start with the first, as the web does.
          { date: today(), commodity_id: '', company_group_id: firstGroup, remarks: '', lines: [] }
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (error?.key === key) setError(null);
  };

  const ledger = useStockLedger(
    form.commodity_id && form.company_group_id
      ? { company_group_id: form.company_group_id, commodity_id: form.commodity_id }
      : {}
  );

  /** What this pre-lot already holds, per entry — available to it again while editing. */
  const heldHere = useMemo(() => {
    const held = new Map<string, { bags: number; weight: number }>();
    for (const allocation of preLot?.allocations ?? []) {
      const key = refId(allocation.stock_ledger_id);
      const entry = held.get(key) ?? { bags: 0, weight: 0 };
      entry.bags += allocation.bags_allocated || 0;
      entry.weight += allocation.allocated_weight || 0;
      held.set(key, entry);
    }
    return held;
  }, [preLot]);

  const sources = useMemo<StockSource[]>(
    () =>
      (ledger.data ?? []).map((entry) => {
        const held = heldHere.get(entry._id) ?? { bags: 0, weight: 0 };
        return {
          id: entry._id,
          title: stockEntryTitle(entry.entry_no, entry.source_type),
          subtitle: stockEntrySubtitle(entry, lookups),
          capBags: (entry.available_bags || 0) + held.bags,
          capWeight: (entry.available_weight || 0) + held.weight,
          ratePerKg: entry.rate_per_kg,
        };
      }),
    [ledger.data, heldHere, lookups]
  );

  const totals = lineTotals(form.lines, sources);
  const consumed = form.lines.some((line) => line.floorBags);

  const validate = (): { key: keyof FormState; message: string } | null => {
    if (!form.commodity_id) return { key: 'commodity_id', message: 'Select a commodity' };
    if (!form.company_group_id) return { key: 'company_group_id', message: 'Select a company group' };
    if (form.lines.length === 0) return { key: 'lines', message: 'Allocate bags from at least one stock entry' };
    if (form.lines.some((line) => line.date < form.date)) {
      return { key: 'lines', message: 'An allocation is dated before the pre-lot' };
    }
    return null;
  };

  const submit = async () => {
    const failure = validate();
    if (failure) {
      setError(failure);
      toast.error(failure.message);
      return;
    }
    const data = {
      date: form.date,
      commodity_id: form.commodity_id,
      company_group_id: form.company_group_id,
      remarks: form.remarks,
      allocations: form.lines.map((line) => ({
        stock_ledger_id: line.sourceId,
        bags_allocated: line.bags,
        allocated_weight: line.weight,
        date: line.date,
      })),
    };
    try {
      if (preLot) {
        await update.mutateAsync({ id: preLot._id, data: data as Partial<PreLot> });
        toast.success(`Pre-lot ${preLot.prelot_no} updated`);
      } else {
        await create.mutateAsync(data as Parameters<typeof create.mutateAsync>[0]);
        toast.success('Pre-lot created', { description: `${formatNumber(totals.bags)} bags reserved` });
      }
      router.back();
    } catch (err) {
      toast.error(preLot ? 'Could not update the pre-lot' : 'Could not create the pre-lot', {
        description: getErrorMessage(err),
      });
    }
  };

  if (isEdit && existing.isLoading) {
    return (
      <Screen>
        <Header title="Pre-lot" />
        <Loading label="Loading pre-lot…" />
      </Screen>
    );
  }
  if (isEdit && !preLot) {
    return (
      <Screen>
        <Header title="Pre-lot" />
        <EmptyState icon="alert-circle-outline" title="Pre-lot not found" description="It may have been deleted." />
      </Screen>
    );
  }

  const errorFor = (key: keyof FormState) => (error?.key === key ? error.message : undefined);
  /** Changing either empties the basket: its stock belongs to the old commodity or group. */
  const changeScope = (key: 'commodity_id' | 'company_group_id', value: string) => {
    if (value === form[key]) return;
    if (form.lines.length > 0) toast.info('Allocations cleared', { description: 'They belonged to the previous choice.' });
    setForm((current) => ({ ...current, [key]: value, lines: [] }));
    if (error?.key === key) setError(null);
  };

  return (
    <Screen edges={['top']}>
      <Header
        title={preLot ? `Edit pre-lot ${preLot.prelot_no}` : 'New pre-lot'}
        subtitle="Reserve stock for processing"
      />

      <Body bottomOffset={130}>
        <Card>
          <SectionHeader title="Pre-lot" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Date" required>
              <DateField value={form.date} onChange={(value) => set('date', value)} />
            </Field>
            <Field
              label="Commodity"
              required
              error={errorFor('commodity_id')}
              hint={consumed ? 'Lots already use this pre-lot, so it stays as is' : undefined}
            >
              <Select
                value={form.commodity_id}
                options={lookups.commodityOptions}
                onChange={(value) => changeScope('commodity_id', value)}
                title="Commodity"
                disabled={consumed}
                error={Boolean(errorFor('commodity_id'))}
                onCreate={!consumed && can('commodity:create') ? () => router.push('/masters/commodity/new' as never) : undefined}
                createLabel="Add commodity"
              />
            </Field>
            <Field label="Company group" required error={errorFor('company_group_id')} hint="Only this group's stock can be reserved">
              <Select
                value={form.company_group_id}
                options={lookups.companyGroupOptions}
                onChange={(value) => changeScope('company_group_id', value)}
                title="Company group"
                disabled={consumed}
                error={Boolean(errorFor('company_group_id'))}
                onCreate={!consumed && can('company-group:create') ? () => router.push('/masters/company-group/new' as never) : undefined}
                createLabel="Add company group"
              />
            </Field>
          </View>
        </Card>

        <SectionHeader title="Stock to reserve" caption={`${form.lines.length} allocation${form.lines.length === 1 ? '' : 's'}`} />
        {errorFor('lines') && <Callout tone="danger" title={errorFor('lines')!} />}
        <StockLinesEditor
          sources={sources}
          lines={form.lines}
          onChange={(lines) => set('lines', lines)}
          withDate
          minDate={form.date}
          defaultDate={form.date}
          noun="allocation"
          sourcesLoading={ledger.isFetching && !ledger.data}
          emptyHint={
            form.commodity_id && form.company_group_id
              ? 'Pick the stock entries the lots will process.'
              : 'Choose a commodity and company group first.'
          }
        />

        <Field label="Remarks">
          <Input value={form.remarks} onChangeText={(value) => set('remarks', value)} multiline />
        </Field>
      </Body>

      <ActionBar
        summary={
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="caption" tone="muted" numeric>
              {formatNumber(totals.bags)} bags · {formatNumber(totals.weight, 2)} kg
            </Text>
            <Text variant="caption" tone="muted" numeric>
              {totals.weight ? `Avg ${formatCurrency(totals.value / totals.weight)}/kg` : ''}
            </Text>
          </View>
        }
      >
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button
          label={preLot ? 'Save changes' : 'Create pre-lot'}
          style={{ flex: 2 }}
          loading={create.isPending || update.isPending}
          onPress={submit}
        />
      </ActionBar>
    </Screen>
  );
}
