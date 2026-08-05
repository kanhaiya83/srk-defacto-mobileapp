import type { StockLedgerEntry } from '@/api/operations-api';
import { refId } from '@/lib/format';

/**
 * Stock ledger maths, ported from the web client's inventory helpers.
 *
 * One ledger row is a batch, and every bag in it is in exactly one of six
 * states. `available` is what is left after the other five are taken out —
 * derived rather than stored, so a partially reserved batch can never look
 * fully available.
 */

export interface StockBreakdown {
  available_bags: number;
  available_weight: number;
  prelot_bags: number;
  prelot_weight: number;
  preoutward_bags: number;
  preoutward_weight: number;
  consumed_bags: number;
  consumed_weight: number;
  dispatched_bags: number;
  dispatched_weight: number;
  transferred_bags: number;
  transferred_weight: number;
}

export function getStockBreakdown(entry: StockLedgerEntry): StockBreakdown {
  const transferred_bags = entry.transferred_bags || 0;
  const transferred_weight = entry.transferred_weight || 0;

  const available_bags = Math.max(
    0,
    entry.original_bags -
      entry.allocated_bags -
      entry.outward_allocated_bags -
      entry.consumed_bags -
      entry.outward_bags -
      transferred_bags
  );
  const available_weight = Math.max(
    0,
    entry.original_weight -
      entry.allocated_weight -
      entry.outward_allocated_weight -
      entry.consumed_weight -
      entry.outward_weight -
      transferred_weight
  );

  return {
    available_bags,
    available_weight,
    prelot_bags: entry.allocated_bags,
    prelot_weight: entry.allocated_weight,
    preoutward_bags: entry.outward_allocated_bags,
    preoutward_weight: entry.outward_allocated_weight,
    consumed_bags: entry.consumed_bags,
    consumed_weight: entry.consumed_weight,
    dispatched_bags: entry.outward_bags,
    dispatched_weight: entry.outward_weight,
    transferred_bags,
    transferred_weight,
  };
}

export interface StockTotals extends StockBreakdown {
  total_bags: number;
  total_weight: number;
  total_value: number;
}

export function computeTotals(entries: StockLedgerEntry[]): StockTotals {
  const totals: StockTotals = {
    total_bags: 0,
    total_weight: 0,
    total_value: 0,
    available_bags: 0,
    available_weight: 0,
    prelot_bags: 0,
    prelot_weight: 0,
    preoutward_bags: 0,
    preoutward_weight: 0,
    consumed_bags: 0,
    consumed_weight: 0,
    dispatched_bags: 0,
    dispatched_weight: 0,
    transferred_bags: 0,
    transferred_weight: 0,
  };

  for (const entry of entries) {
    const breakdown = getStockBreakdown(entry);
    totals.total_bags += entry.original_bags;
    totals.total_weight += entry.original_weight;
    totals.total_value += entry.original_amount;
    totals.available_bags += breakdown.available_bags;
    totals.available_weight += breakdown.available_weight;
    totals.prelot_bags += breakdown.prelot_bags;
    totals.prelot_weight += breakdown.prelot_weight;
    totals.preoutward_bags += breakdown.preoutward_bags;
    totals.preoutward_weight += breakdown.preoutward_weight;
    totals.consumed_bags += breakdown.consumed_bags;
    totals.consumed_weight += breakdown.consumed_weight;
    totals.dispatched_bags += breakdown.dispatched_bags;
    totals.dispatched_weight += breakdown.dispatched_weight;
    totals.transferred_bags += breakdown.transferred_bags;
    totals.transferred_weight += breakdown.transferred_weight;
  }

  return totals;
}

export type SourceFilter = 'ALL' | 'INWARD' | 'LOT_OUTPUT' | 'TRANSFER' | 'INITIAL_STOCK';
export type StatusFilter = 'ALL' | 'AVAILABLE' | 'PRELOT' | 'PREOUTWARD' | 'CONSUMED' | 'DISPATCHED' | 'TRANSFERRED';

export interface StockFilterState {
  source: SourceFilter;
  status: StatusFilter;
  commodity: string;
  grade: string;
  location: string;
  companyGroup: string;
}

export const defaultStockFilters: StockFilterState = {
  source: 'ALL',
  status: 'AVAILABLE',
  commodity: '',
  grade: '',
  location: '',
  companyGroup: '',
};

export function applyStockFilters(entries: StockLedgerEntry[], filters: StockFilterState): StockLedgerEntry[] {
  return entries.filter((entry) => {
    if (filters.source !== 'ALL' && entry.source_type !== filters.source) return false;
    if (filters.commodity && refId(entry.commodity_id) !== filters.commodity) return false;
    if (filters.grade && refId(entry.grade_id) !== filters.grade) return false;
    if (filters.location && refId(entry.location_id) !== filters.location) return false;
    if (filters.companyGroup && refId(entry.company_group_id) !== filters.companyGroup) return false;

    if (filters.status !== 'ALL') {
      const breakdown = getStockBreakdown(entry);
      const byStatus: Record<Exclude<StatusFilter, 'ALL'>, number> = {
        AVAILABLE: breakdown.available_bags,
        PRELOT: breakdown.prelot_bags,
        PREOUTWARD: breakdown.preoutward_bags,
        CONSUMED: breakdown.consumed_bags,
        DISPATCHED: breakdown.dispatched_bags,
        TRANSFERRED: breakdown.transferred_bags,
      };
      if (byStatus[filters.status] <= 0) return false;
    }

    return true;
  });
}

export interface StockGroup {
  key: string;
  label: string;
  sublabel: string;
  bags: number;
  weight: number;
  value: number;
  entries: StockLedgerEntry[];
}

/**
 * Rolls batches up to one row per commodity + grade + bag type.
 *
 * A phone list of 400 individual batches is unreadable; the grouped view is
 * what someone actually wants to know ("how much B-grade wheat do we have?"),
 * with the batches one tap below it.
 */
export function groupStock(
  entries: StockLedgerEntry[],
  label: (entry: StockLedgerEntry) => { label: string; sublabel: string; key: string }
): StockGroup[] {
  const groups = new Map<string, StockGroup>();

  for (const entry of entries) {
    const { key, label: title, sublabel } = label(entry);
    const breakdown = getStockBreakdown(entry);
    const existing = groups.get(key);
    const weightShare = entry.original_weight > 0 ? breakdown.available_weight / entry.original_weight : 0;

    if (existing) {
      existing.bags += breakdown.available_bags;
      existing.weight += breakdown.available_weight;
      existing.value += entry.original_amount * weightShare;
      existing.entries.push(entry);
    } else {
      groups.set(key, {
        key,
        label: title,
        sublabel,
        bags: breakdown.available_bags,
        weight: breakdown.available_weight,
        value: entry.original_amount * weightShare,
        entries: [entry],
      });
    }
  }

  return [...groups.values()].sort((a, b) => b.bags - a.bags);
}
