import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import {
  useBagStockManualEntries,
  useBagStockSummary,
  useCreateBagStockManualEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Fab } from '@/components/list-screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { DetailRow, Segmented, StatTile } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber, refId } from '@/lib/format';
import { useTheme } from '@/theme';

type Tab = 'summary' | 'entries';

/**
 * Bag stock — how many bags of each configuration are filled and how many are
 * empty, plus the manual corrections that adjust those counts.
 */
export default function BagStockScreen() {
  const theme = useTheme();
  const lookups = useMasterLookups();
  const summary = useBagStockSummary();
  const manual = useBagStockManualEntries();
  const create = useCreateBagStockManualEntry();
  const { canCreate } = useModulePermissions('bag-stock');

  const [tab, setTab] = useState<Tab>('summary');
  const [form, setForm] = useState<{
    bag_type_config_id: string;
    qty: number | '';
    status: 'FILLED' | 'EMPTY';
    date: string;
    remarks: string;
  } | null>(null);

  const rows = summary.data ?? [];

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({ filled: acc.filled + (row.filled_bags || 0), empty: acc.empty + (row.empty_bags || 0) }),
        { filled: 0, empty: 0 }
      ),
    [rows]
  );

  const submit = async () => {
    if (!form) return;
    if (!form.bag_type_config_id) return toast.error('Select a bag configuration');
    if (form.qty === '' || Number(form.qty) === 0) return toast.error('Enter a quantity');

    try {
      await create.mutateAsync({
        bag_type_config_id: form.bag_type_config_id,
        qty: Number(form.qty),
        status: form.status,
        date: form.date,
        remarks: form.remarks || undefined,
      });
      toast.success('Adjustment recorded');
      setForm(null);
    } catch (error) {
      toast.error('Could not record the adjustment', { description: getErrorMessage(error) });
    }
  };

  if (summary.isLoading) {
    return (
      <Screen>
        <Header title="Bag Stock" />
        <ListSkeleton rows={4} />
      </Screen>
    );
  }

  if (summary.isError) {
    return (
      <Screen>
        <Header title="Bag Stock" />
        <ErrorState message={getErrorMessage(summary.error)} onRetry={() => void summary.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Bag Stock" subtitle="Filled and empty bags on hand" />

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={summary.isRefetching || manual.isRefetching}
            onRefresh={() => {
              void summary.refetch();
              void manual.refetch();
            }}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <StatTile label="Filled bags" value={formatNumber(totals.filled)} icon="cube" tone="success" />
          <StatTile label="Empty bags" value={formatNumber(totals.empty)} icon="cube-outline" tone="neutral" />
        </View>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'summary', label: 'By configuration', count: rows.length },
            { value: 'entries', label: 'Adjustments', count: manual.data?.length ?? 0 },
          ]}
        />

        {tab === 'summary' && rows.length === 0 && (
          <EmptyState icon="archive-outline" title="No bag stock yet" description="Bag counts build up as goods are received and dispatched." />
        )}

        {tab === 'summary' &&
          rows.map((row) => {
            const configId = refId(row.bag_type_config_id);
            return (
              <Card key={row._id}>
                <SectionHeader title={lookups.bagConfigName(configId)} />
                <DetailRow label="Filled" value={formatNumber(row.filled_bags)} emphasis tone="success" />
                <DetailRow label="Empty" value={formatNumber(row.empty_bags)} />
                <DetailRow label="Total" value={formatNumber((row.filled_bags || 0) + (row.empty_bags || 0))} />
              </Card>
            );
          })}

        {tab === 'entries' && (manual.data ?? []).length === 0 && (
          <EmptyState
            icon="create-outline"
            title="No manual adjustments"
            description="Record a correction when a physical count differs from the system."
          />
        )}

        {tab === 'entries' &&
          (manual.data ?? []).map((entry) => (
            <Card key={entry._id}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{lookups.bagConfigName(refId(entry.bag_type_config_id))}</Text>
                  <Text variant="caption" tone="muted">
                    {formatDate(entry.date)}
                  </Text>
                </View>
                <Badge label={entry.status} tone={entry.status === 'FILLED' ? 'success' : 'neutral'} />
              </View>
              <DetailRow label="Quantity" value={formatNumber(entry.qty)} emphasis />
              {!!entry.remarks && <DetailRow label="Remarks" value={entry.remarks} />}
            </Card>
          ))}
      </ScrollView>

      {canCreate && (
        <Fab
          icon="create-outline"
          label="Adjust"
          onPress={() =>
            setForm({ bag_type_config_id: '', qty: '', status: 'EMPTY', date: new Date().toISOString().slice(0, 10), remarks: '' })
          }
        />
      )}

      <Sheet
        open={form !== null}
        onClose={() => setForm(null)}
        title="Manual bag adjustment"
        subtitle="Use a negative quantity to reduce the count"
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setForm(null)} />
            <Button label="Record" style={{ flex: 2 }} loading={create.isPending} onPress={submit} />
          </>
        }
      >
        {form && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <Field label="Bag configuration" required>
              <Select
                value={form.bag_type_config_id}
                options={lookups.bagConfigOptions}
                onChange={(value) => setForm({ ...form, bag_type_config_id: value })}
                title="Bag configuration"
              />
            </Field>

            <Field label="Status" required>
              <Segmented<'FILLED' | 'EMPTY'>
                value={form.status}
                onChange={(status) => setForm({ ...form, status })}
                options={[
                  { value: 'EMPTY', label: 'Empty bags' },
                  { value: 'FILLED', label: 'Filled bags' },
                ]}
              />
            </Field>

            <Field label="Quantity" required hint="Negative reduces the count">
              <NumberInput value={form.qty} onChangeValue={(value) => setForm({ ...form, qty: value })} />
            </Field>

            <Field label="Date" required>
              <DateField value={form.date} onChange={(value) => setForm({ ...form, date: value })} />
            </Field>

            <Field label="Remarks">
              <Input
                value={form.remarks}
                onChangeText={(value) => setForm({ ...form, remarks: value })}
                placeholder="Reason for the adjustment"
              />
            </Field>
          </ScrollView>
        )}
      </Sheet>
    </Screen>
  );
}
