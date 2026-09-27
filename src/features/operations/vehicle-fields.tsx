import { useMemo } from 'react';
import { View } from 'react-native';

import { useInwardWeighBridgeEntries, useOutwardWeighBridgeEntries } from '@/api/operations-api';
import { Field, Input } from '@/components/ui/field';
import { Select, type Option } from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/theme';
import {
  dedupeByVehicle,
  formatVehicleNumber,
  toVehicleRecord,
  VEHICLE_FORMAT_HINT,
  type VehicleRecord,
} from './vehicle';

/**
 * Vehicles seen at either weigh bridge, newest first, one row per vehicle.
 * `prefer` lists the flow's own history first so its driver details win when
 * the same truck appears on both sides — as the web forms do.
 */
export function useVehicleHistory(prefer: 'inward' | 'outward'): VehicleRecord[] {
  const { can } = usePermissions();
  const inward = useInwardWeighBridgeEntries(can('wbi:read'));
  const outward = useOutwardWeighBridgeEntries(can('wbo:read'));

  return useMemo(() => {
    const byNewest = <T extends { createdAt?: string; updatedAt?: string }>(rows: T[]) =>
      [...rows].sort((a, b) => String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? '')));
    const inwardRows = byNewest(inward.data ?? []).map(toVehicleRecord);
    const outwardRows = byNewest(outward.data ?? []).map(toVehicleRecord);
    return dedupeByVehicle(prefer === 'inward' ? [...inwardRows, ...outwardRows] : [...outwardRows, ...inwardRows]);
  }, [inward.data, outward.data, prefer]);
}

/**
 * Vehicle and driver details for the weigh bridge forms.
 *
 * The web suggests past vehicles in a dropdown under each field. On a phone
 * that list opens straight behind the keyboard, so here a previous vehicle is
 * picked from a searchable sheet instead — search matches the plate, driver,
 * mobile, licence or RC — and fills all five fields at once.
 */
export function VehicleFields({
  value,
  onChange,
  onApply,
  history,
  readOnly,
  vehicleError,
}: {
  value: VehicleRecord;
  onChange: (field: keyof VehicleRecord, text: string) => void;
  onApply: (record: VehicleRecord) => void;
  history: VehicleRecord[];
  readOnly?: boolean;
  vehicleError?: string;
}) {
  const theme = useTheme();

  const options = useMemo<Option[]>(
    () =>
      history.map((record) => ({
        value: record.vehicle_no,
        label: record.vehicle_no,
        description:
          [
            record.driver_name,
            record.mobile_no,
            record.drivers_license_no && `DL ${record.drivers_license_no}`,
            record.rc_copy_no && `RC ${record.rc_copy_no}`,
          ]
            .filter(Boolean)
            .join(' · ') || 'No driver on file',
      })),
    [history]
  );

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {!readOnly && history.length > 0 && (
        <Field label="Previous vehicle" hint="Fills in the plate and driver details below">
          <Select
            value={null}
            options={options}
            onChange={(plate) => {
              const record = history.find((row) => row.vehicle_no === plate);
              if (record) onApply(record);
            }}
            title="Previous vehicles"
            placeholder="Pick a vehicle seen before"
          />
        </Field>
      )}

      <Field label="Vehicle no" error={vehicleError} hint={readOnly ? undefined : VEHICLE_FORMAT_HINT}>
        <Input
          value={value.vehicle_no}
          onChangeText={(text) => onChange('vehicle_no', text)}
          onBlur={() => onChange('vehicle_no', formatVehicleNumber(value.vehicle_no))}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="RJ-14-CA-1234"
          readOnly={readOnly}
          error={Boolean(vehicleError)}
        />
      </Field>
      <Field label="Driver name">
        <Input value={value.driver_name} onChangeText={(text) => onChange('driver_name', text)} readOnly={readOnly} />
      </Field>
      <Field label="Mobile no">
        <Input
          value={value.mobile_no}
          onChangeText={(text) => onChange('mobile_no', text)}
          keyboardType="phone-pad"
          readOnly={readOnly}
        />
      </Field>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Field label="License no" style={{ flex: 1 }}>
          <Input
            value={value.drivers_license_no}
            onChangeText={(text) => onChange('drivers_license_no', text)}
            autoCapitalize="characters"
            autoCorrect={false}
            readOnly={readOnly}
          />
        </Field>
        <Field label="RC copy no" style={{ flex: 1 }}>
          <Input
            value={value.rc_copy_no}
            onChangeText={(text) => onChange('rc_copy_no', text)}
            autoCapitalize="characters"
            autoCorrect={false}
            readOnly={readOnly}
          />
        </Field>
      </View>
    </View>
  );
}
