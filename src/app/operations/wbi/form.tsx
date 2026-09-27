import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  useCreateInwardWeighBridgeEntry,
  useInwardWeighBridgeEntries,
  useUpdateInwardWeighBridgeEntry,
  type InwardWeighBridgeEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { EmptyState, Loading } from '@/components/ui/feedback';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { Callout, DetailRow } from '@/components/ui/misc';
import { MultiSelect, Select } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import { formatVehicleNumber, isValidVehicleNumber, VEHICLE_FORMAT_HINT, type VehicleRecord } from '@/features/operations/vehicle';
import { useVehicleHistory, VehicleFields } from '@/features/operations/vehicle-fields';
import { usePermissions } from '@/hooks/use-permissions';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatNumber, today } from '@/lib/format';
import { useTheme } from '@/theme';

interface FormState extends VehicleRecord {
  wbi_id: string;
  date: string;
  weight_fully_loaded: number | '';
  empty_weight: number | '';
  source_location_id: string;
  weigh_bridge_id: string;
  slip_number: string;
  commodity_ids: string[];
  total_bags: number | '';
}

const blank = (): FormState => ({
  wbi_id: '',
  date: today(),
  vehicle_no: '',
  driver_name: '',
  mobile_no: '',
  drivers_license_no: '',
  rc_copy_no: '',
  weight_fully_loaded: '',
  empty_weight: '',
  source_location_id: '',
  weigh_bridge_id: '',
  slip_number: '',
  commodity_ids: [],
  total_bags: '',
});

const fromEntry = (entry: InwardWeighBridgeEntry): FormState => ({
  wbi_id: entry.wbi_id,
  date: entry.date ? String(entry.date).slice(0, 10) : today(),
  vehicle_no: entry.vehicle_no ?? '',
  driver_name: entry.driver_name ?? '',
  mobile_no: entry.mobile_no ?? '',
  drivers_license_no: entry.drivers_license_no ?? '',
  rc_copy_no: entry.rc_copy_no ?? '',
  weight_fully_loaded: entry.weight_fully_loaded ?? '',
  empty_weight: entry.empty_weight || '',
  source_location_id: entry.source_location_id ?? '',
  weigh_bridge_id: entry.weigh_bridge_id ?? '',
  slip_number: entry.slip_number ?? '',
  commodity_ids: entry.commodity_ids ?? [],
  total_bags: entry.total_bags ?? '',
});

/**
 * Weigh bridge entry — create and edit.
 *
 * `mode=initial` captures the loaded weigh-in; `mode=final` records the empty
 * weight, with the gate details shown read-only so the operator can check the
 * vehicle in front of them.
 *
 * Once a GRN is raised on an entry the server only accepts the empty weight,
 * and ignores anything else without saying so. Such an entry therefore always
 * opens in final mode here, so no edit is silently lost.
 */
