/**
 * Purchase-bill arithmetic, ported from the web client's bill entry form.
 *
 * Every expense line is taxable, so they are summed before GST is applied.
 * Whether that GST splits into CGST/SGST or lands as IGST depends on the
 * party's state — intra-state trade splits, inter-state does not.
 */

export interface BillCharges {
  amount: number;
  other_exp1: number;
  other_exp2: number;
  other_exp3: number;
  adhat_exp: number;
  dalali: number;
  kkc: number;
  mandi_tax: number;
  labour_exp: number;
  transport_amount: number;
  discount: number;
  bill_weight: number;
}

export interface BillComputation {
  rate: number;
  amount_before_gst: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount_after_gst: number;
  net_amount: number;
}

/** The home state; a party here is charged CGST + SGST rather than IGST. */
const HOME_STATE = ['rajasthan', 'rj'];

export const isIntraState = (partyState?: string | null): boolean =>
  Boolean(partyState && HOME_STATE.includes(partyState.trim().toLowerCase()));

export function computeBill(
  charges: Partial<BillCharges>,
  options: { taxRatePercent: number; partyState?: string | null; hasParty: boolean }
): BillComputation {
  const value = (input?: number) => Number(input || 0);

  const before =
    value(charges.amount) +
    value(charges.other_exp1) +
    value(charges.other_exp2) +
    value(charges.other_exp3) +
    value(charges.adhat_exp) +
    value(charges.dalali) +
    value(charges.kkc) +
    value(charges.mandi_tax) +
    value(charges.labour_exp) +
    value(charges.transport_amount);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (options.hasParty && options.taxRatePercent >= 0) {
    const tax = (before * options.taxRatePercent) / 100;
    if (isIntraState(options.partyState)) {
      cgst = tax / 2;
      sgst = tax / 2;
    } else {
      igst = tax;
    }
  }

  const after = before + cgst + sgst + igst;
  // Bills are settled in whole rupees.
  const net = Math.round(after - value(charges.discount));
  const rate = charges.amount && charges.bill_weight ? value(charges.amount) / value(charges.bill_weight) : 0;

  return {
    rate,
    amount_before_gst: before,
    cgst,
    sgst,
    igst,
    amount_after_gst: after,
    net_amount: net,
  };
}

/** E-way bill numbers are exactly twelve digits. */
export const isValidEwayNumber = (value?: string | null): boolean =>
  !value || /^\d{12}$/.test(String(value).trim());
