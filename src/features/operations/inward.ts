import type {
  BillAssignment,
  BillEntry,
  GenerateGrnEntry,
  GenerateGrnEntryItem,
  InwardEntry,
} from '@/api/operations-api';
import { refId } from '@/lib/format';

/**
 * The inward pipeline, as the web client and server define it:
 *
 *   GRN fully allocated → bills raised against it → each bill's bags and weight
 *   assigned to the GRN's lines → "Create inward" turns the assignments into
 *   inward entries and stock, and locks the GRN and its bills.
 */

export const bagsAllocated = (grn: GenerateGrnEntry) =>
  (grn.entries ?? []).reduce((sum, entry) => sum + (entry.bags_used || 0), 0);

/** A GRN reaches inward once every bag on the truck is placed on a line. */
export const isFullyAllocated = (grn: GenerateGrnEntry) =>
  grn.total_bags > 0 && bagsAllocated(grn) === grn.total_bags;

/** GRN lines that already have an inward entry. */
export const inwardItemIds = (inwards: InwardEntry[]) =>
  new Set(inwards.map((entry) => refId(entry.grn_entry_item_id)).filter(Boolean));

/** Stock exists for the GRN: its bills' quantities, amounts and assignments are locked. */
export const isInwardLocked = (grn: GenerateGrnEntry, inwards: InwardEntry[]) =>
  Boolean(grn.inward_created) || inwards.some((entry) => refId(entry.grn_id) === grn._id);

/** What a bill's assignments must add up to — the server counts adjustments. */
export const billTarget = (bill: BillEntry) => ({
  bags: (bill.total_bags || 0) + (bill.adjustment_bags || 0),
  weight: (bill.bill_weight || 0) + (bill.adjustment_weight || 0),
});

export const assignedTo = (bill: BillEntry, assignments: BillAssignment[]) => {
  const own = assignments.filter((row) => row.bill_entry_id === bill._id);
  return {
    rows: own,
    bags: own.reduce((sum, row) => sum + (row.assigned_bags || 0), 0),
    weight: own.reduce((sum, row) => sum + (row.assigned_weight || 0), 0),
  };
};

/** Same tolerance as the server: whole bags, weight to a hundredth of a kg. */
export const totalsMatch = (bags: number, weight: number, target: { bags: number; weight: number }) =>
  Math.round(bags) === Math.round(target.bags) && Math.abs(weight - target.weight) <= 0.01;

export type BillStatus = 'assigned' | 'partial' | 'unassigned';

export const billStatus = (bill: BillEntry, assignments: BillAssignment[]): BillStatus => {
  const done = assignedTo(bill, assignments);
  if (totalsMatch(done.bags, done.weight, billTarget(bill))) return 'assigned';
  return done.bags > 0 ? 'partial' : 'unassigned';
};

/** Where a GRN stands on the way to inward, and what is still missing. */
export function grnReadiness(
  grn: GenerateGrnEntry,
  bills: BillEntry[],
  assignments: BillAssignment[],
  inwards: InwardEntry[]
) {
  const billedBags = bills.reduce((sum, bill) => sum + (bill.total_bags || 0), 0);
  const assignedBags = assignments.reduce((sum, row) => sum + (row.assigned_bags || 0), 0);
  const unassignedBills = bills.filter((bill) => billStatus(bill, assignments) !== 'assigned').length;
  const created = isInwardLocked(grn, inwards);
  const total = grn.total_bags || 0;

  let blocker: string | null = null;
  if (created) blocker = 'Inward entries already created';
  else if (bills.length === 0) blocker = 'Add the bills for this GRN';
  else if (billedBags < total) blocker = `${total - billedBags} bags still to bill`;
  else if (unassignedBills > 0) blocker = `${unassignedBills} bill${unassignedBills === 1 ? '' : 's'} still to assign`;
  else if (assignedBags < total) blocker = `${total - assignedBags} bags still to assign`;

  return {
    total,
    billedBags,
    assignedBags,
    billedWeight: bills.reduce((sum, bill) => sum + (bill.bill_weight || 0), 0),
    billedAmount: bills.reduce((sum, bill) => sum + (bill.amount || 0), 0),
    created,
    canCreateInward: blocker === null,
    blocker,
  };
}

