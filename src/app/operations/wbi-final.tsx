import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  useInwardWeighBridgeEntries,
  useUpdateInwardWeighBridgeEntry,
  type InwardWeighBridgeEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { ListBody } from '@/components/list-screen';
import { RecordCard } from '@/components/record-card';
import { Button } from '@/components/ui/button';
import { Field, NumberInput } from '@/components/ui/field';
import { Callout, DetailRow } from '@/components/ui/misc';
import { Header, Screen } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { useModulePermissions } from '@/hooks/use-permissions';
import { formatDate, formatNumber } from '@/lib/format';

type Filter = 'pending' | 'weighed' | 'all';

/**
 * WBI Empty — closing out a vehicle by recording its tare weight.
 *
 * This is the one screen an operator uses standing at the weigh bridge, so the
 * whole flow is one tap and one number: the sheet shows the loaded weight, the
 * net updates as they type, and the obvious mistake (empty ≥ loaded) is caught
 * before the request is sent.
 */
export default function WbiFinalScreen() {
  const router = useRouter();
  const lookups = useMasterLookups();
  const list = useInwardWeighBridgeEntries();
  const update = useUpdateInwardWeighBridgeEntry();
  const { canUpdate } = useModulePermissions('wbi');

  const [filter, setFilter] = useState<Filter>('pending');
  const [editing, setEditing] = useState<InwardWeighBridgeEntry | null>(null);
  const [weight, setWeight] = useState<number | ''>('');

  const entries = list.data ?? [];
  const isWeighed = (entry: InwardWeighBridgeEntry) => Boolean(entry.empty_weight && entry.empty_weight > 0);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((entry) => (filter === 'weighed' ? isWeighed(entry) : !isWeighed(entry)));
  }, [entries, filter]);

  const search = useCallback(
    (item: InwardWeighBridgeEntry) => [item.wbi_id, item.vehicle_no, item.driver_name, item.slip_number],
    []
  );

  const netWeight = editing && weight !== '' ? Number(editing.weight_fully_loaded) - Number(weight) : null;
  const invalid =
    editing && weight !== '' && (Number(weight) <= 0 || Number(editing.weight_fully_loaded) <= Number(weight));

  const openEditor = (entry: InwardWeighBridgeEntry) => {
    if (!canUpdate) {
      toast.error('Your role cannot record weights');
      return;
    }
    // Once a GRN exists and the weight is already in, the entry is settled.
    if (isWeighed(entry) && !entry.is_mutable) {
      toast.error('Locked — this entry is used in a GRN and its empty weight is recorded');
      return;
    }
    setEditing(entry);
    setWeight(entry.empty_weight > 0 ? entry.empty_weight : '');
  };

  const save = async () => {
    if (!editing || weight === '') return;
    if (Number(weight) <= 0) {
      toast.error('Empty weight must be greater than zero');
      return;
    }
    if (Number(editing.weight_fully_loaded) <= Number(weight)) {
      toast.error('Loaded weight must be greater than empty weight');
      return;
    }

    try {
      await update.mutateAsync({
        id: editing._id,
        data: {
          empty_weight: Number(weight),
          net_weight: Number(editing.weight_fully_loaded) - Number(weight),
        },
      });
      toast.success('Empty weight recorded', {
        description: `Net ${formatNumber(Number(editing.weight_fully_loaded) - Number(weight))} kg`,
      });
      setEditing(null);
    } catch (error) {
      toast.error('Could not save the weight', { description: getErrorMessage(error) });
    }
  };

  const pendingCount = entries.filter((entry) => !isWeighed(entry)).length;

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
          return (
            <RecordCard
              title={`WBI ${item.wbi_id}`}
              subtitle={`${item.vehicle_no || 'No vehicle'} · ${formatDate(item.date)}`}
              badge={{ label: weighed ? 'Weighed' : 'Awaiting weight', tone: weighed ? 'success' : 'warning' }}
              accent={weighed ? undefined : 'warning'}
              fields={[
                { label: 'Loaded', value: `${formatNumber(item.weight_fully_loaded)} kg` },
                { label: 'Empty', value: weighed ? `${formatNumber(item.empty_weight)} kg` : null },
                { label: 'Net', value: weighed ? `${formatNumber(item.net_weight)} kg` : null, emphasis: true },
                { label: 'Source', value: lookups.sourceLocationName(item.source_location_id) },
              ]}
              onPress={() => router.push(`/operations/wbi/${item._id}`)}
              footer={
                <Button
                  label={weighed ? 'Adjust empty weight' : 'Record empty weight'}
                  variant={weighed ? 'outline' : 'primary'}
                  size="sm"
                  icon="speedometer-outline"
                  fullWidth
                  disabled={!canUpdate || (weighed && !item.is_mutable)}
                  onPress={() => openEditor(item)}
                />
              }
            />
          );
        }}
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
              disabled={weight === '' || Boolean(invalid)}
              onPress={save}
            />
          </>
        }
      >
        {editing && (
          <View style={{ paddingHorizontal: 16, gap: 16 }}>
            <View>
              <DetailRow label="Loaded weight" value={`${formatNumber(editing.weight_fully_loaded)} kg`} />
              <DetailRow label="Total bags" value={formatNumber(editing.total_bags)} />
              <DetailRow label="Driver" value={editing.driver_name} />
            </View>

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
                error={Boolean(invalid)}
              />
            </Field>

            {netWeight !== null && !invalid && (
              <Callout
                tone="success"
                icon="calculator-outline"
                title={`Net weight ${formatNumber(netWeight)} kg`}
                description="Loaded minus empty. Saved with the entry."
              />
            )}

            {!editing.is_mutable && (
              <Text variant="caption" tone="muted">
                This entry already has a GRN. Once the empty weight is saved it can no longer be changed here.
              </Text>
            )}
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
