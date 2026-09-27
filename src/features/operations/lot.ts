import type { Lot, LotOutput, PreLot, StockLedgerEntry } from '@/api/operations-api';
import type { Machine } from '@/api/masters-api';
import type { useMasterLookups } from '@/features/operations/lookups';
import { preLotEntries, stockEntrySubtitle, stockEntryTitle } from '@/features/operations/prelot';
import type { StockLine, StockSource } from '@/features/operations/stock-lines';
import { refId, today } from '@/lib/format';

type Lookups = ReturnType<typeof useMasterLookups>;

export const dayOf = (value?: string | Date | null) => (value ? String(value).slice(0, 10) : '');

/** This lot's own inputs, per stock entry — free to it again while it is edited. */
const heldBy = (lot?: Lot | null) => {
  const held = new Map<string, { bags: number; weight: number }>();
  for (const input of lot?.inputs ?? []) {
    const key = refId(input.stock_ledger_id);
    const entry = held.get(key) ?? { bags: 0, weight: 0 };
    entry.bags += input.bags_consumed || 0;
    entry.weight += input.consumed_weight || 0;
    held.set(key, entry);
  }
  return held;
};

/**
 * What a lot may consume: the pre-lot's reserved stock not yet used by other
 * lots. The server counts this lot's own inputs as used, so they are added back.
 */
export function lotInputSources(
  preLot: PreLot | undefined,
  lot: Lot | null | undefined,
  ledger: StockLedgerEntry[],
  lookups: Lookups
): StockSource[] {
  if (!preLot) return [];
  const held = heldBy(lot);
  const byId = new Map(ledger.map((entry) => [entry._id, entry]));
  return preLotEntries(preLot).map((entry) => {
    const own = held.get(entry.stockId) ?? { bags: 0, weight: 0 };
    const stock = byId.get(entry.stockId);
    return {
      id: entry.stockId,
      title: stockEntryTitle(entry.entryNo, entry.sourceType),
      subtitle: stock ? stockEntrySubtitle(stock, lookups) : undefined,
      capBags: entry.remainingBags + own.bags,
      capWeight: entry.remainingWeight + own.weight,
      ratePerKg: entry.ratePerKg,
    };
  });
}

export const lotInputLines = (lot: Lot): StockLine[] =>
  (lot.inputs ?? []).map((input, index) => ({
    key: input._id ?? `input-${index}`,
    sourceId: refId(input.stock_ledger_id),
    bags: input.bags_consumed || 0,
    weight: input.consumed_weight || 0,
    date: dayOf(input.date) || today(),
  }));

/**
 * Whether a machine can take a lot. The server allows one unfinished lot per
 * machine, and a machine can also be locked to a lot; either rules it out.
 */
export function machineBusyWith(machine: Machine, lots: Lot[], lotId?: string): number | null {
  if (machine.locked_in_lot && machine.locked_in_lot._id !== lotId) return machine.locked_in_lot.lot_no;
  const running = lots.find((lot) => !lot.is_complete && lot._id !== lotId && refId(lot.machine_id) === machine._id);
  return running ? running.lot_no : null;
}

export const outputWeight = (output: Pick<LotOutput, 'bags' | 'avg_weight_per_bag'>) =>
  (Number(output.bags) || 0) * (Number(output.avg_weight_per_bag) || 0);

/** Outputs as the server takes them back: ids, not populated objects, and each output's own `_id`. */
export const outputsPayload = (outputs: LotOutput[]): LotOutput[] =>
  outputs.map((output) => ({
    ...(output._id ? { _id: output._id } : {}),
    grade_id: refId(output.grade_id),
    bag_type_id: refId(output.bag_type_id),
    bags: Number(output.bags) || 0,
    avg_weight_per_bag: Number(output.avg_weight_per_bag) || 0,
    total_amount: Number(output.total_amount) || 0,
    location_id: refId(output.location_id),
    sub_location_id: output.sub_location_id,
    date: dayOf(output.date) || today(),
  }));

export interface LotBalance {
  inputBags: number;
  inputWeight: number;
  inputAmount: number;
  outputBags: number;
  outputWeight: number;
  outputAmount: number;
  wasteBags: number;
  weightGap: number;
  amountGap: number;
  /** Output weight may differ from input by up to this much. */
  weightTolerance: number;
  weightOk: boolean;
  amountOk: boolean;
  /** Why the lot cannot be completed yet, or null. */
  blocker: string | null;
}