/** Bags each GRN line has taken from all bills. */
export const lineTotals = (assignments: BillAssignment[]) => {
  const totals: Record<string, { bags: number; weight: number }> = {};
  for (const row of assignments) {
    const entry = (totals[row.grn_entry_item_id] ??= { bags: 0, weight: 0 });
    entry.bags += row.assigned_bags || 0;
    entry.weight += row.assigned_weight || 0;
  }
  return totals;
};

/** Lines a bill can be assigned to: those of the bill's grade. */
export const linesForBill = (grn: GenerateGrnEntry, bill: BillEntry): GenerateGrnEntryItem[] =>
  (grn.entries ?? []).filter((item) => item.grade_id === bill.grade_id);

/** Bags a line can still take from this bill: its size less what other bills took. */
export const lineCapacity = (item: GenerateGrnEntryItem, bill: BillEntry, assignments: BillAssignment[]) =>
  Math.max(
    0,
    (item.bags_used || 0) -
      assignments
        .filter((row) => row.grn_entry_item_id === item._id && row.bill_entry_id !== bill._id)
        .reduce((sum, row) => sum + (row.assigned_bags || 0), 0)
  );

/**
 * Weight that goes with a number of bags, as the web assigns it: the bill's
 * average per remaining bag, and exactly the remainder once the last bags go,
 * so the weights always add up to the bill's.
 */
export function weightForBags(
  bags: number,
  target: { bags: number; weight: number },
  otherRows: { bags: number; weight: number }
): number {
  if (bags <= 0) return 0;
  const remainingBags = Math.max(0, target.bags - otherRows.bags);
  const remainingWeight = Math.max(0, target.weight - otherRows.weight);
  if (remainingBags <= 0) return 0;
  if (bags >= remainingBags) return Number(remainingWeight.toFixed(2));
  return Number(((bags * remainingWeight) / remainingBags).toFixed(2));
}

type AnyBill = Partial<BillEntry> & { _id?: string; company_id?: unknown };

/** A bill as it counts toward one inward entry, plus the whole bill it came from. */
export type InwardBill = AnyBill & { fullBill: AnyBill };

/**
 * An inward entry's bills, cut down to the part assigned to it.
 *
 * A bill can be split across several inward entries; each holds only its own
 * assignment. Quantities come from the assignment and money is prorated by
 * weight, exactly as the server and the web challan report do.
 */
export function inwardBills(entry: InwardEntry): InwardBill[] {
  const bills = (entry.bill_entry_ids ?? []) as unknown as AnyBill[];
  const assignments = (entry.bill_assignment_ids ?? []) as unknown as Partial<BillAssignment>[];
  const byBill = new Map(assignments.filter((row) => row?.bill_entry_id).map((row) => [String(row.bill_entry_id), row]));

  return bills.map((bill) => {
    const share = byBill.get(String(bill._id));
    if (!share) return { ...bill, fullBill: bill }; // older inwards: the whole bill
    const bags = share.assigned_bags ?? bill.total_bags ?? 0;
    const weight = share.assigned_weight ?? bill.bill_weight ?? 0;
    const ratio = bill.bill_weight ? weight / bill.bill_weight : bill.total_bags ? bags / bill.total_bags : 1;
    const part = (value?: number) => (value || 0) * ratio;
    return {
      ...bill,
      total_bags: bags,
      bill_weight: weight,
      amount: part(bill.amount),
      amount_before_gst: part(bill.amount_before_gst),
      amount_after_gst: part(bill.amount_after_gst),
      cgst: part(bill.cgst),
      sgst: part(bill.sgst),
      igst: part(bill.igst),
      discount: part(bill.discount),
      net_amount: part(bill.net_amount),
      fullBill: bill,
    };
  });
}

export function inwardTotals(entry: InwardEntry) {
  const bills = inwardBills(entry);
  const sum = (key: keyof AnyBill) => bills.reduce((total, bill) => total + (Number(bill[key]) || 0), 0);
  return {
    bills,
    count: bills.length,
    bags: sum('total_bags'),
    weight: sum('bill_weight'),
    amount: sum('amount'),
    beforeGst: sum('amount_before_gst'),
    afterGst: sum('amount_after_gst'),
    cgst: sum('cgst'),
    sgst: sum('sgst'),
    igst: sum('igst'),
    discount: sum('discount'),
    net: sum('net_amount'),
    companyId: refId(bills[0]?.company_id),
  };
}
