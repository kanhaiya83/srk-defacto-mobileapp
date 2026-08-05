import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
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
import { Loading } from '@/components/ui/feedback';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { Callout } from '@/components/ui/misc';
import { MultiSelect, Select } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { useMasterLookups } from '@/features/operations/lookups';
import {
  dedupeByVehicle,
  formatVehicleNumber,
  isValidVehicleNumber,
  matchVehicles,
  toVehicleRecord,
  VEHICLE_FORMAT_HINT,
  type VehicleRecord,
} from '@/features/operations/vehicle';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatNumber, today } from '@/lib/format';
import { useTheme } from '@/theme';

interface FormState {
  wbi_id: string;
  date: string;
  vehicle_no: string;
  driver_name: string;
  mobile_no: string;
  drivers_license_no: string;
  rc_copy_no: string;
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

/**
 * Weigh bridge entry — create and edit.
 *
 * `mode=initial` captures the loaded weigh-in; `mode=final` only unlocks the
 * empty weight, matching the web form's two-phase behaviour. The gate fields
 * stay visible in final mode but read-only, so the operator can verify the
 * vehicle in front of them without leaving the screen.
 */
export default function WbiFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id, mode } = useLocalSearchParams<{ id?: string; mode?: string }>();
  const isInitial = mode !== 'final';
  const isEdit = Boolean(id);

  const lookups = useMasterLookups();
  const list = useInwardWeighBridgeEntries();
  const create = useCreateInwardWeighBridgeEntry();
  const update = useUpdateInwardWeighBridgeEntry();

  const [error, setError] = useState<{ key: keyof FormState; message: string } | null>(null);
  const [vehicleQuery, setVehicleQuery] = useState('');

  const editItem = useMemo(
    () => (isEdit ? (list.data ?? []).find((entry) => entry._id === id) : undefined),
    [isEdit, id, list.data]
  );

  const vehicleHistory = useMemo<VehicleRecord[]>(
    () => dedupeByVehicle((list.data ?? []).map(toVehicleRecord)),
    [list.data]
  );

  const [form, setForm] = useSyncedState<FormState>(
    isEdit ? (editItem?._id ?? null) : list.data ? 'new' : null,
    () => {
      if (editItem) {
        return {
          wbi_id: editItem.wbi_id,
          date: editItem.date ? String(editItem.date).slice(0, 10) : today(),
          vehicle_no: editItem.vehicle_no ?? '',
          driver_name: editItem.driver_name ?? '',
          mobile_no: editItem.mobile_no ?? '',
          drivers_license_no: editItem.drivers_license_no ?? '',
          rc_copy_no: editItem.rc_copy_no ?? '',
          weight_fully_loaded: editItem.weight_fully_loaded ?? '',
          empty_weight: editItem.empty_weight || '',
          source_location_id: editItem.source_location_id ?? '',
          weigh_bridge_id: editItem.weigh_bridge_id ?? '',
          slip_number: editItem.slip_number ?? '',
          commodity_ids: editItem.commodity_ids ?? [],
          total_bags: editItem.total_bags ?? '',
        };
      }
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

  const suggestions = matchVehicles(vehicleHistory, vehicleQuery);

  const applyVehicle = (record: VehicleRecord) => {
    setForm((current) => ({
      ...current,
      vehicle_no: record.vehicle_no || current.vehicle_no,
      driver_name: record.driver_name || current.driver_name,
      mobile_no: record.mobile_no || current.mobile_no,
      drivers_license_no: record.drivers_license_no || current.drivers_license_no,
      rc_copy_no: record.rc_copy_no || current.rc_copy_no,
    }));
    setVehicleQuery('');
  };

  /** First failing rule, in the order the web form checks them. */
  const validate = (): { key: keyof FormState; message: string } | null => {
    if (!form.wbi_id) return { key: 'wbi_id', message: 'WBI ID is required' };
    if (form.vehicle_no && !isValidVehicleNumber(form.vehicle_no)) {
      return { key: 'vehicle_no', message: `Invalid vehicle number. ${VEHICLE_FORMAT_HINT}` };
    }

    if (isInitial) {
      if (!form.source_location_id) return { key: 'source_location_id', message: 'Source location is required' };
      if (!form.weigh_bridge_id) return { key: 'weigh_bridge_id', message: 'Weigh bridge is required' };
      if (!form.slip_number) return { key: 'slip_number', message: 'Slip number is required' };
      if (form.commodity_ids.length === 0) return { key: 'commodity_ids', message: 'At least one commodity is required' };
      if (form.total_bags === '' || Number(form.total_bags) <= 0) {
        return { key: 'total_bags', message: 'Total bags must be greater than 0' };
      }
      if (form.weight_fully_loaded === '' || Number(form.weight_fully_loaded) <= 0) {
        return { key: 'weight_fully_loaded', message: 'Loaded weight must be a valid number' };
      }
    } else {
      if (form.empty_weight === '' || Number(form.empty_weight) <= 0) {
        return { key: 'empty_weight', message: 'Empty weight must be a valid number' };
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

    const payload = {
      ...form,
      vehicle_no: form.vehicle_no ? formatVehicleNumber(form.vehicle_no) : '',
      total_bags: Number(form.total_bags || 0),
      weight_fully_loaded: Number(form.weight_fully_loaded || 0),
      empty_weight: Number(form.empty_weight || 0),
      net_weight: Number(form.weight_fully_loaded || 0) - Number(form.empty_weight || 0),
      images: editItem?.images ?? [],
      is_mutable: editItem ? editItem.is_mutable : true,
      is_deletable: editItem ? editItem.is_deletable : true,
    } as unknown as InwardWeighBridgeEntry;

    try {
      if (editItem) {
        await update.mutateAsync({ id: editItem._id, data: payload });
        toast.success('Weigh bridge entry updated');
      } else {
        await create.mutateAsync(payload);
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

  const errorFor = (key: keyof FormState) => (error?.key === key ? error.message : undefined);
  const gateLocked = !isInitial;

  return (
    <Screen edges={['top']}>
      <Header
        title={isEdit ? `Edit WBI ${form.wbi_id}` : 'New weigh-in'}
        subtitle={isInitial ? 'Loaded vehicle at the gate' : 'Record the empty weight'}
      />

      <Body>
        {!isInitial && (
          <Callout
            tone="info"
            title="Closing out a vehicle"
            description="Gate details are shown for reference. Only the empty weight can be changed here."
          />
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
              />
            </Field>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Weigh bridge" required error={errorFor('weigh_bridge_id')} style={{ flex: 1 }}>
                <Select
                  value={form.weigh_bridge_id}
                  options={lookups.weighBridgeOptions}
                  onChange={(value) => set('weigh_bridge_id', value)}
                  title="Weigh bridge"
                  disabled={gateLocked}
                  error={Boolean(errorFor('weigh_bridge_id'))}
                />
              </Field>
              <Field label="Slip number" required error={errorFor('slip_number')} style={{ flex: 1 }}>
                <Input
                  value={form.slip_number}
                  onChangeText={(value) => set('slip_number', value)}
                  readOnly={gateLocked}
                  error={Boolean(errorFor('slip_number'))}
                />
              </Field>
            </View>

            <Field label="Commodities" required error={errorFor('commodity_ids')}>
              <MultiSelect
                values={form.commodity_ids}
                options={lookups.commodityOptions}
                onChange={(values) => set('commodity_ids', values)}
                title="Commodities on board"
                disabled={gateLocked}
                error={Boolean(errorFor('commodity_ids'))}
              />
            </Field>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Weights" caption="Net weight is calculated for you" />
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Total bags" required={isInitial} error={errorFor('total_bags')} style={{ flex: 1 }}>
                <NumberInput
                  value={form.total_bags}
                  onChangeValue={(value) => set('total_bags', value)}
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

            {!isInitial && (
              <Field label="Empty weight" required error={errorFor('empty_weight')}>
                <NumberInput
                  value={form.empty_weight}
                  onChangeValue={(value) => set('empty_weight', value)}
                  suffix="kg"
                  autoFocus
                  error={Boolean(errorFor('empty_weight'))}
                />
              </Field>
            )}

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

        <Card>
          <SectionHeader title="Vehicle" caption="Start typing to reuse a previous vehicle" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Vehicle no" error={errorFor('vehicle_no')} hint={VEHICLE_FORMAT_HINT}>
              <Input
                value={form.vehicle_no}
                onChangeText={(value) => {
                  set('vehicle_no', value);
                  setVehicleQuery(value);
                }}
                onBlur={() => {
                  set('vehicle_no', formatVehicleNumber(form.vehicle_no));
                  setVehicleQuery('');
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="RJ-14-CA-1234"
                readOnly={gateLocked}
                error={Boolean(errorFor('vehicle_no'))}
              />
            </Field>

            {suggestions.length > 0 && !gateLocked && (
              <Animated.View
                entering={FadeIn.duration(160)}
                style={{
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.surfaceAlt,
                  overflow: 'hidden',
                }}
              >
                {suggestions.map((record) => (
                  <Pressable
                    key={record.vehicle_no}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${record.vehicle_no}, ${record.driver_name}`}
                    onPress={() => applyVehicle(record)}
                    style={({ pressed }) => ({
                      padding: theme.spacing.md,
                      gap: 1,
                      backgroundColor: pressed ? theme.colors.surfaceActive : 'transparent',
                    })}
                  >
                    <Text variant="bodyStrong">{record.vehicle_no}</Text>
                    <Text variant="caption" tone="muted">
                      {[record.driver_name, record.mobile_no].filter(Boolean).join(' · ') || 'No driver on file'}
                    </Text>
                  </Pressable>
                ))}
              </Animated.View>
            )}

            <Field label="Driver name">
              <Input
                value={form.driver_name}
                onChangeText={(value) => set('driver_name', value)}
                readOnly={gateLocked}
              />
            </Field>
            <Field label="Mobile no">
              <Input
                value={form.mobile_no}
                onChangeText={(value) => set('mobile_no', value)}
                keyboardType="phone-pad"
                readOnly={gateLocked}
              />
            </Field>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="License no" style={{ flex: 1 }}>
                <Input
                  value={form.drivers_license_no}
                  onChangeText={(value) => set('drivers_license_no', value)}
                  readOnly={gateLocked}
                />
              </Field>
              <Field label="RC copy no" style={{ flex: 1 }}>
                <Input
                  value={form.rc_copy_no}
                  onChangeText={(value) => set('rc_copy_no', value)}
                  readOnly={gateLocked}
                />
              </Field>
            </View>
          </View>
        </Card>
      </Body>

      <ActionBar>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button
          label={isEdit ? 'Save changes' : 'Create entry'}
          style={{ flex: 2 }}
          loading={create.isPending || update.isPending}
          onPress={submit}
        />
      </ActionBar>
    </Screen>
  );
}