/** The server's completion rules: output weight within 5% of input, amount within ₹1. */
export function lotBalance(lot: Lot, outputs: LotOutput[] = lot.outputs ?? []): LotBalance {
  const inputBags = lot.total_input_bags ?? (lot.inputs ?? []).reduce((sum, input) => sum + (input.bags_consumed || 0), 0);
  const inputWeight = lot.total_input_weight ?? (lot.inputs ?? []).reduce((sum, input) => sum + (input.consumed_weight || 0), 0);
  const inputAmount = lot.total_input_amount ?? 0;
  const outputBags = outputs.reduce((sum, output) => sum + (Number(output.bags) || 0), 0);
  const outWeight = outputs.reduce((sum, output) => sum + outputWeight(output), 0);
  const outputAmount = outputs.reduce((sum, output) => sum + (Number(output.total_amount) || 0), 0);
  const weightTolerance = inputWeight * 0.05;
  const weightGap = outWeight - inputWeight;
  const amountGap = outputAmount - inputAmount;
  const weightOk = inputWeight <= 0 || Math.abs(weightGap) <= weightTolerance;
  const amountOk = Math.abs(amountGap) <= 1;

  let blocker: string | null = null;
  if (lot.is_complete) blocker = 'Already complete';
  else if (inputBags === 0) blocker = 'The lot has no inputs';
  else if (outputs.length === 0) blocker = 'Record the output first';
  else if (!weightOk) blocker = 'Output weight is more than 5% off the input';
  else if (!amountOk) blocker = 'Output value does not match the input value';

  return {
    inputBags,
    inputWeight,
    inputAmount,
    outputBags,
    outputWeight: outWeight,
    outputAmount,
    wasteBags: lot.waste_bags || 0,
    weightGap,
    amountGap,
    weightTolerance,
    weightOk,
    amountOk,
    blocker,
  };
}

/** Output per grade, for the reconciliation. */
export function outputsByGrade(outputs: LotOutput[]) {
  const grades = new Map<string, { gradeId: string; bags: number; weight: number; amount: number }>();
  for (const output of outputs) {
    const gradeId = refId(output.grade_id);
    const entry = grades.get(gradeId) ?? { gradeId, bags: 0, weight: 0, amount: 0 };
    entry.bags += Number(output.bags) || 0;
    entry.weight += outputWeight(output);
    entry.amount += Number(output.total_amount) || 0;
    grades.set(gradeId, entry);
  }
  return [...grades.values()].map((grade) => ({ ...grade, ratePerKg: grade.weight ? grade.amount / grade.weight : 0 }));
}

/** Every output of a grade priced at one rate per kg. */
export const priceGrade = (outputs: LotOutput[], gradeId: string, ratePerKg: number) =>
  outputs.map((output) =>
    refId(output.grade_id) === gradeId
      ? { ...output, total_amount: Number((ratePerKg * outputWeight(output)).toFixed(2)) }
      : output
  );

/**
 * The web's "Adjust": price the heaviest grade so the output value equals the
 * input value exactly. Returns an error message when that is impossible.
 */
export function balanceOutputs(outputs: LotOutput[], inputAmount: number): { outputs: LotOutput[] } | { error: string } {
  if (outputs.length === 0) return { error: 'Add at least one output first' };
  if (inputAmount <= 0) return { error: 'The lot has no input value' };
  const grades = outputsByGrade(outputs);
  const heaviest = grades.reduce((best, grade) => (grade.weight > best.weight ? grade : best), grades[0]);
  const others = grades.filter((grade) => grade.gradeId !== heaviest.gradeId).reduce((sum, grade) => sum + grade.amount, 0);
  const amount = inputAmount - others;
  if (amount < 0) return { error: 'The other grades are already worth more than the input — lower them first' };
  if (heaviest.weight <= 0) return { error: 'The heaviest grade has no weight' };
  return { outputs: priceGrade(outputs, heaviest.gradeId, amount / heaviest.weight) };
}

/** `YYYY-MM-DD` as a local calendar day, for date pickers' bounds. */
export const localDay = (value?: string | null) => {
  const [y, m, d] = (value ?? '').slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};
