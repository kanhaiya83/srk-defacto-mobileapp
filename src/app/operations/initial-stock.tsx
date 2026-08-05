import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  useCreateInitialStock,
  useDeleteInitialStock,
  useInitialStocks,
  useUpdateInitialStock,
  type InitialStockEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { Callout } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet, Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatCurrency, formatDate, formatNumber, refId, today } from '@/lib/format';
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

const blank = (): FormState => ({
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
});

/**
 * Initial stock — opening balances that seed the ledger.
 *
 * Once an opening entry has stock drawn against it its identity is frozen (the
 * ledger row already exists), so on edit everything but the quantities and
 * remarks is locked, exactly as the web form does.
 */
export default function InitialStockScreen() {
  const theme = useTheme();
  const router = useRouter();
  const lookups = useMasterLookups();
  const list = useInitialStocks();
  const create = useCreateInitialStock();
  const update = useUpdateInitialStock();
  const remove = useDeleteInitialStock();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('initial-stock');

  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<InitialStockEntry | null>(null);
  const [menuFor, setMenuFor] = useState<InitialStockEntry | null>(null);
  const [deleteFor, setDeleteFor] = useState<InitialStockEntry | null>(null);

  const entries = list.data ?? [];

  const search = useCallback(
    (entry: InitialStockEntry) => [
      entry.stock_no,
      lookups.commodityName(refId(entry.commodity_id)),
      lookups.gradeName(refId(entry.grade_id)),
      entry.remarks,
    ],
    [lookups]
  );

  /** Only the companies inside the chosen group may hold its stock. */
  const selectedGroupId = form?.company_group_id ?? '';
  const companyOptions = useMemo(() => {
    if (!selectedGroupId) return [];
    const group = lookups.raw.companyGroups.find((entry) => entry._id === selectedGroupId);
    return lookups.companyOptions.filter((option) => group?.company_ids?.includes(option.value));
  }, [selectedGroupId, lookups]);

  const openCreate = () => {
    setEditing(null);
    setForm(blank());
  };

  const openEdit = (entry: InitialStockEntry) => {
    setEditing(entry);
    setForm({
      date: entry.date ? String(entry.date).slice(0, 10) : today(),
      company_group_id: refId(entry.company_group_id),
      company_id: refId(entry.company_id),
      commodity_id: refId(entry.commodity_id),
      grade_id: refId(entry.grade_id),
      base_bag_type_id:
        lookups.raw.bagTypeConfigs.find((config) => config._id === refId(entry.bag_type_id))?.bag_type_id ?? '',
      bag_type_id: refId(entry.bag_type_id),
      location_id: refId(entry.location_id),
      sub_location_id: entry.sub_location_id,
      bags: entry.bags,
      weight: entry.weight,
      amount: entry.amount,
      remarks: entry.remarks ?? '',
    });
  };

  const submit = async () => {
    if (!form) return;
    if (!form.company_group_id) return toast.error('Company group is required');
    if (!form.commodity_id) return toast.error('Commodity is required');
    if (!form.grade_id) return toast.error('Grade is required');
    if (!form.bag_type_id) return toast.error('Bag configuration is required');
    if (!form.location_id) return toast.error('Location is required');
    if (!form.sub_location_id) return toast.error('Sub-location is required');
    if (form.bags === '' || Number(form.bags) <= 0) return toast.error('Bags must be greater than zero');
    if (form.weight === '' || Number(form.weight) <= 0) return toast.error('Weight must be greater than zero');
    if (form.amount === '' || Number(form.amount) < 0) return toast.error('Amount must be a valid number');

    const payload = {
      date: form.date,
      company_group_id: form.company_group_id,
      company_id: form.company_id || undefined,
      commodity_id: form.commodity_id,
      grade_id: form.grade_id,
      bag_type_id: form.bag_type_id,
      location_id: form.location_id,
      sub_location_id: form.sub_location_id,
      bags: Number(form.bags),
      weight: Number(form.weight),
      amount: Number(form.amount),
      remarks: form.remarks || undefined,
    };

    try {
      if (editing) {
        await update.mutateAsync({ id: editing._id, data: payload as Partial<InitialStockEntry> });
        toast.success('Opening stock updated');
      } else {
        await create.mutateAsync(payload as Omit<InitialStockEntry, '_id' | 'stock_no' | 'stock_ledger_id'>);
        toast.success('Opening stock recorded');
      }
      setForm(null);
      setEditing(null);
    } catch (error) {
      toast.error('Could not save the opening stock', { description: getErrorMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success('Opening stock deleted');
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete', { description: getErrorMessage(error) });
    }
  };

  const locked = Boolean(editing);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  return (
    <Screen>
      <Header title="Initial Stock" subtitle={`${entries.length} opening entries`} />

      <ListBody<InitialStockEntry>
        items={entries}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={search}
        searchPlaceholder="Search stock no, commodity…"
        emptyTitle="No opening stock recorded"
        emptyDescription="Seed the ledger with stock that existed before the system went live."
        emptyActionLabel={canCreate ? 'Add opening stock' : undefined}
        onEmptyAction={canCreate ? openCreate : undefined}
        renderItem={(item) => (
          <RecordCard
            title={`Stock ${item.stock_no}`}
            subtitle={`${lookups.commodityName(refId(item.commodity_id))} · ${lookups.gradeName(refId(item.grade_id))}`}
            icon="add-circle-outline"
            fields={[
              { label: 'Bags', value: formatNumber(item.bags), emphasis: true },
              { label: 'Weight', value: `${formatNumber(item.weight)} kg` },
              { label: 'Value', value: formatCurrency(item.amount) },
              { label: 'Date', value: formatDate(item.date) },
            ]}
            onPress={() => (canUpdate ? openEdit(item) : undefined)}
            onMenu={() => setMenuFor(item)}
          />
        )}
      />

      {canCreate && <Fab onPress={openCreate} label="Opening stock" />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `Stock ${menuFor.stock_no}` : undefined}
        actions={[
          {
            label: 'Edit quantities',
            icon: 'create-outline',
            disabled: !canUpdate,
            onPress: () => menuFor && openEdit(menuFor),
          },
          {
            label: 'View in inventory',
            icon: 'clipboard-outline',
            onPress: () => router.push('/operations/inventory'),
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete,
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <Sheet
        open={form !== null}
        onClose={() => {
          setForm(null);
          setEditing(null);
        }}
        title={editing ? `Edit stock ${editing.stock_no}` : 'Opening stock'}
        subtitle={editing ? 'Only quantities can be changed' : 'Stock that existed before go-live'}
        footer={
          <>
            <Button
              label="Cancel"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => {
                setForm(null);
                setEditing(null);
              }}
            />
            <Button
              label={editing ? 'Save' : 'Add stock'}
              style={{ flex: 2 }}
              loading={create.isPending || update.isPending}
              onPress={submit}
            />
          </>
        }
      >
        {form && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            {locked && (
              <Callout
                tone="info"
                title="Identity is locked"
                description="This entry already has a ledger row. Change the quantities or remarks only."
              />
            )}

            <Field label="Date" required>
              <DateField value={form.date} onChange={(value) => set('date', value)} disabled={locked} />
            </Field>

            <Field label="Company group" required>
              <Select
                value={form.company_group_id}
                options={lookups.companyGroupOptions}
                onChange={(value) => {
                  set('company_group_id', value);
                  set('company_id', '');
                }}
                title="Company group"
                disabled={locked}
              />
            </Field>

            <Field label="Company" hint="Optional — narrows the stock to one entity in the group">
              <Select
                value={form.company_id}
                options={companyOptions}
                onChange={(value) => set('company_id', value)}
                title="Company"
                placeholder={form.company_group_id ? 'Any company in the group' : 'Pick a group first'}
                disabled={locked || !form.company_group_id}
                clearable
              />
            </Field>

            <Field label="Commodity" required>
              <Select
                value={form.commodity_id}
                options={lookups.commodityOptions}
                onChange={(value) => {
                  set('commodity_id', value);
                  set('grade_id', '');
                }}
                title="Commodity"
                disabled={locked}
              />
            </Field>

            <Field label="Grade" required>
              <Select
                value={form.grade_id}
                options={lookups.gradeOptionsFor(form.commodity_id)}
                onChange={(value) => set('grade_id', value)}
                title="Grade"
                placeholder={form.commodity_id ? 'Select grade' : 'Pick a commodity first'}
                disabled={locked || !form.commodity_id}
              />
            </Field>

            <Field label="Bag type" required>
              <Select
                value={form.base_bag_type_id}
                options={lookups.bagTypeOptions}
                onChange={(value) => {
                  set('base_bag_type_id', value);
                  set('bag_type_id', '');
                }}
                title="Bag type"
                disabled={locked}
              />
            </Field>

            <Field label="Bag configuration" required>
              <Select
                value={form.bag_type_id}
                options={lookups.bagConfigOptionsFor(form.base_bag_type_id)}
                onChange={(value) => set('bag_type_id', value)}
                title="Bag configuration"
                placeholder={form.base_bag_type_id ? 'Select configuration' : 'Pick a bag type first'}
                disabled={locked || !form.base_bag_type_id}
              />
            </Field>

            <Field label="Location" required>
              <Select
                value={form.location_id}
                options={lookups.locationOptions}
                onChange={(value) => {
                  set('location_id', value);
                  set('sub_location_id', '');
                }}
                title="Location"
                disabled={locked}
              />
            </Field>

            <Field label="Sub-location" required>
              <Select
                value={form.sub_location_id}
                options={lookups.subLocationOptionsFor(form.location_id)}
                onChange={(value) => set('sub_location_id', value)}
                title="Sub-location"
                placeholder={form.location_id ? 'Select sub-location' : 'Pick a location first'}
                disabled={locked || !form.location_id}
              />
            </Field>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Bags" required style={{ flex: 1 }}>
                <NumberInput value={form.bags} onChangeValue={(value) => set('bags', value)} />
              </Field>
              <Field label="Weight" required style={{ flex: 1 }}>
                <NumberInput value={form.weight} onChangeValue={(value) => set('weight', value)} suffix="kg" />
              </Field>
            </View>

            <Field label="Value" required hint="Total value of this opening stock">
              <NumberInput value={form.amount} onChangeValue={(value) => set('amount', value)} suffix="₹" />
            </Field>

            <Field label="Remarks">
              <Input value={form.remarks} onChangeText={(value) => set('remarks', value)} />
            </Field>
          </ScrollView>
        )}
      </Sheet>

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="Delete this opening stock?"
        description={
          deleteFor
            ? `Stock ${deleteFor.stock_no} (${formatNumber(deleteFor.bags)} bags) and its ledger row will be removed.`
            : undefined
        }
      />
    </Screen>
  );
}
