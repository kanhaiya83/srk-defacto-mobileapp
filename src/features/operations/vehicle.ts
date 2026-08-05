/**
 * Vehicle-number handling, ported from the web client's WBI/WBO forms.
 *
 * Indian plates come in three shapes and operators type them without
 * separators, so the app normalises on blur rather than fighting them while
 * they type.
 */

const STANDARD = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/;
const BH_SERIES = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/;
const TEMPORARY = /^(TEMP[A-Z0-9]+|T[A-Z0-9]+)$/;

const strip = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** "rj14ca1234" → "RJ-14-CA-1234". Unrecognised input is only upper-cased. */
export function formatVehicleNumber(value: string): string {
  if (!value) return value;
  const stripped = strip(value);

  if (STANDARD.test(stripped)) return stripped.replace(STANDARD, '$1-$2-$3-$4');
  if (BH_SERIES.test(stripped)) return stripped.replace(BH_SERIES, '$1-$2-$3-$4');
  return value.toUpperCase();
}

/** Empty counts as valid — the field is optional on the weigh-in form. */
export function isValidVehicleNumber(value: string): boolean {
  if (!value) return true;
  const stripped = strip(value);
  return (
    /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/.test(stripped) ||
    /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(stripped) ||
    TEMPORARY.test(stripped)
  );
}

export const VEHICLE_FORMAT_HINT =
  'Standard (RJ-14-CA-1234), BH series (22-BH-1234-AA) or a temporary number.';

export interface VehicleRecord {
  vehicle_no: string;
  driver_name: string;
  mobile_no: string;
  drivers_license_no: string;
  rc_copy_no: string;
}

export const toVehicleRecord = (entry: Partial<VehicleRecord>): VehicleRecord => ({
  vehicle_no: entry.vehicle_no ?? '',
  driver_name: entry.driver_name ?? '',
  mobile_no: entry.mobile_no ?? '',
  drivers_license_no: entry.drivers_license_no ?? '',
  rc_copy_no: entry.rc_copy_no ?? '',
});

/**
 * Most recent record per vehicle. Drivers change between trips, so the newest
 * entry is the one worth suggesting.
 */
export function dedupeByVehicle(records: VehicleRecord[]): VehicleRecord[] {
  const seen = new Map<string, VehicleRecord>();
  for (const record of records) {
    const key = strip(record.vehicle_no);
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, record);
  }
  return [...seen.values()];
}

/** Suggestions for the vehicle field, matched on any identifying value. */
export function matchVehicles(records: VehicleRecord[], query: string, limit = 5): VehicleRecord[] {
  const q = strip(query);
  if (q.length < 2) return [];
  return records
    .filter(
      (record) =>
        strip(record.vehicle_no).includes(q) ||
        record.driver_name.toUpperCase().includes(query.toUpperCase()) ||
        record.mobile_no.includes(query)
    )
    .slice(0, limit);
}
