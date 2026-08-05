import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  useCreatePreLot,
  useDeletePreLot,
  usePreLots,
  useStockLedgerAll,
  type PreLot,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Field, Input } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet, Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { AllocationPicker, type Allocation } from '@/features/operations/allocation-picker';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

/**
 * Pre-lot — reserving inward stock for processing.
 *
 * A pre-lot is a basket: pick a commodity, then pull bags from the batches that
 * hold it. The commodity is chosen first because it is what constrains every
 * subsequent choice, and locking it prevents a basket that no lot could consume.
 */
export default function PreLotScreen() {
  const theme = useTheme();
  const lookups = useMasterLookups();
  const list = usePreLots();
  const ledger = useStockLedgerAll();
  const create = useCreatePreLot();
  const remove = useDeletePreLot();
  const { canCreate, canDelete } = useModulePermissions('prelot');

  const [form, setForm] = useState<{
    date: string;
    commodity_id: string;
    company_group_id: string;
    allocations: Allocation[];
    remarks: string;
  } | null>(null);
  const [menuFor, setMenuFor] = useState<PreLot | null>(null);
  const [deleteFor, setDeleteFor] = useState<PreLot | null>(null);

  const preLots = list.data ?? [];
  const entries = useMemo(() => ledger.data ?? [], [ledger.data]);

  const submit = async () => {
    if (!form) return;
    if (!form.commodity_id) return toast.error('Select a commodity');
    if (form.allocations.length === 0) return toast.error('Allocate stock from at least one batch');

    try {
      await create.mutateAsync({
        date: form.date,
        commodity_id: form.commodity_id,
        company_group_id: form.company_group_id || undefined,
        allocations: form.allocations,
        remarks: form.remarks || undefined,
      } as Omit<PreLot, '_id' | 'prelot_no' | 'total_bags_allocated' | 'avg_input_rate' | 'createdAt' | 'updatedAt'>);
      toast.success('Pre-lot created');
      setForm(null);
    } catch (error) {
      toast.error('Could not create the pre-lot', { description: getErrorMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success('Pre-lot deleted', { description: 'The reserved stock is available again.' });
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete the pre-lot', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header title="Pre-Lot" subtitle={`${preLots.length} baskets of reserved stock`} />

      <ListBody<PreLot>
        items={preLots}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={(item) => [item.prelot_no, item.remarks, lookups.commodityName(refId(item.commodity_id))]}
        searchPlaceholder="Search pre-lot no…"
        emptyTitle="No pre-lots yet"
        emptyDescription="Reserve stock here before creating the lot that will consume it."
        emptyActionLabel={canCreate ? 'New pre-lot' : undefined}
        onEmptyAction={
          canCreate
            ? () => setForm({ date: today(), commodity_id: '', company_group_id: '', allocations: [], remarks: '' })
            : undefined
        }
        renderItem={(item) => (
          <RecordCard
            title={`Pre-lot ${item.prelot_no}`}
            subtitle={`${lookups.commodityName(refId(item.commodity_id))} · ${formatDate(item.date)}`}
            icon="albums-outline"
            fields={[
              { label: 'Bags reserved', value: formatNumber(item.total_bags_allocated), emphasis: true },
              { label: 'Batches', value: item.allocations?.length ?? 0 },
              { label: 'Group', value: item.company_group?.group_name },
              { label: 'Avg rate', value: item.avg_input_rate ? `₹${formatNumber(item.avg_input_rate, 2)}` : null },
            ]}
            onMenu={() => setMenuFor(item)}
          />
        )}
      />

      {canCreate && (
        <Fab
          label="Pre-lot"
          onPress={() => setForm({ date: today(), commodity_id: '', company_group_id: '', allocations: [], remarks: '' })}
        />
      )}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `Pre-lot ${menuFor.prelot_no}` : undefined}
        actions={[
          {
            label: 'Delete and release stock',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete,
            disabledReason: 'Your role cannot delete pre-lots',
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <Sheet
        open={form !== null}
        onClose={() => setForm(null)}
        title="New pre-lot"
        subtitle="Reserve stock for processing"
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setForm(null)} />
            <Button label="Create pre-lot" style={{ flex: 2 }} loading={create.isPending} onPress={submit} />
          </>
        }
      >
        {form && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Date" required style={{ flex: 1 }}>
                <DateField value={form.date} onChange={(date) => setForm({ ...form, date })} />
              </Field>
            </View>

            <Field label="Commodity" required hint="Locks once stock has been added">
              <Select
                value={form.commodity_id}
                options={lookups.commodityOptions}
                onChange={(commodity_id) => setForm({ ...form, commodity_id, allocations: [] })}
                title="Commodity"
                disabled={form.allocations.length > 0}
              />
            </Field>

            <Field label="Company group" hint="Optional — restricts which stock is offered">
              <Select
                value={form.company_group_id}
                options={lookups.companyGroupOptions}
                onChange={(company_group_id) => setForm({ ...form, company_group_id, allocations: [] })}
                title="Company group"
                placeholder="Any group"
                clearable
              />
            </Field>

            <Text variant="label" tone="muted">
              STOCK TO RESERVE
            </Text>

            <AllocationPicker
              entries={entries}
              allocations={form.allocations}
              onChange={(allocations) => setForm({ ...form, allocations })}
              filter={(entry) =>
                (!form.commodity_id || refId(entry.commodity_id) === form.commodity_id) &&
                (!form.company_group_id || refId(entry.company_group_id) === form.company_group_id)
              }
              emptyHint={form.commodity_id ? 'Pick the batches this lot will consume.' : 'Choose a commodity first.'}
            />

            <Field label="Remarks">
              <Input value={form.remarks} onChangeText={(remarks) => setForm({ ...form, remarks })} />
            </Field>
          </ScrollView>
        )}
      </Sheet>

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="Delete this pre-lot?"
        description={
          deleteFor
            ? `${formatNumber(deleteFor.total_bags_allocated)} reserved bags will return to available stock.`
            : undefined
        }
      />
    </Screen>
  );
}
