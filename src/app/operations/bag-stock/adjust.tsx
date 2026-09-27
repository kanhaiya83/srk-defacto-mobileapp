import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useBagStockSummary, useCreateBagStockManualEntry } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { DetailRow, Segmented } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { usePermissions } from '@/hooks/use-permissions';
import { formatNumber, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

type Status = 'EMPTY' | 'FILLED';
type Direction = 'add' | 'remove';

/**
 * A manual correction to bag stock. Adding or removing is a choice, not a
 * sign: phone number pads have no minus key.
 */
export default function BagStockAdjustScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { config } = useLocalSearchParams<{ config?: string }>();
  const lookups = useMasterLookups();
  const { can } = usePermissions();
  const summary = useBagStockSummary();
  const create = useCreateBagStockManualEntry();

  const [form, setForm] = useState({
    bag_type_config_id: config ?? '',
    status: 'EMPTY' as Status,
    direction: 'add' as Direction,
    qty: '' as number | '',
    date: today(),
    remarks: '',
  });
  const [error, setError] = useState<'bag_type_config_id' | 'qty' | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (error === key) setError(null);
  };

  const row = (summary.data ?? []).find((entry) => refId(entry.bag_type_config_id) === form.bag_type_config_id);
  const current = form.status === 'FILLED' ? (row?.filled_bags ?? 0) : (row?.empty_bags ?? 0);
  const qty = Math.floor(Number(form.qty || 0));
  const delta = form.direction === 'add' ? qty : -qty;
  const tooMany = form.direction === 'remove' && qty > current;
  const noun = form.status === 'FILLED' ? 'filled' : 'empty';

  const submit = async () => {
    if (!form.bag_type_config_id) {
      setError('bag_type_config_id');
      return toast.error('Select a bag configuration');
    }
    if (qty <= 0) {
      setError('qty');
      return toast.error('Enter how many bags');
    }
    if (tooMany) {
      setError('qty');
      return toast.error(`Only ${formatNumber(current)} ${noun} bags to remove`);
    }
    try {
      await create.mutateAsync({
        bag_type_config_id: form.bag_type_config_id,
        qty: delta,
        status: form.status,
        date: form.date,
        remarks: form.remarks.trim() || undefined,
      });
      toast.success(`${form.direction === 'add' ? 'Added' : 'Removed'} ${formatNumber(qty)} ${noun} bags`);
      router.back();
    } catch (err) {
      toast.error('Could not record the adjustment', { description: getErrorMessage(err) });
    }
  };

  return (
    <Screen edges={['top']}>
      <Header title="Adjust bag stock" subtitle="When a physical count differs" />

      <Body bottomOffset={120}>
        <Card>
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Bag configuration" required error={error === 'bag_type_config_id' ? 'Select a bag configuration' : undefined}>
              <Select
                value={form.bag_type_config_id}
                options={lookups.bagConfigOptions}
                onChange={(value) => set('bag_type_config_id', value)}
                title="Bag configuration"
                error={error === 'bag_type_config_id'}
                onCreate={can('bag-type-config:create') ? () => router.push('/masters/bag-type-config/new' as never) : undefined}
                createLabel="Add bag configuration"
              />
            </Field>
            <Field label="Bags">
              <Segmented<Status>
                value={form.status}
                onChange={(value) => set('status', value)}
                options={[
                  { value: 'EMPTY', label: 'Empty bags' },
                  { value: 'FILLED', label: 'Filled bags' },
                ]}
              />
            </Field>
            <Field label="Change">
              <Segmented<Direction>
                value={form.direction}
                onChange={(value) => set('direction', value)}
                options={[
                  { value: 'add', label: 'Add bags' },
                  { value: 'remove', label: 'Remove bags' },
                ]}
              />
            </Field>
            <Field
              label="Quantity"
              required
              error={error === 'qty' ? (tooMany ? `Only ${formatNumber(current)} to remove` : 'Enter how many bags') : undefined}
            >
              <NumberInput
                value={form.qty}
                keyboardType="number-pad"
                onChangeValue={(value) => set('qty', value === '' ? '' : Math.max(0, Math.floor(Number(value))))}
                suffix="bags"
                error={error === 'qty'}
              />
            </Field>
          </View>
        </Card>

        {!!form.bag_type_config_id && (
          <Card>
            <DetailRow label={`${noun[0].toUpperCase()}${noun.slice(1)} bags now`} value={formatNumber(current)} />
            <DetailRow
              label="After this"
              value={formatNumber(current + delta)}
              tone={current + delta < 0 ? 'danger' : 'default'}
              emphasis
            />
          </Card>
        )}

        <Field label="Date" required>
          <DateField value={form.date} onChange={(value) => set('date', value)} />
        </Field>
        <Field label="Remarks">
          <Input value={form.remarks} onChangeText={(value) => set('remarks', value)} placeholder="Reason for the adjustment" multiline />
        </Field>
      </Body>

      <ActionBar>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button label="Record adjustment" style={{ flex: 2 }} loading={create.isPending} onPress={submit} />
      </ActionBar>
    </Screen>
  );
}
