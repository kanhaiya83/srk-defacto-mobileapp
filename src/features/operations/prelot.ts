import type { Lot, PreLot, PreLotAllocation, StockLedgerEntry } from '@/api/operations-api';
import type { useMasterLookups } from '@/features/operations/lookups';
import { refId } from '@/lib/format';

type Lookups = ReturnType<typeof useMasterLookups>;

const SOURCE_LABELS: Record<string, string> = {
  INWARD: 'Inward',
  LOT_OUTPUT: 'Lot output',
  TRANSFER: 'Transfer',
  INITIAL_STOCK: 'Opening stock',
};

/** "Inward AT-1", "Lot output 4-1" — how a stock entry is named everywhere. */
export const stockEntryTitle = (entryNo?: string | null, sourceType?: string | null) =>
  `${SOURCE_LABELS[sourceType ?? 'INWARD'] ?? 'Stock'} ${entryNo ?? '—'}`;

/** Grade · location / sub-location · company — what tells two entries apart. */
export const stockEntrySubtitle = (entry: StockLedgerEntry, lookups: Lookups) => {
  const locationId = refId(entry.location_id);
  return [
    entry.grade_id?.grade_name ?? lookups.gradeName(refId(entry.grade_id)),
    `${lookups.locationName(locationId)} / ${lookups.subLocationName(locationId, entry.sub_location_id)}`,
    entry.company_id?.company_name ?? lookups.companyName(refId(entry.company_id)),
  ]
    .filter((part) => part && part !== '—' && part !== '— / —')
    .join(' · ');
};

type Allocation = PreLotAllocation & { consumed_weight_by_lots?: number };

/** One stock entry a pre-lot draws on, with every dated allocation from it. */
export interface PreLotEntry {
  stockId: string;
  entryNo: string;
  sourceType?: string;
  ratePerKg: number;
  bags: number;
  weight: number;
  consumedBags: number;
  consumedWeight: number;
  remainingBags: number;
  remainingWeight: number;
  rows: Allocation[];
}

/**
 * A pre-lot's allocations, per stock entry.
 *
 * The server repeats an entry's lot consumption and remainder on each of its
 * allocation rows, so they are read once per entry, not summed per row.
 */
export function preLotEntries(preLot: PreLot): PreLotEntry[] {
  const entries = new Map<string, PreLotEntry>();
  for (const row of (preLot.allocations ?? []) as Allocation[]) {
    const stockId = refId(row.stock_ledger_id);
    let entry = entries.get(stockId);
    if (!entry) {
      entry = {
        stockId,
        entryNo: row.entry_no ?? '—',
        sourceType: row.source_type,
        ratePerKg: row.inward_rate ?? 0,
        bags: 0,
        weight: 0,
        consumedBags: row.consumed_by_lots ?? 0,
        consumedWeight: row.consumed_weight_by_lots ?? 0,
        remainingBags: 0,
        remainingWeight: 0,
        rows: [],
      };
      entries.set(stockId, entry);
    }
    entry.bags += row.bags_allocated || 0;
    entry.weight += Number(row.allocated_weight) || 0;
    entry.rows.push(row);
  }
  for (const entry of entries.values()) {
    entry.remainingBags = Math.max(0, entry.bags - entry.consumedBags);
    entry.remainingWeight = Math.max(0, entry.weight - entry.consumedWeight);
  }
  return [...entries.values()];
}

export function preLotTotals(preLot: PreLot) {
  const entries = preLotEntries(preLot);
  const sum = (key: 'bags' | 'weight' | 'consumedBags' | 'consumedWeight' | 'remainingBags' | 'remainingWeight') =>
    entries.reduce((total, entry) => total + entry[key], 0);
  const weight = sum('weight');
  const value = entries.reduce((total, entry) => total + entry.weight * entry.ratePerKg, 0);
  return {
    entries,
    bags: sum('bags'),
    weight,
    consumedBags: sum('consumedBags'),
    consumedWeight: sum('consumedWeight'),
    remainingBags: sum('remainingBags'),
    remainingWeight: sum('remainingWeight'),
    /** Rupees per kg across the reserved stock (the server's avg_input_rate). */
    ratePerKg: preLot.avg_input_rate ?? (weight ? value / weight : 0),
  };
}

/** Lots drawing on a pre-lot. */
export const lotsOf = (preLot: PreLot, lots: Lot[]) => lots.filter((lot) => refId(lot.prelot_id) === preLot._id);
