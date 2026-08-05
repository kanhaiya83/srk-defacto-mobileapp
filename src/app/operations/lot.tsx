import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  useCompleteLot,
  useCreateLot,
  useDeleteLot,
  useLots,
  usePreLots,
  useStockLedgerAll,
  useUpdateLot,
  type Lot,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, Fab, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Field, Input } from '@/components/ui/field';
import { Callout, DetailRow } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet, Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { AllocationPicker, type Allocation } from '@/features/operations/allocation-picker';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber, formatWeight, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

type Filter = 'open' | 'complete' | 'all';

/**
 * Lot input — consuming pre-lot stock on a machine.
 *
 * Inputs are drawn only from the batches the chosen pre-lot reserved, so the
 * picker is filtered to that basket. Completing a lot is irreversible and
 * closes the machine, so it is confirmed separately from saving.
 */
export default function LotScreen() {
  const theme = useTheme();
  const lookups = useMasterLookups();
  const list = useLots();
  const preLots = usePreLots();
  const ledger = useStockLedgerAll();
  const create = useCreateLot();
  const update = useUpdateLot();
  const complete = useCompleteLot();
  const remove = useDeleteLot();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('lot');

  const [filter, setFilter] = useState<Filter>('open');
  const [form, setForm] = useState<{
    id?: string;
    date: string;
    prelot_id: string;
    machine_id: string;
    inputs: Allocation[];
    remarks: string;
  } | null>(null);
  const [menuFor, setMenuFor] = useState<Lot | null>(null);
  const [deleteFor, setDeleteFor] = useState<Lot | null>(null);
  const [completeFor, setCompleteFor] = useState<Lot | null>(null);

  const lots = list.data ?? [];
  const openCount = lots.filter((lot) => !lot.is_complete).length;

  const filtered = useMemo(() => {
    if (filter === 'all') return lots;
    return lots.filter((lot) => (filter === 'complete' ? lot.is_complete : !lot.is_complete));
  }, [lots, filter]);

  const selectedPreLot = (preLots.data ?? []).find((preLot) => preLot._id === form?.prelot_id);

  /** Batches this pre-lot reserved — the only stock a lot may consume. */
  const eligibleLedgerIds = useMemo(
    () => new Set((selectedPreLot?.allocations ?? []).map((allocation) => refId(allocation.stock_ledger_id))),
    [selectedPreLot]
  );

  const openCreate = () =>
    setForm({ date: today(), prelot_id: '', machine_id: '', inputs: [], remarks: '' });

  const openEdit = (lot: Lot) =>
    setForm({
      id: lot._id,
      date: lot.date ? String(lot.date).slice(0, 10) : today(),
      prelot_id: refId(lot.prelot_id),
      machine_id: refId(lot.machine_id),
      inputs: (lot.inputs ?? []).map((input) => ({
        stock_ledger_id: refId(input.stock_ledger_id),
        bags_allocated: input.bags_consumed,
        allocated_weight: input.consumed_weight,
      })),
      remarks: lot.remarks ?? '',
    });

  const submit = async () => {
    if (!form) return;
    if (!form.prelot_id) return toast.error('Select a pre-lot');
    if (!form.machine_id) return toast.error('Select a machine');
    if (form.inputs.length === 0) return toast.error('Add at least one input');
    if (selectedPreLot?.date && new Date(form.date) < new Date(String(selectedPreLot.date).slice(0, 10))) {
      return toast.error(`Lot date cannot be before the pre-lot date (${formatDate(selectedPreLot.date)})`);
    }

    const inputs = form.inputs.map((input) => ({
      stock_ledger_id: input.stock_ledger_id,
      bags_consumed: input.bags_allocated,
      consumed_weight: input.allocated_weight,
      date: form.date,
    }));

    try {
      if (form.id) {
        await update.mutateAsync({
          id: form.id,
          data: { date: form.date, inputs, remarks: form.remarks, machine_id: form.machine_id },
        });
        toast.success('Lot updated');
      } else {
        await create.mutateAsync({
          date: form.date,
          prelot_id: form.prelot_id,
          commodity_id: refId(selectedPreLot?.commodity_id),
          machine_id: form.machine_id,
          inputs,
          outputs: [],
          waste_bags: 0,
          is_complete: false,
          remarks: form.remarks,
        } as unknown as Parameters<typeof create.mutateAsync>[0]);
        toast.success('Lot created', { description: 'Record its output next.' });
      }
      setForm(null);
    } catch (error) {
      toast.error(form.id ? 'Could not update the lot' : 'Could not create the lot', {
        description: getErrorMessage(error),
      });
    }
  };

  const doComplete = async () => {
    if (!completeFor) return;
    try {
      await complete.mutateAsync(completeFor._id);
      toast.success(`Lot ${completeFor.lot_no} completed`);
      setCompleteFor(null);
    } catch (error) {
      toast.error('Could not complete the lot', { description: getErrorMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success('Lot deleted');
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete the lot', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header title="Lot Input" subtitle={openCount > 0 ? `${openCount} lots in progress` : 'No lots running'} />

      <ListBody<Lot, Filter>
        items={filtered}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={(item) => [item.lot_no, item.remarks, lookups.commodityName(refId(item.commodity_id))]}
        searchPlaceholder="Search lot no…"
        filters={[
          { value: 'open', label: 'In progress', count: openCount },
          { value: 'complete', label: 'Complete', count: lots.length - openCount },
          { value: 'all', label: 'All', count: lots.length },
        ]}
        filterValue={filter}
        onFilterChange={setFilter}
        emptyTitle="No lots yet"
        emptyDescription="A lot consumes reserved pre-lot stock and produces graded output."
        emptyActionLabel={canCreate ? 'New lot' : undefined}
        onEmptyAction={canCreate ? openCreate : undefined}
        renderItem={(item) => (
          <RecordCard
            title={`Lot ${item.lot_no}`}
            subtitle={`${lookups.commodityName(refId(item.commodity_id))} · ${lookups.machineName(refId(item.machine_id))}`}
            badge={{
              label: item.is_complete ? 'Complete' : 'In progress',
              tone: item.is_complete ? 'success' : 'warning',
            }}
            accent={item.is_complete ? undefined : 'warning'}
            fields={[
              { label: 'Input bags', value: formatNumber(item.total_input_bags) },
              { label: 'Output bags', value: formatNumber(item.total_output_bags), emphasis: true },
              { label: 'Waste', value: formatNumber(item.waste_bags) },
              { label: 'Date', value: formatDate(item.date) },
            ]}
            onPress={() => (canUpdate ? openEdit(item) : undefined)}
            onMenu={() => setMenuFor(item)}
          />
        )}
      />

      {canCreate && <Fab label="New lot" onPress={openCreate} />}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `Lot ${menuFor.lot_no}` : undefined}
        actions={[
          {
            label: menuFor?.is_complete ? 'View inputs' : 'Edit inputs',
            icon: 'create-outline',
            disabled: !canUpdate,
            onPress: () => menuFor && openEdit(menuFor),
          },
          {
            label: 'Complete lot',
            icon: 'checkmark-done-outline',
            disabled: !canUpdate || Boolean(menuFor?.is_complete),
            disabledReason: 'Already complete',
            onPress: () => menuFor && setCompleteFor(menuFor),
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete || Boolean(menuFor?.is_complete),
            disabledReason: 'A completed lot cannot be deleted',
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <Sheet
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit lot' : 'New lot'}
        subtitle="Stock consumed by this run"
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setForm(null)} />
            <Button
              label={form?.id ? 'Save lot' : 'Create lot'}
              style={{ flex: 2 }}
              loading={create.isPending || update.isPending}
              onPress={submit}
            />
          </>
        }
      >
        {form && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <Field label="Pre-lot" required hint="Locks once the lot exists">
              <Select
                value={form.prelot_id}
                options={(preLots.data ?? []).map((preLot) => ({
                  value: preLot._id,
                  label: `Pre-lot ${preLot.prelot_no}`,
                  description: `${lookups.commodityName(refId(preLot.commodity_id))} · ${formatNumber(preLot.total_bags_allocated)} bags reserved`,
                }))}
                onChange={(prelot_id) => setForm({ ...form, prelot_id, inputs: [] })}
                title="Pre-lot"
                disabled={Boolean(form.id)}
              />
            </Field>

            <Field label="Machine" required>
              <Select
                value={form.machine_id}
                options={lookups.machineOptions}
                onChange={(machine_id) => setForm({ ...form, machine_id })}
                title="Machine"
              />
            </Field>

            <Field label="Date" required>
              <DateField value={form.date} onChange={(date) => setForm({ ...form, date })} />
            </Field>

            {selectedPreLot && (
              <Callout
                tone="info"
                icon="albums-outline"
                title={`Pre-lot ${selectedPreLot.prelot_no}`}
                description={`${formatNumber(selectedPreLot.total_bags_allocated)} bags reserved across ${selectedPreLot.allocations?.length ?? 0} batches`}
              />
            )}

            <Text variant="label" tone="muted">
              INPUTS
            </Text>

            <AllocationPicker
              entries={(ledger.data ?? []).filter((entry) => eligibleLedgerIds.has(entry._id))}
              allocations={form.inputs}
              onChange={(inputs) => setForm({ ...form, inputs })}
              emptyHint={
                form.prelot_id ? 'Pull the bags this run will consume.' : 'Choose a pre-lot first — it decides what is available.'
              }
            />

            <Field label="Remarks">
              <Input value={form.remarks} onChangeText={(remarks) => setForm({ ...form, remarks })} />
            </Field>
          </ScrollView>
        )}
      </Sheet>

      <ConfirmSheet
        open={completeFor !== null}
        onClose={() => setCompleteFor(null)}
        onConfirm={doComplete}
        loading={complete.isPending}
        tone="primary"
        confirmLabel="Complete lot"
        title="Complete this lot?"
        description={
          completeFor
            ? `Lot ${completeFor.lot_no} will be closed, its machine released, and its output booked into stock. This cannot be undone.`
            : undefined
        }
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="Delete this lot?"
        description={
          deleteFor ? `Lot ${deleteFor.lot_no} will be removed and its consumed stock released.` : undefined
        }
      />
    </Screen>
  );
}
