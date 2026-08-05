import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  useCancelStockTransfer,
  useCreateStockTransfer,
  useStockLedgerAll,
  useStockTransfers,
  type StockLedgerEntry,
  type StockTransfer,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { Callout, DetailRow } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet, Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { getStockBreakdown } from '@/features/operations/stock';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber, formatWeight, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

interface FormState {
  from_stock_ledger_id: string;
  bags: number | '';
  weight: number | '';
  to_company_group_id: string;
  to_company_id: string;
  to_location_id: string;
  to_sub_location_id: string;
  date: string;
  remarks: string;
}

const blank = (): FormState => ({
  from_stock_ledger_id: '',
  bags: '',
  weight: '',
  to_company_group_id: '',
  to_company_id: '',
  to_location_id: '',
  to_sub_location_id: '',
  date: today(),
  remarks: '',
});

/**
 * Stock transfers — moving a batch to another location, company or group.
 *
 * A transfer is never edited, only cancelled: the ledger movements it created
 * have to be reversed as a unit, so the screen offers exactly those two verbs.
 */
export default function StockTransferScreen() {
  const theme = useTheme();
  const lookups = useMasterLookups();
  const list = useStockTransfers();
  const ledger = useStockLedgerAll();
  const create = useCreateStockTransfer();
  const cancel = useCancelStockTransfer();
  const { canCreate, canUpdate } = useModulePermissions('stock-transfer');

  const [form, setForm] = useState<FormState | null>(null);
  const [menuFor, setMenuFor] = useState<StockTransfer | null>(null);
  const [cancelFor, setCancelFor] = useState<StockTransfer | null>(null);

  const transfers = list.data ?? [];

  /** Only batches with something left in them can be moved. */
  const sourceOptions = useMemo(
    () =>
      (ledger.data ?? [])
        .map((entry) => ({ entry, breakdown: getStockBreakdown(entry) }))
        .filter(({ breakdown }) => breakdown.available_bags > 0)
        .map(({ entry, breakdown }) => ({
          value: entry._id,
          label: `${entry.entry_no} · ${lookups.commodityName(refId(entry.commodity_id))} ${lookups.gradeName(refId(entry.grade_id))}`,
          description: `${formatNumber(breakdown.available_bags)} bags available · ${lookups.locationName(refId(entry.location_id))}`,
        })),
    [ledger.data, lookups]
  );

  const selectedBatch: StockLedgerEntry | undefined = (ledger.data ?? []).find(
    (entry) => entry._id === form?.from_stock_ledger_id
  );
  const availability = selectedBatch ? getStockBreakdown(selectedBatch) : null;

  const destinationGroupId = form?.to_company_group_id ?? '';
  const toCompanyOptions = useMemo(() => {
    if (!destinationGroupId) return [];
    const group = lookups.raw.companyGroups.find((entry) => entry._id === destinationGroupId);
    return lookups.companyOptions.filter((option) => group?.company_ids?.includes(option.value));
  }, [destinationGroupId, lookups]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const submit = async () => {
    if (!form) return;
    if (!form.from_stock_ledger_id) return toast.error('Select the batch to move');
    if (form.bags === '' || Number(form.bags) <= 0) return toast.error('Enter how many bags to move');
    if (availability && Number(form.bags) > availability.available_bags) {
      return toast.error(`Only ${formatNumber(availability.available_bags)} bags are available`);
    }
    if (!form.to_company_group_id) return toast.error('Select the destination company group');
    if (!form.to_location_id) return toast.error('Select the destination location');
    if (!form.to_sub_location_id) return toast.error('Select the destination sub-location');

    try {
      await create.mutateAsync({
        from_stock_ledger_id: form.from_stock_ledger_id,
        bags: Number(form.bags),
        weight: form.weight === '' ? undefined : Number(form.weight),
        to_company_group_id: form.to_company_group_id,
        to_company_id: form.to_company_id || undefined,
        to_location_id: form.to_location_id,
        to_sub_location_id: form.to_sub_location_id,
        date: form.date,
        remarks: form.remarks || undefined,
      });
      toast.success('Stock transferred', { description: `${formatNumber(Number(form.bags))} bags moved` });
      setForm(null);
    } catch (error) {
      toast.error('Could not transfer the stock', { description: getErrorMessage(error) });
    }
  };

  const doCancel = async () => {
    if (!cancelFor) return;
    try {
      await cancel.mutateAsync({ id: cancelFor._id, reason: 'Cancelled from mobile' });
      toast.success('Transfer cancelled', { description: 'The stock has been returned to its source batch.' });
      setCancelFor(null);
    } catch (error) {
      toast.error('Could not cancel the transfer', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header title="Stock Transfer" subtitle={`${transfers.length} transfers`} />

      <ListBody<StockTransfer>
        items={transfers}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={(item) => [item.transfer_no, item.remarks, item.status]}
        searchPlaceholder="Search transfer no…"
        emptyTitle="No transfers yet"
        emptyDescription="Move stock between locations, companies or groups without touching quantities."
        emptyActionLabel={canCreate ? 'New transfer' : undefined}
        onEmptyAction={canCreate ? () => setForm(blank()) : undefined}
        renderItem={(item) => (
          <RecordCard
            title={`Transfer ${item.transfer_no}`}
            subtitle={`${lookups.locationName(refId(item.from_location_id))} → ${lookups.locationName(refId(item.to_location_id))}`}
            badge={{
              label: item.status === 'ACTIVE' ? 'Active' : 'Cancelled',
              tone: item.status === 'ACTIVE' ? 'success' : 'neutral',
            }}
            accent={item.status === 'CANCELLED' ? 'neutral' : undefined}
            fields={[
              { label: 'Bags', value: formatNumber(item.bags), emphasis: true },
              { label: 'Weight', value: formatWeight(item.weight) },
              { label: 'Date', value: formatDate(item.date) },
              { label: 'To group', value: lookups.companyGroupName(refId(item.to_company_group_id)) },
            ]}
            onMenu={() => setMenuFor(item)}
          />
        )}
      />

      {canCreate && <Fab onPress={() => setForm(blank())} label="Transfer" />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `Transfer ${menuFor.transfer_no}` : undefined}
        actions={[
          {
            label: 'Cancel transfer',
            icon: 'close-circle-outline',
            tone: 'danger',
            disabled: !canUpdate || menuFor?.status !== 'ACTIVE',
            disabledReason: menuFor?.status === 'CANCELLED' ? 'Already cancelled' : 'Your role cannot cancel transfers',
            onPress: () => menuFor && setCancelFor(menuFor),
          },
        ]}
      />

      {/* ----------------------------------------------------------- create */}
      <Sheet
        open={form !== null}
        onClose={() => setForm(null)}
        title="Transfer stock"
        subtitle="Move a batch without changing what it is"
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setForm(null)} />
            <Button label="Transfer" style={{ flex: 2 }} loading={create.isPending} onPress={submit} />
          </>
        }
      >
        {form && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <Field label="Source batch" required>
              <Select
                value={form.from_stock_ledger_id}
                options={sourceOptions}
                onChange={(value) => set('from_stock_ledger_id', value)}
                title="Source batch"
                placeholder={sourceOptions.length ? 'Select a batch' : 'No stock available to move'}
              />
            </Field>

            {selectedBatch && availability && (
              <Callout
                tone="info"
                icon="cube-outline"
                title={`${formatNumber(availability.available_bags)} bags available`}
                description={`${formatWeight(availability.available_weight)} at ${lookups.locationName(refId(selectedBatch.location_id))} · ${lookups.subLocationName(refId(selectedBatch.location_id), selectedBatch.sub_location_id)}`}
              />
            )}

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Bags to move" required style={{ flex: 1 }}>
                <NumberInput
                  value={form.bags}
                  onChangeValue={(value) => set('bags', value)}
                  error={Boolean(availability && form.bags !== '' && Number(form.bags) > availability.available_bags)}
                />
              </Field>
              <Field label="Weight" hint="Optional" style={{ flex: 1 }}>
                <NumberInput value={form.weight} onChangeValue={(value) => set('weight', value)} suffix="kg" />
              </Field>
            </View>

            <Text variant="label" tone="muted">
              DESTINATION
            </Text>

            <Field label="Company group" required>
              <Select
                value={form.to_company_group_id}
                options={lookups.companyGroupOptions}
                onChange={(value) => {
                  set('to_company_group_id', value);
                  set('to_company_id', '');
                }}
                title="Destination company group"
              />
            </Field>

            <Field label="Company" hint="Optional">
              <Select
                value={form.to_company_id}
                options={toCompanyOptions}
                onChange={(value) => set('to_company_id', value)}
                title="Destination company"
                placeholder={form.to_company_group_id ? 'Any company in the group' : 'Pick a group first'}
                disabled={!form.to_company_group_id}
                clearable
              />
            </Field>

            <Field label="Location" required>
              <Select
                value={form.to_location_id}
                options={lookups.locationOptions}
                onChange={(value) => {
                  set('to_location_id', value);
                  set('to_sub_location_id', '');
                }}
                title="Destination location"
              />
            </Field>

            <Field label="Sub-location" required>
              <Select
                value={form.to_sub_location_id}
                options={lookups.subLocationOptionsFor(form.to_location_id)}
                onChange={(value) => set('to_sub_location_id', value)}
                title="Destination sub-location"
                placeholder={form.to_location_id ? 'Select sub-location' : 'Pick a location first'}
                disabled={!form.to_location_id}
              />
            </Field>

            <Field label="Date">
              <DateField value={form.date} onChange={(value) => set('date', value)} />
            </Field>

            <Field label="Remarks">
              <Input value={form.remarks} onChangeText={(value) => set('remarks', value)} placeholder="Why is this moving?" />
            </Field>
          </ScrollView>
        )}
      </Sheet>

      <ConfirmSheet
        open={cancelFor !== null}
        onClose={() => setCancelFor(null)}
        onConfirm={doCancel}
        loading={cancel.isPending}
        title="Cancel this transfer?"
        confirmLabel="Cancel transfer"
        description={
          cancelFor
            ? `${formatNumber(cancelFor.bags)} bags will be returned to the source batch and the ledger movements reversed.`
            : undefined
        }
      />
    </Screen>
  );
}
