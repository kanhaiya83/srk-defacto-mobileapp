import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useCreateInitialStock, useInitialStocks, useUpdateInitialStock, type InitialStockEntry } from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { EmptyState, Loading } from '@/components/ui/feedback';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { Callout } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { initialStockUsed } from '@/features/operations/stock';
import { usePermissions } from '@/hooks/use-permissions';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatCurrency, formatNumber, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

interface FormState {
  date: string;
  company_group_id: string;
  company_id: string;
  commodity_id: string;
  grade_id: string;
  base_bag_type_id: string;
  bag_type_id: string;
  location_id: string;
  sub_location_id: string;
  bags: number | '';
  weight: number | '';
  amount: number | '';
  remarks: string;
}

type ErrorKey = keyof FormState;

/**
 * Opening stock — create and edit. What the stock is and where it sits is set
 * once; afterwards only the quantities and remarks change, and never below
 * what has already been drawn from it.
 */
export default function InitialStockFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const lookups = useMasterLookups();
  const { can } = usePermissions();
  const list = useInitialStocks();
  const create = useCreateInitialStock();
  const update = useUpdateInitialStock();
  const [error, setError] = useState<{ key: ErrorKey; message: string } | null>(null);

  const entry = id ? (list.data ?? []).find((row) => row._id === id) : undefined;
  const configs = lookups.raw.bagTypeConfigs;

  const [form, setForm] = useSyncedState<FormState>(id ? (entry && configs.length ? entry._id : null) : 'new', () =>
    entry
      ? {
          date: entry.date ? String(entry.date).slice(0, 10) : today(),
          company_group_id: refId(entry.company_group_id),
          company_id: refId(entry.company_id),
          commodity_id: refId(entry.commodity_id),
          grade_id: refId(entry.grade_id),
          base_bag_type_id: configs.find((config) => config._id === refId(entry.bag_type_id))?.bag_type_id ?? '',
          bag_type_id: refId(entry.bag_type_id),
          location_id: refId(entry.location_id),
          sub_location_id: entry.sub_location_id,
          bags: entry.bags,
          weight: entry.weight,
          amount: entry.amount,
          remarks: entry.remarks ?? '',
        }
      : {
          date: today(),
          company_group_id: '',
          company_id: '',
          commodity_id: '',
          grade_id: '',
          base_bag_type_id: '',
          bag_type_id: '',
          location_id: '',
          sub_location_id: '',
          bags: '',
          weight: '',
          amount: '',
          remarks: '',
        }
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K], patch: Partial<FormState> = {}) => {
    setForm((current) => ({ ...current, [key]: value, ...patch }));
    if (error?.key === key) setError(null);
  };

  const companyOptions = useMemo(() => {
    const group = lookups.raw.companyGroups.find((row) => row._id === form.company_group_id);
    return lookups.companyOptions.filter((option) => group?.company_ids?.includes(option.value));
  }, [form.company_group_id, lookups]);

  const used = entry ? initialStockUsed(entry) : { bags: 0, weight: 0 };
  const locked = Boolean(entry);
  const bags = Number(form.bags || 0);
  const weight = Number(form.weight || 0);
  const amount = Number(form.amount || 0);

  const createMaster = (module: string) =>
    !locked && can(`${module}:create`) ? () => router.push(`/masters/${module}/new` as never) : undefined;

  const validate = (): { key: ErrorKey; message: string } | null => {
    if (!locked) {
      if (!form.commodity_id) return { key: 'commodity_id', message: 'Select a commodity' };
      if (!form.grade_id) return { key: 'grade_id', message: 'Select a grade' };
      if (!form.bag_type_id) return { key: 'bag_type_id', message: 'Select a bag configuration' };
      if (!form.company_group_id) return { key: 'company_group_id', message: 'Select a company group' };
      if (!form.location_id) return { key: 'location_id', message: 'Select a location' };
      if (!form.sub_location_id) return { key: 'sub_location_id', message: 'Select a sub-location' };
    }
    if (!(bags > 0)) return { key: 'bags', message: 'Enter the number of bags' };
    if (bags < used.bags) return { key: 'bags', message: `${formatNumber(used.bags)} bags are already used` };
    if (!(weight > 0)) return { key: 'weight', message: 'Enter the total weight' };
    if (weight + 0.01 < used.weight) return { key: 'weight', message: `${formatNumber(used.weight, 2)} kg is already used` };
    if (form.amount === '' || amount < 0) return { key: 'amount', message: 'Enter the total amount' };
    return null;
  };

  const submit = async () => {
    const failure = validate();
    if (failure) {
      setError(failure);
      toast.error(failure.message);
      return;
    }
    try {
      if (entry) {
        await update.mutateAsync({
          id: entry._id,
          data: { bags, weight, amount, remarks: form.remarks } as Partial<InitialStockEntry>,
        });
        toast.success(`IS-${entry.stock_no} updated`);
      } else {
        await create.mutateAsync({
          date: form.date,
          company_group_id: form.company_group_id,
          company_id: form.company_id || undefined,
          commodity_id: form.commodity_id,
          grade_id: form.grade_id,
          bag_type_id: form.bag_type_id,
          location_id: form.location_id,
          sub_location_id: form.sub_location_id,
          bags,
          weight,
          amount,
          remarks: form.remarks || undefined,
        } as Omit<InitialStockEntry, '_id' | 'stock_no' | 'stock_ledger_id'>);
        toast.success('Opening stock recorded', { description: `${formatNumber(bags)} bags added to stock` });
      }
      router.back();
    } catch (err) {
      toast.error('Could not save the opening stock', { description: getErrorMessage(err) });
    }
  };

  if (id && list.isLoading) {
    return (
      <Screen>
        <Header title="Opening stock" />
        <Loading label="Loading…" />
      </Screen>
    );
  }
  if (id && !entry) {
    return (
      <Screen>
        <Header title="Opening stock" />
        <EmptyState icon="alert-circle-outline" title="Entry not found" description="It may have been deleted." />
      </Screen>
    );
  }

  const errorFor = (key: ErrorKey) => (error?.key === key ? error.message : undefined);

  return (
    <Screen edges={['top']}>
      <Header
        title={entry ? `Edit IS-${entry.stock_no}` : 'New opening stock'}
        subtitle={entry ? 'Only quantities and remarks can change' : 'Stock held before the system went live'}
      />

      <Body bottomOffset={130}>
        {used.bags > 0 && (
          <Callout
            tone="info"
            title={`${formatNumber(used.bags)} bags already used`}
            description="Bags and weight cannot go below what has been drawn from this entry."
          />
        )}

        <Card>
          <SectionHeader title="Stock" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Commodity" required error={errorFor('commodity_id')}>
              <Select
                value={form.commodity_id}
                options={lookups.commodityOptions}
                onChange={(value) => set('commodity_id', value, { grade_id: '' })}
                title="Commodity"
                disabled={locked}
                error={Boolean(errorFor('commodity_id'))}
                onCreate={createMaster('commodity')}
                createLabel="Add commodity"
              />
            </Field>
            <Field label="Grade" required error={errorFor('grade_id')}>
              <Select
                value={form.grade_id}
                options={lookups.gradeOptionsFor(form.commodity_id)}
                onChange={(value) => set('grade_id', value)}
                title="Grade"
                placeholder={form.commodity_id ? 'Select grade' : 'Pick a commodity first'}
                disabled={locked || !form.commodity_id}
                error={Boolean(errorFor('grade_id'))}
                onCreate={createMaster('grade')}
                createLabel="Add grade"
              />
            </Field>
            <Field label="Bag type" required>
              <Select
                value={form.base_bag_type_id}
                options={lookups.bagTypeOptions}
                onChange={(value) => set('base_bag_type_id', value, { bag_type_id: '' })}
                title="Bag type"
                disabled={locked}
                onCreate={createMaster('bag-type')}
                createLabel="Add bag type"
              />
            </Field>
            <Field label="Bag configuration" required error={errorFor('bag_type_id')}>
              <Select
                value={form.bag_type_id}
                options={lookups.bagConfigOptionsFor(form.base_bag_type_id)}
                onChange={(value) => set('bag_type_id', value)}
                title="Bag configuration"
                placeholder={form.base_bag_type_id ? 'Select configuration' : 'Pick a bag type first'}
                disabled={locked || !form.base_bag_type_id}
                error={Boolean(errorFor('bag_type_id'))}
                onCreate={createMaster('bag-type-config')}
                createLabel="Add bag configuration"
              />
            </Field>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Held by" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Company group" required error={errorFor('company_group_id')}>
              <Select
                value={form.company_group_id}
                options={lookups.companyGroupOptions}
                onChange={(value) => set('company_group_id', value, { company_id: '' })}
                title="Company group"
                disabled={locked}
                error={Boolean(errorFor('company_group_id'))}
                onCreate={createMaster('company-group')}
                createLabel="Add company group"
              />
            </Field>
            <Field label="Company" hint="Optional — leave empty for the group as a whole">
              <Select
                value={form.company_id}
                options={companyOptions}
                onChange={(value) => set('company_id', value)}
                title="Company"
                placeholder={form.company_group_id ? 'Whole group' : 'Pick a group first'}
                disabled={locked || !form.company_group_id}
                clearable
              />
            </Field>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Stored at" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Location" required error={errorFor('location_id')}>
              <Select
                value={form.location_id}
                options={lookups.locationOptions}
                onChange={(value) => set('location_id', value, { sub_location_id: '' })}
                title="Warehouse location"
                disabled={locked}
                error={Boolean(errorFor('location_id'))}
                onCreate={createMaster('warehouse-location')}
                createLabel="Add warehouse"
              />
            </Field>
            <Field label="Sub-location" required error={errorFor('sub_location_id')}>
              <Select
                value={form.sub_location_id}
                options={lookups.subLocationOptionsFor(form.location_id)}
                onChange={(value) => set('sub_location_id', value)}
                title="Sub-location"
                placeholder={form.location_id ? 'Select sub-location' : 'Pick a location first'}
                disabled={locked || !form.location_id}
                error={Boolean(errorFor('sub_location_id'))}
              />
            </Field>
            <Field label="Date" required>
              <DateField value={form.date} onChange={(value) => set('date', value)} disabled={locked} />
            </Field>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Quantity and value" />
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Bags" required error={errorFor('bags')} style={{ flex: 1 }}>
                <NumberInput
                  value={form.bags}
                  keyboardType="number-pad"
                  onChangeValue={(value) => set('bags', value === '' ? '' : Math.max(0, Math.floor(Number(value))))}
                  error={Boolean(errorFor('bags'))}
                />
              </Field>
              <Field label="Total weight" required error={errorFor('weight')} style={{ flex: 1.3 }}>
                <NumberInput value={form.weight} onChangeValue={(value) => set('weight', value)} suffix="kg" error={Boolean(errorFor('weight'))} />
              </Field>
            </View>
            <Field label="Total amount" required error={errorFor('amount')}>
              <NumberInput value={form.amount} onChangeValue={(value) => set('amount', value)} suffix="₹" error={Boolean(errorFor('amount'))} />
            </Field>
            <Text variant="caption" tone="muted" numeric>
              {[
                bags && weight ? `${formatNumber(weight / bags, 2)} kg/bag` : null,
                weight && form.amount !== '' ? `${formatCurrency(amount / weight)}/kg` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Weight per bag and rate appear here'}
            </Text>
          </View>
        </Card>

        <Field label="Remarks">
          <Input value={form.remarks} onChangeText={(value) => set('remarks', value)} multiline placeholder="Optional" />
        </Field>
      </Body>

      <ActionBar>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button
          label={entry ? 'Save changes' : 'Add to stock'}
          style={{ flex: 2 }}
          loading={create.isPending || update.isPending}
          onPress={submit}
        />
      </ActionBar>
    </Screen>
  );
}
