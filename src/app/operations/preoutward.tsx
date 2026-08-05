import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  useCreatePreOutward,
  useDeletePreOutward,
  usePreOutwards,
  useReleaseUnallocated,
  useStockLedgerAll,
  type PreOutward,
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

type Filter = 'open' | 'done' | 'all';

/**
 * Pre-outward — reserving stock for a dispatch that has not happened yet.
 *
 * Reserved bags leave available stock immediately, so a stale reservation
 * quietly starves everything else. "Release unallocated" is therefore a
 * first-class action rather than something buried in an edit form.
 */
export default function PreOutwardScreen() {
  const theme = useTheme();
  const lookups = useMasterLookups();
  const list = usePreOutwards();
  const ledger = useStockLedgerAll();
  const create = useCreatePreOutward();
  const release = useReleaseUnallocated();
  const remove = useDeletePreOutward();
  const { canCreate, canUpdate, canDelete } = useModulePermissions('preoutward');

  const [filter, setFilter] = useState<Filter>('open');
  const [form, setForm] = useState<{
    date: string;
    company_group_id: string;
    allocations: Allocation[];
    remarks: string;
  } | null>(null);
  const [menuFor, setMenuFor] = useState<PreOutward | null>(null);
  const [deleteFor, setDeleteFor] = useState<PreOutward | null>(null);
  const [releaseFor, setReleaseFor] = useState<PreOutward | null>(null);

  const preOutwards = list.data ?? [];
  const openCount = preOutwards.filter((entry) => (entry.total_bags_remaining ?? 0) > 0).length;

  const filtered = useMemo(() => {
    if (filter === 'all') return preOutwards;
    return preOutwards.filter((entry) =>
      filter === 'open' ? (entry.total_bags_remaining ?? 0) > 0 : (entry.total_bags_remaining ?? 0) === 0
    );
  }, [preOutwards, filter]);

  const submit = async () => {
    if (!form) return;
    if (!form.company_group_id) return toast.error('Select a company group');
    if (form.allocations.length === 0) return toast.error('Reserve stock from at least one batch');

    try {
      await create.mutateAsync({
        date: form.date,
        company_group_id: form.company_group_id,
        allocations: form.allocations,
        remarks: form.remarks || undefined,
      } as unknown as Parameters<typeof create.mutateAsync>[0]);
      toast.success('Pre-outward created');
      setForm(null);
    } catch (error) {
      toast.error('Could not create the pre-outward', { description: getErrorMessage(error) });
    }
  };

  const doRelease = async () => {
    if (!releaseFor) return;
    try {
      await release.mutateAsync(releaseFor._id);
      toast.success('Unallocated bags released');
      setReleaseFor(null);
    } catch (error) {
      toast.error('Could not release the bags', { description: getErrorMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success('Pre-outward deleted');
      setDeleteFor(null);
    } catch (error) {
      toast.error('Could not delete the pre-outward', { description: getErrorMessage(error) });
    }
  };

  return (
    <Screen>
      <Header title="Pre-Outwards" subtitle={openCount > 0 ? `${openCount} awaiting dispatch` : 'Nothing reserved'} />

      <ListBody<PreOutward, Filter>
        items={filtered}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={(item) => [item.preout_no, item.remarks]}
        searchPlaceholder="Search pre-outward no…"
        filters={[
          { value: 'open', label: 'Awaiting dispatch', count: openCount },
          { value: 'done', label: 'Fully dispatched', count: preOutwards.length - openCount },
          { value: 'all', label: 'All', count: preOutwards.length },
        ]}
        filterValue={filter}
        onFilterChange={setFilter}
        emptyTitle="No pre-outwards yet"
        emptyDescription="Reserve stock here, then dispatch against it from the Outwards screen."
        emptyActionLabel={canCreate ? 'New pre-outward' : undefined}
        onEmptyAction={
          canCreate ? () => setForm({ date: today(), company_group_id: '', allocations: [], remarks: '' }) : undefined
        }
        renderItem={(item) => {
          const remaining = item.total_bags_remaining ?? 0;
          return (
            <RecordCard
              title={`Pre-outward ${item.preout_no}`}
              subtitle={`${lookups.companyGroupName(refId(item.company_group_id))} · ${formatDate(item.date)}`}
              badge={
                remaining > 0
                  ? { label: `${formatNumber(remaining)} to go`, tone: 'warning' }
                  : { label: 'Dispatched', tone: 'success' }
              }
              accent={remaining > 0 ? 'warning' : undefined}
              fields={[
                { label: 'Reserved', value: formatNumber(item.total_bags_allocated), emphasis: true },
                { label: 'Dispatched', value: formatNumber(item.total_bags_dispatched) },
                { label: 'Remaining', value: formatNumber(remaining) },
                { label: 'Batches', value: item.allocations?.length ?? 0 },
              ]}
              onMenu={() => setMenuFor(item)}
            />
          );
        }}
      />

      {canCreate && (
        <Fab
          label="Pre-outward"
          onPress={() => setForm({ date: today(), company_group_id: '', allocations: [], remarks: '' })}
        />
      )}

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `Pre-outward ${menuFor.preout_no}` : undefined}
        actions={[
          {
            label: 'Release unallocated bags',
            icon: 'lock-open-outline',
            disabled: !canUpdate || (menuFor?.total_bags_remaining ?? 0) === 0,
            disabledReason: 'Nothing left to release',
            onPress: () => menuFor && setReleaseFor(menuFor),
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
        onClose={() => setForm(null)}
        title="New pre-outward"
        subtitle="Reserve stock for a dispatch"
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setForm(null)} />
            <Button label="Reserve stock" style={{ flex: 2 }} loading={create.isPending} onPress={submit} />
          </>
        }
      >
        {form && (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <Field label="Date" required>
              <DateField value={form.date} onChange={(date) => setForm({ ...form, date })} />
            </Field>

            <Field label="Company group" required hint="Stock is reserved within one group">
              <Select
                value={form.company_group_id}
                options={lookups.companyGroupOptions}
                onChange={(company_group_id) => setForm({ ...form, company_group_id, allocations: [] })}
                title="Company group"
                disabled={form.allocations.length > 0}
              />
            </Field>

            <Text variant="label" tone="muted">
              STOCK TO RESERVE
            </Text>

            <AllocationPicker
              entries={ledger.data ?? []}
              allocations={form.allocations}
              onChange={(allocations) => setForm({ ...form, allocations })}
              filter={(entry) => !form.company_group_id || refId(entry.company_group_id) === form.company_group_id}
              emptyHint={form.company_group_id ? 'Pick the batches to hold for dispatch.' : 'Choose a company group first.'}
            />

            <Field label="Remarks">
              <Input value={form.remarks} onChangeText={(remarks) => setForm({ ...form, remarks })} />
            </Field>
          </ScrollView>
        )}
      </Sheet>

      <ConfirmSheet
        open={releaseFor !== null}
        onClose={() => setReleaseFor(null)}
        onConfirm={doRelease}
        loading={release.isPending}
        tone="primary"
        confirmLabel="Release"
        title="Release unallocated bags?"
        description={
          releaseFor
            ? `${formatNumber(releaseFor.total_bags_remaining)} reserved but undispatched bags will return to available stock.`
            : undefined
        }
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="Delete this pre-outward?"
        description={
          deleteFor ? `Pre-outward ${deleteFor.preout_no} will be removed and its reservation released.` : undefined
        }
      />
    </Screen>
  );
}