export default function WbiFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id, mode } = useLocalSearchParams<{ id?: string; mode?: string }>();
  const isEdit = Boolean(id);
  const { can } = usePermissions();

  const lookups = useMasterLookups();
  const list = useInwardWeighBridgeEntries();
  const create = useCreateInwardWeighBridgeEntry();
  const update = useUpdateInwardWeighBridgeEntry();
  const vehicleHistory = useVehicleHistory('inward');

  const [error, setError] = useState<{ key: keyof FormState; message: string } | null>(null);

  const editItem = useMemo(
    () => (isEdit ? (list.data ?? []).find((entry) => entry._id === id) : undefined),
    [isEdit, id, list.data]
  );
  const isInitial = mode !== 'final' && !(editItem && !editItem.is_mutable);
  const recordedEmpty = editItem && editItem.empty_weight > 0 ? editItem.empty_weight : null;
  const locked = Boolean(editItem && !editItem.is_mutable && recordedEmpty);

  const [form, setForm] = useSyncedState<FormState>(
    isEdit ? (editItem?._id ?? null) : list.data ? 'new' : null,
    () => {
      if (editItem) return fromEntry(editItem);
      // Next number in sequence, exactly as the web form derives it.
      const maxId = (list.data ?? []).reduce((max, entry) => {
        const parsed = parseInt(entry.wbi_id || '0', 10);
        return !Number.isNaN(parsed) && parsed > max ? parsed : max;
      }, 0);
      return { ...blank(), wbi_id: String(maxId + 1) };
    }
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (error?.key === key) setError(null);
  };

  const netWeight =
    form.weight_fully_loaded !== '' && form.empty_weight !== ''
      ? Number(form.weight_fully_loaded) - Number(form.empty_weight)
      : null;

  /** First failing rule, in the order the web form checks them. */
  const validate = (): { key: keyof FormState; message: string } | null => {
    if (!form.wbi_id) return { key: 'wbi_id', message: 'WBI ID is required' };
    if (form.vehicle_no && !isValidVehicleNumber(form.vehicle_no)) {
      return { key: 'vehicle_no', message: `Invalid vehicle number. ${VEHICLE_FORMAT_HINT}` };
    }

    if (isInitial) {
      if (!form.source_location_id) return { key: 'source_location_id', message: 'Source location is required' };
      if (!form.weigh_bridge_id) return { key: 'weigh_bridge_id', message: 'Weigh bridge is required' };
      if (!form.slip_number.trim()) return { key: 'slip_number', message: 'Slip number is required' };
      if (form.commodity_ids.length === 0) return { key: 'commodity_ids', message: 'At least one commodity is required' };
      if (form.total_bags === '' || Number(form.total_bags) <= 0) {
        return { key: 'total_bags', message: 'Total bags must be greater than 0' };
      }
      if (form.weight_fully_loaded === '' || Number(form.weight_fully_loaded) <= 0) {
        return { key: 'weight_fully_loaded', message: 'Loaded weight must be greater than 0' };
      }
      // An entry already weighed empty must stay heavier loaded, or the net goes negative.
      if (recordedEmpty && Number(form.weight_fully_loaded) <= recordedEmpty) {
        return {
          key: 'weight_fully_loaded',
          message: `Loaded weight must be more than the recorded empty weight (${formatNumber(recordedEmpty)} kg)`,
        };
      }
    } else {
      if (form.empty_weight === '' || Number(form.empty_weight) <= 0) {
        return { key: 'empty_weight', message: 'Empty weight must be greater than 0' };
      }
      if (Number(form.weight_fully_loaded) <= Number(form.empty_weight)) {
        return { key: 'empty_weight', message: 'Loaded weight must be greater than empty weight' };
      }
    }
    return null;
  };

  const submit = async () => {
    const failure = validate();
    if (failure) {
      setError(failure);
      toast.error(failure.message);
      return;
    }

    const loaded = Number(form.weight_fully_loaded || 0);
    const empty = Number(form.empty_weight || 0);
    const payload: Omit<InwardWeighBridgeEntry, '_id'> = {
      ...form,
      slip_number: form.slip_number.trim(),
      vehicle_no: form.vehicle_no ? formatVehicleNumber(form.vehicle_no) : '',
      total_bags: Number(form.total_bags || 0),
      weight_fully_loaded: loaded,
      empty_weight: empty,
      // As on the web: before the empty weigh-in this is the loaded weight.
      net_weight: loaded - empty,
      images: editItem?.images ?? [],
      is_mutable: editItem ? editItem.is_mutable : true,
      is_deletable: editItem ? editItem.is_deletable : true,
    };

    try {
      if (editItem) {
        // A GRN-linked entry only takes its weights; send just those.
        const data = editItem.is_mutable
          ? payload
          : { empty_weight: payload.empty_weight, net_weight: payload.net_weight };
        await update.mutateAsync({ id: editItem._id, data });
        toast.success(isInitial ? 'Weigh bridge entry updated' : 'Empty weight recorded', {
          description: !isInitial && netWeight !== null ? `Net ${formatNumber(netWeight)} kg` : undefined,
        });
      } else {
        await create.mutateAsync(payload as InwardWeighBridgeEntry);
        toast.success('Weigh bridge entry created', { description: `WBI ${form.wbi_id}` });
      }
      router.back();
    } catch (err) {
      toast.error(editItem ? 'Could not update the entry' : 'Could not create the entry', {
        description: getErrorMessage(err),
      });
    }
  };

  if (isEdit && list.isLoading) {
    return (
      <Screen>
        <Header title="Weigh bridge entry" />
        <Loading label="Loading entry…" />
      </Screen>
    );
  }

  if (isEdit && !editItem) {
    return (
      <Screen>
        <Header title="Weigh bridge entry" />
        <EmptyState icon="alert-circle-outline" title="Entry not found" description="It may have been deleted." />
      </Screen>
    );
  }

  if (locked) {
    return (
      <Screen>
        <Header title={`WBI ${form.wbi_id}`} />
        <EmptyState
          icon="lock-closed-outline"
          title="This entry is locked"
          description="It is used in a GRN and its empty weight is recorded, so it can no longer be changed."
        />
      </Screen>
    );
  }

  const errorFor = (key: keyof FormState) => (error?.key === key ? error.message : undefined);
  const gateLocked = !isInitial;
  /** The web form's `+` beside a master picker: create it without leaving the entry. */
  const createMaster = (module: string) =>
    !gateLocked && can(`${module}:create`) ? () => router.push(`/masters/${module}/new` as never) : undefined;

  return (
    <Screen edges={['top']}>
      <Header
        title={isEdit ? `${isInitial ? 'Edit' : 'Weigh out'} WBI ${form.wbi_id}` : 'New weigh-in'}
        subtitle={isInitial ? 'Loaded vehicle at the gate' : 'Record the empty weight'}
      />

      <Body>
        {!isInitial && (
          <Callout
            tone="info"
            title="Closing out a vehicle"
            description={
              editItem && !editItem.is_mutable
                ? 'This entry is used in a GRN, so only the empty weight can be recorded.'
                : 'Gate details are shown for reference. Only the empty weight can be changed here.'
            }
          />
        )}

        {!isInitial && (
          <Card>
            <SectionHeader title="Empty weight" caption="Net weight is calculated for you" />
            <View style={{ gap: theme.spacing.lg }}>
              <DetailRow label="Loaded weight" value={`${formatNumber(Number(form.weight_fully_loaded))} kg`} />
              <Field label="Empty weight" required error={errorFor('empty_weight')}>
                <NumberInput
                  value={form.empty_weight}
                  onChangeValue={(value) => set('empty_weight', value)}
                  suffix="kg"
                  autoFocus
                  error={Boolean(errorFor('empty_weight'))}
                />
              </Field>
              {netWeight !== null && (
                <Animated.View entering={FadeIn.duration(180)}>
                  <Callout
                    tone={netWeight > 0 ? 'success' : 'danger'}
                    icon="calculator-outline"
                    title={`Net weight ${formatNumber(netWeight)} kg`}
                    description={netWeight > 0 ? 'Loaded minus empty' : 'Loaded weight must exceed the empty weight'}
                  />
                </Animated.View>
              )}
            </View>
          </Card>
        )}

        <Card>
          <SectionHeader title="Entry" />
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="WBI ID" style={{ flex: 1 }}>
                <Input value={form.wbi_id} readOnly />
              </Field>
              <Field label="Date" required style={{ flex: 1.4 }}>
                <DateField value={form.date} onChange={(value) => set('date', value)} disabled={gateLocked} />
              </Field>
            </View>

            <Field label="Source location" required error={errorFor('source_location_id')}>
              <Select
                value={form.source_location_id}
                options={lookups.sourceLocationOptions}
                onChange={(value) => set('source_location_id', value)}
                title="Source location"
                placeholder="Where the goods came from"
                disabled={gateLocked}
                error={Boolean(errorFor('source_location_id'))}
                onCreate={createMaster('source-location')}
                createLabel="Add source location"
              />
            </Field>

            <Field label="Weigh bridge" required error={errorFor('weigh_bridge_id')}>
              <Select
                value={form.weigh_bridge_id}
                options={lookups.weighBridgeOptions}
                onChange={(value) => set('weigh_bridge_id', value)}
                title="Weigh bridge"
                disabled={gateLocked}
                error={Boolean(errorFor('weigh_bridge_id'))}
                onCreate={createMaster('weigh-bridge')}
                createLabel="Add weigh bridge"
              />
            </Field>

            <Field label="Slip number" required error={errorFor('slip_number')}>
              <Input
                value={form.slip_number}
                onChangeText={(value) => set('slip_number', value)}
                readOnly={gateLocked}
                autoCapitalize="characters"
                autoCorrect={false}
                error={Boolean(errorFor('slip_number'))}
              />
            </Field>

            <Field label="Commodities" required error={errorFor('commodity_ids')}>
              <MultiSelect
                values={form.commodity_ids}
                options={lookups.commodityOptions}
                onChange={(values) => set('commodity_ids', values)}
                title="Commodities on board"
                disabled={gateLocked}
                error={Boolean(errorFor('commodity_ids'))}
                onCreate={createMaster('commodity')}
              />
            </Field>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Load" />
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Total bags" required={isInitial} error={errorFor('total_bags')} style={{ flex: 1 }}>
                <NumberInput
                  value={form.total_bags}
                  onChangeValue={(value) => set('total_bags', value)}
                  keyboardType="number-pad"
                  readOnly={gateLocked}
                  error={Boolean(errorFor('total_bags'))}
                />
              </Field>
              <Field label="Loaded weight" required={isInitial} error={errorFor('weight_fully_loaded')} style={{ flex: 1 }}>
                <NumberInput
                  value={form.weight_fully_loaded}
                  onChangeValue={(value) => set('weight_fully_loaded', value)}
                  suffix="kg"
                  readOnly={gateLocked}
                  error={Boolean(errorFor('weight_fully_loaded'))}
                />
              </Field>
            </View>
            {isInitial && recordedEmpty !== null && (
              <Callout
                tone="info"
                icon="calculator-outline"
                title={`Empty weight ${formatNumber(recordedEmpty)} kg already recorded`}
                description={
                  netWeight !== null && netWeight > 0
                    ? `Net will be ${formatNumber(netWeight)} kg`
                    : 'The loaded weight must stay above it'
                }
              />
            )}
          </View>
        </Card>

        <Card>
          <SectionHeader title="Vehicle" />
          <VehicleFields
            value={form}
            history={vehicleHistory}
            readOnly={gateLocked}
            vehicleError={errorFor('vehicle_no')}
            onChange={(field, text) => set(field, text)}
            onApply={(record) =>
              setForm((current) => ({
                ...current,
                vehicle_no: record.vehicle_no || current.vehicle_no,
                driver_name: record.driver_name || current.driver_name,
                mobile_no: record.mobile_no || current.mobile_no,
                drivers_license_no: record.drivers_license_no || current.drivers_license_no,
                rc_copy_no: record.rc_copy_no || current.rc_copy_no,
              }))
            }
          />
        </Card>
      </Body>

      <ActionBar>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button
          label={!isEdit ? 'Create entry' : isInitial ? 'Save changes' : 'Save empty weight'}
          style={{ flex: 2 }}
          loading={create.isPending || update.isPending}
          onPress={submit}
        />
      </ActionBar>
    </Screen>
  );
}
