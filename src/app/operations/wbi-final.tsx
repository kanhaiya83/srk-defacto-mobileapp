import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  useDeleteInwardWeighBridgeEntry,
  useInwardWeighBridgeEntries,
  useUpdateInwardWeighBridgeEntry,
  type InwardWeighBridgeEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ActionSheet, ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { Field, NumberInput } from '@/components/ui/field';
import { Callout, DetailRow } from '@/components/ui/misc';
import { Header, Screen } from '@/components/ui/screen';
import { ConfirmSheet, Sheet, SheetBody } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { isWeighed, WBI_LOCKED_REASON, wbiEditPath } from '@/features/operations/wbi';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber } from '@/lib/format';

type Filter = 'pending' | 'weighed' | 'all';

/**
 * WBI Empty — closing out a vehicle by recording its tare weight.
 *
 * This is the one screen an operator uses standing at the weigh bridge, so the
 * flow is one tap and one number: the sheet shows the loaded weight, the net
 * updates as they type, and the obvious mistake (empty ≥ loaded) is caught
 * before the request is sent.
 */
export default function WbiFinalScreen() {
  const router = useRouter();
  const lookups = useMasterLookups();
  const list = useInwardWeighBridgeEntries();
  const update = useUpdateInwardWeighBridgeEntry();
  const remove = useDeleteInwardWeighBridgeEntry();
  const { canUpdate, canDelete } = useModulePermissions('wbi');

  const [filter, setFilter] = useState<Filter>('pending');
  const [editing, setEditing] = useState<InwardWeighBridgeEntry | null>(null);
  const [weight, setWeight] = useState<number | ''>('');
  const [menuFor, setMenuFor] = useState<InwardWeighBridgeEntry | null>(null);
  const [deleteFor, setDeleteFor] = useState<InwardWeighBridgeEntry | null>(null);

  const entries = useMemo(() => list.data ?? [], [list.data]);
  const pendingCount = entries.filter((entry) => !isWeighed(entry)).length;

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((entry) => (filter === 'weighed' ? isWeighed(entry) : !isWeighed(entry)));
  }, [entries, filter]);

  const search = useCallback(
    (item: InwardWeighBridgeEntry) => [
      item.wbi_id,
      item.vehicle_no,
      item.driver_name,
      item.slip_number,
      lookups.sourceLocationName(item.source_location_id),
    ],
    [lookups]
  );

  const loaded = Number(editing?.weight_fully_loaded ?? 0);
  const netWeight = editing && weight !== '' ? loaded - Number(weight) : null;
  const invalid = editing !== null && weight !== '' && (Number(weight) <= 0 || loaded <= Number(weight));

  /** An entry can take an empty weight until it is both GRN-linked and weighed. */
  const canWeigh = (entry: InwardWeighBridgeEntry) => canUpdate && wbiEditPath(entry) !== null;

  const openEditor = (entry: InwardWeighBridgeEntry) => {
    if (!canUpdate) {
      toast.error('Your role cannot record weights');
      return;
    }
    if (!canWeigh(entry)) {
      toast.error(WBI_LOCKED_REASON);
      return;
    }
    setEditing(entry);
    setWeight(isWeighed(entry) ? entry.empty_weight : '');
  };

  const save = async () => {
    if (!editing || weight === '') return;
    if (Number(weight) <= 0) {
      toast.error('Empty weight must be greater than zero');
      return;
    }
    if (loaded <= Number(weight)) {
      toast.error('Loaded weight must be greater than empty weight');
      return;
    }

    try {
      await update.mutateAsync({
        id: editing._id,
        data: { empty_weight: Number(weight), net_weight: loaded - Number(weight) },
      });
      toast.success('Empty weight recorded', { description: `Net ${formatNumber(loaded - Number(weight))} kg` });
      setEditing(null);
    } catch (error) {
      toast.error('Could not save the weight', { description: getErrorMessage(error) });
    }
  };

  const handleDelete = async () => {
    if (!deleteFor) return;
    try {
      await remove.mutateAsync(deleteFor._id);
      toast.success('Entry deleted');
    } catch (error) {
      toast.error('Could not delete entry', { description: getErrorMessage(error) });
    }
    setDeleteFor(null);
  };

  return (
    <Screen>
      <Header
        title="WBI Empty"
        subtitle={pendingCount > 0 ? `${pendingCount} awaiting empty weight` : 'All vehicles closed out'}
      />

      <ListBody<InwardWeighBridgeEntry, Filter>
        items={filtered}
        isLoading={list.isLoading}
        isError={list.isError}
        errorMessage={list.error ? getErrorMessage(list.error) : undefined}
        onRefresh={() => void list.refetch()}
        refreshing={list.isRefetching}
        keyExtractor={(item) => item._id}
        searchFields={search}
        searchPlaceholder="Search WBI, vehicle, driver…"
        filters={[
          { value: 'pending', label: 'Awaiting weight', count: pendingCount },
          { value: 'weighed', label: 'Weighed', count: entries.length - pendingCount },
          { value: 'all', label: 'All', count: entries.length },
        ]}
        filterValue={filter}
        onFilterChange={setFilter}
        emptyTitle={filter === 'pending' ? 'Nothing waiting' : 'No entries yet'}
        emptyDescription={
          filter === 'pending'
            ? 'Every weighed-in vehicle has its empty weight recorded.'
            : 'Entries appear here once vehicles are weighed in.'
        }
        renderItem={(item) => {
          const weighed = isWeighed(item);
          const editable = canWeigh(item);
          return (
            <RecordCard
              title={`WBI ${item.wbi_id}`}
              subtitle={[item.vehicle_no || 'No vehicle', item.driver_name, formatDate(item.date)].filter(Boolean).join(' · ')}
              badge={{ label: weighed ? 'Weighed' : 'Awaiting weight', tone: weighed ? 'success' : 'warning' }}
              accent={weighed ? undefined : 'warning'}
              fields={[
                { label: 'Source', value: lookups.sourceLocationName(item.source_location_id) },
                {
                  label: 'Commodity',
                  value: (item.commodity_ids ?? []).map((cid) => lookups.commodityName(cid)).join(', '),
                },
                { label: 'Bags', value: formatNumber(item.total_bags) },
                { label: 'Loaded', value: `${formatNumber(item.weight_fully_loaded)} kg` },
                ...(weighed
                  ? [
                      { label: 'Empty', value: `${formatNumber(item.empty_weight)} kg` },
                      { label: 'Net', value: `${formatNumber(item.net_weight)} kg`, emphasis: true },
                    ]
                  : []),
              ]}
              onPress={() => router.push(`/operations/wbi/${item._id}`)}
              onMenu={() => setMenuFor(item)}
              footer={
                editable ? (
                  <Button
                    label={weighed ? 'Adjust empty weight' : 'Record empty weight'}
                    variant={weighed ? 'outline' : 'primary'}
                    size="sm"
                    icon="speedometer-outline"
                    fullWidth
                    onPress={() => openEditor(item)}
                  />
                ) : undefined
              }
            />
          );
        }}
      />

      <ActionSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? `WBI ${menuFor.wbi_id}` : undefined}
        actions={[
          {
            label: 'View details',
            icon: 'eye-outline',
            onPress: () => menuFor && router.push(`/operations/wbi/${menuFor._id}`),
          },
          {
            label: 'Edit entry',
            icon: 'create-outline',
            disabled: !canUpdate || !(menuFor && wbiEditPath(menuFor)),
            disabledReason: canUpdate ? WBI_LOCKED_REASON : 'Your role cannot edit weigh bridge entries',
            onPress: () => {
              const path = menuFor && wbiEditPath(menuFor);
              if (path) router.push(path as never);
            },
          },
          {
            label: 'Delete',
            icon: 'trash-outline',
            tone: 'danger',
            disabled: !canDelete || !menuFor?.is_deletable,
            disabledReason: canDelete ? 'Locked — used in a GRN' : 'Your role cannot delete weigh bridge entries',
            onPress: () => menuFor && setDeleteFor(menuFor),
          },
        ]}
      />

      <ConfirmSheet
        open={deleteFor !== null}
        onClose={() => setDeleteFor(null)}
        onConfirm={handleDelete}
        loading={remove.isPending}
        title="Delete this weigh-in?"
        description={deleteFor ? `WBI ${deleteFor.wbi_id} for ${deleteFor.vehicle_no || 'this vehicle'} will be removed.` : undefined}
      />

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `WBI ${editing.wbi_id}` : ''}
        subtitle={editing?.vehicle_no || undefined}
        footer={
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setEditing(null)} />
            <Button
              label="Save weight"
              style={{ flex: 2 }}
              loading={update.isPending}
              disabled={weight === '' || invalid}
              onPress={save}
            />
          </>
        }
      >
        {editing && (
          <SheetBody>
            {/* The number being typed comes first, so it stays in view above the keyboard. */}
            <Field
              label="Empty weight"
              required
              error={invalid ? 'Empty weight must be below the loaded weight' : undefined}
            >
              <NumberInput
                value={weight}
                onChangeValue={setWeight}
                placeholder="0"
                suffix="kg"
                autoFocus
                error={invalid}
              />
            </Field>

            {netWeight !== null && !invalid && (
              <Callout tone="success" icon="calculator-outline" title={`Net weight ${formatNumber(netWeight)} kg`} />
            )}

            <DetailRow label="Loaded weight" value={`${formatNumber(loaded)} kg`} emphasis />
            <DetailRow label="Total bags" value={formatNumber(editing.total_bags)} />
            <DetailRow label="Driver" value={editing.driver_name} />

            {!editing.is_mutable && (
              <Callout
                tone="warning"
                title="Used in a GRN"
                description="Once this empty weight is saved the entry locks and cannot be changed again."
              />
            )}
          </SheetBody>
        )}
      </Sheet>
    </Screen>
  );
}
