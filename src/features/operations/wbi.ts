import type { InwardWeighBridgeEntry } from '@/api/operations-api';

/** The vehicle has been weighed out, so the entry has its net weight. */
export const isWeighed = (entry: InwardWeighBridgeEntry) => Number(entry.empty_weight) > 0;

/**
 * Where "Edit" leads for an entry, or `null` when it is locked.
 *
 * The server lets a GRN-linked entry take only its empty weight, and only until
 * that is recorded — so such an entry edits in final mode, then locks.
 */
export function wbiEditPath(entry: InwardWeighBridgeEntry): string | null {
  if (entry.is_mutable) return `/operations/wbi/form?mode=initial&id=${entry._id}`;
  return isWeighed(entry) ? null : `/operations/wbi/form?mode=final&id=${entry._id}`;
}

export const WBI_LOCKED_REASON = 'Locked — used in a GRN and the empty weight is recorded';
