import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useCreateStockTransfer, useStockLedgerAll } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Field, Input } from '@/components/ui/field';
import { Callout } from '@/components/ui/misc';
import { Select, type Option } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { stockEntrySubtitle, stockEntryTitle } from '@/features/operations/prelot';
import { getStockBreakdown } from '@/features/operations/stock';
import { StockLinesEditor, lineTotals, type StockLine, type StockSource } from '@/features/operations/stock-lines';
import { usePermissions } from '@/hooks/use-permissions';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatNumber, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

/** Each entry keeps its own company unless one is chosen. */
const KEEP = '__keep__';
const NONE = '__none__';

interface FormState {
  group: string;
  date: string;
  lines: StockLine[];
  to_company_id: string;
  to_location_id: string;
  to_sub_location_id: string;
  remarks: string;
}

type ErrorKey = 'group' | 'lines' | 'to_location_id' | 'to_sub_location_id';

/**
 * New stock transfer. Stock moves within its company group — to another
 * location, sub-location or company of the group — so the group comes first
 * and only its stock is offered. Each entry moved becomes one transfer.
 */
export default function StockTransferFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const lookups = useMasterLookups();
  const { can } = usePermissions();
  const ledger = useStockLedgerAll();
  const create = useCreateStockTransfer();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ key: ErrorKey; message: string } | null>(null);

  const firstGroup = lookups.companyGroupOptions[0]?.value ?? '';
  const [form, setForm] = useSyncedState<FormState>(firstGroup ? 'new' : null, () => ({
    group: firstGroup,
    date: today(),
    lines: [],
    to_company_id: KEEP,
    to_location_id: '',
    to_sub_location_id: '',
    remarks: '',
  }));

  const set = <K extends keyof FormState>(key: K, value: FormState[K], patch: Partial<FormState> = {}) => {
    setForm((current) => ({ ...current, [key]: value, ...patch }));
    if (error?.key === key) setError(null);
  };

  const byId = useMemo(() => new Map((ledger.data ?? []).map((entry) => [entry._id, entry])), [ledger.data]);

  const sources = useMemo<StockSource[]>(
    () =>
      (ledger.data ?? [])
        .filter((entry) => refId(entry.company_group_id) === form.group)
        .map((entry) => ({ entry, available: getStockBreakdown(entry) }))
        .filter(({ available }) => available.available_bags > 0)
        .map(({ entry, available }) => ({
          id: entry._id,
          title: stockEntryTitle(entry.entry_no, entry.source_type),
          subtitle: [lookups.commodityName(refId(entry.commodity_id)), stockEntrySubtitle(entry, lookups)].filter(Boolean).join(' · '),
          capBags: available.available_bags,
          capWeight: available.available_weight,
          ratePerKg: entry.rate_per_kg,
        })),
    [ledger.data, form.group, lookups]
  );

  const group = lookups.raw.companyGroups.find((entry) => entry._id === form.group);
  const companyOptions = useMemo<Option[]>(
    () => [
      { value: KEEP, label: "Keep each entry's company", description: 'The company the stock is under now' },
      { value: NONE, label: 'No company', description: 'Held by the group as a whole' },
      ...lookups.companyOptions.filter((option) => group?.company_ids?.includes(option.value)),
    ],
    [group, lookups.companyOptions]
  );

  const totals = lineTotals(form.lines, sources);

  /** Lines that would land exactly where they already are. */
  const pointless = form.lines.filter((line) => {
    const entry = byId.get(line.sourceId);
    if (!entry || !form.to_location_id || !form.to_sub_location_id) return false;
    const sameCompany =
      form.to_company_id === KEEP ||
      (form.to_company_id === NONE ? !entry.company_id : refId(entry.company_id) === form.to_company_id);
    return refId(entry.location_id) === form.to_location_id && entry.sub_location_id === form.to_sub_location_id && sameCompany;
  });

  const validate = (): { key: ErrorKey; message: string } | null => {
    if (!form.group) return { key: 'group', message: 'Select the company group' };
    if (form.lines.length === 0) return { key: 'lines', message: 'Add the stock to move' };
    if (!form.to_location_id) return { key: 'to_location_id', message: 'Select where it goes' };
    if (!form.to_sub_location_id) return { key: 'to_sub_location_id', message: 'Select the sub-location' };
    if (pointless.length > 0) return { key: 'lines', message: 'Some stock is already at this location and company' };
    return null;
  };

  const submit = async () => {
    const failure = validate();
    if (failure) {
      setError(failure);
      toast.error(failure.message);
      return;
    }
    setSaving(true);
    let done = 0;
    try {
      for (const line of form.lines) {
        const entry = byId.get(line.sourceId);
        const company =
          form.to_company_id === KEEP ? refId(entry?.company_id) || undefined : form.to_company_id === NONE ? undefined : form.to_company_id;
        await create.mutateAsync({
          from_stock_ledger_id: line.sourceId,
          bags: line.bags,
          weight: line.weight,
          to_company_group_id: form.group,
          to_company_id: company,
          to_location_id: form.to_location_id,
          to_sub_location_id: form.to_sub_location_id,
          date: form.date,
          remarks: form.remarks.trim() || undefined,
        });
        done += 1;
      }
      toast.success(done === 1 ? 'Stock transferred' : `${done} transfers made`, {
        description: `${formatNumber(totals.bags)} bags moved`,
      });
      router.back();
    } catch (err) {
      // Transfers are made one by one; keep only the ones still to do.
      if (done > 0) setForm((current) => ({ ...current, lines: current.lines.slice(done) }));
      toast.error(done > 0 ? `${done} made, then one failed` : 'Could not transfer the stock', {
        description: getErrorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const errorFor = (key: ErrorKey) => (error?.key === key ? error.message : undefined);

  return (
    <Screen edges={['top']}>
      <Header title="New transfer" subtitle="Move stock within its company group" />

      <Body bottomOffset={130}>
        <Card>
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Company group" required error={errorFor('group')} hint="Transfers stay inside one group">
              <Select
                value={form.group}
                options={lookups.companyGroupOptions}
                onChange={(value) => {
                  if (value === form.group) return;
                  if (form.lines.length > 0) toast.info('Stock cleared', { description: 'It belonged to the previous group.' });
                  set('group', value, { lines: [], to_company_id: KEEP });
                }}
                title="Company group"
                error={Boolean(errorFor('group'))}
              />
            </Field>
            <Field label="Date" required>
              <DateField value={form.date} onChange={(value) => set('date', value)} />
            </Field>
          </View>
        </Card>

        <SectionHeader title="Stock to move" caption={`${form.lines.length} entr${form.lines.length === 1 ? 'y' : 'ies'}`} />
        {errorFor('lines') && <Callout tone="danger" title={errorFor('lines')!} />}
        <StockLinesEditor
          sources={sources}
          lines={form.lines}
          onChange={(lines) => set('lines', lines as FormState['lines'])}
          defaultDate={form.date}
          noun="stock entry"
          plural="stock entries"
          sourcesLoading={ledger.isLoading}
          emptyHint={sources.length ? 'Pick the stock entries to move.' : 'This group has no stock available to move.'}
        />

        <Card>
          <SectionHeader title="Destination" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Company">
              <Select
                value={form.to_company_id}
                options={companyOptions}
                onChange={(value) => set('to_company_id', value)}
                title="Destination company"
                onCreate={can('company:create') ? () => router.push('/masters/company/new' as never) : undefined}
                createLabel="Add company"
              />
            </Field>
            <Field label="Location" required error={errorFor('to_location_id')}>
              <Select
                value={form.to_location_id}
                options={lookups.locationOptions}
                onChange={(value) => set('to_location_id', value, { to_sub_location_id: '' })}
                title="Warehouse location"
                error={Boolean(errorFor('to_location_id'))}
                onCreate={can('warehouse-location:create') ? () => router.push('/masters/warehouse-location/new' as never) : undefined}
                createLabel="Add warehouse"
              />
            </Field>
            <Field label="Sub-location" required error={errorFor('to_sub_location_id')}>
              <Select
                value={form.to_sub_location_id}
                options={lookups.subLocationOptionsFor(form.to_location_id)}
                onChange={(value) => set('to_sub_location_id', value)}
                title="Sub-location"
                placeholder={form.to_location_id ? 'Select sub-location' : 'Pick a location first'}
                disabled={!form.to_location_id}
                error={Boolean(errorFor('to_sub_location_id'))}
              />
            </Field>
          </View>
        </Card>

        {pointless.length > 0 && (
          <Callout
            tone="warning"
            title="Nothing would move"
            description={`${pointless.map((line) => byId.get(line.sourceId)?.entry_no).join(', ')} already sit${pointless.length === 1 ? 's' : ''} here under the same company.`}
          />
        )}

        <Field label="Remarks">
          <Input value={form.remarks} onChangeText={(value) => set('remarks', value as string)} multiline placeholder="Optional" />
        </Field>
      </Body>

      <ActionBar
        summary={
          <Text variant="caption" tone="muted" numeric>
            {formatNumber(totals.bags)} bags · {formatNumber(totals.weight, 2)} kg
            {form.lines.length > 1 ? ` · ${form.lines.length} transfers` : ''}
          </Text>
        }
      >
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button label="Transfer" style={{ flex: 2 }} loading={saving} onPress={submit} />
      </ActionBar>
    </Screen>
  );
}
