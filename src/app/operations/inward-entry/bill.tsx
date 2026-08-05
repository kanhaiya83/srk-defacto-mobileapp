import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  useBillEntriesByGrn,
  useCreateBillEntry,
  useGenerateGrnEntries,
  type BillEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Loading } from '@/components/ui/feedback';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { Accordion, Callout, DetailRow } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { computeBill, isIntraState, isValidEwayNumber } from '@/features/operations/bill-maths';
import { useMasterLookups } from '@/features/operations/lookups';
import { formatCurrency, formatNumber, refId, today } from '@/lib/format';
import { useTheme } from '@/theme';

type Charges = {
  amount: number | '';
  other_exp1: number | '';
  other_exp2: number | '';
  other_exp3: number | '';
  adhat_exp: number | '';
  dalali: number | '';
  kkc: number | '';
  mandi_tax: number | '';
  labour_exp: number | '';
  transport_amount: number | '';
  discount: number | '';
};

const blankCharges = (): Charges => ({
  amount: '',
  other_exp1: '',
  other_exp2: '',
  other_exp3: '',
  adhat_exp: '',
  dalali: '',
  kkc: '',
  mandi_tax: '',
  labour_exp: '',
  transport_amount: '',
  discount: '',
});

const EXPENSE_FIELDS: { key: keyof Charges; label: string }[] = [
  { key: 'adhat_exp', label: 'Adhat' },
  { key: 'dalali', label: 'Dalali' },
  { key: 'kkc', label: 'KKC' },
  { key: 'mandi_tax', label: 'Mandi tax' },
  { key: 'labour_exp', label: 'Labour' },
  { key: 'transport_amount', label: 'Transport' },
  { key: 'other_exp1', label: 'Other 1' },
  { key: 'other_exp2', label: 'Other 2' },
  { key: 'other_exp3', label: 'Other 3' },
];

/**
 * Purchase bill against a GRN line.
 *
 * Totals recompute on every keystroke and are pinned in a summary card, because
 * the number the operator is checking against the paper bill is the net amount,
 * not any of the twelve inputs that feed it.
 */
export default function BillEntryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { grn: grnId, item: itemId } = useLocalSearchParams<{ grn: string; item: string }>();
  const lookups = useMasterLookups();

  const grns = useGenerateGrnEntries();
  const existingBills = useBillEntriesByGrn(grnId ?? '');
  const create = useCreateBillEntry();

  const grn = (grns.data ?? []).find((entry) => entry._id === grnId);
  const item = grn?.entries?.find((entry) => entry._id === itemId);

  const [companyId, setCompanyId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState(today());
  const [ewayNo, setEwayNo] = useState('');
  const [totalBags, setTotalBags] = useState<number | ''>('');
  const [billWeight, setBillWeight] = useState<number | ''>('');
  const [taxRate, setTaxRate] = useState<number | ''>(5);
  const [charges, setCharges] = useState<Charges>(blankCharges);
  const [remarks, setRemarks] = useState('');

  /** Bags on this GRN line minus what previous bills already claimed. */
  const remainingBags = useMemo(() => {
    if (!item) return 0;
    const claimed = (existingBills.data ?? [])
      .filter((bill) => bill.grn_entry_item_id === item._id)
      .reduce((sum, bill) => sum + (bill.total_bags || 0), 0);
    return (item.bags_used || 0) - claimed;
  }, [item, existingBills.data]);

  const party = lookups.raw.vendors.find((vendor) => vendor._id === partyId);

  const computed = computeBill(
    {
      amount: Number(charges.amount || 0),
      other_exp1: Number(charges.other_exp1 || 0),
      other_exp2: Number(charges.other_exp2 || 0),
      other_exp3: Number(charges.other_exp3 || 0),
      adhat_exp: Number(charges.adhat_exp || 0),
      dalali: Number(charges.dalali || 0),
      kkc: Number(charges.kkc || 0),
      mandi_tax: Number(charges.mandi_tax || 0),
      labour_exp: Number(charges.labour_exp || 0),
      transport_amount: Number(charges.transport_amount || 0),
      discount: Number(charges.discount || 0),
      bill_weight: Number(billWeight || 0),
    },
    { taxRatePercent: Number(taxRate || 0), partyState: party?.state, hasParty: Boolean(party) }
  );

  const submit = async () => {
    if (!companyId) return toast.error('Company is required');
    if (!partyId) return toast.error('Party is required');
    if (!billNo) return toast.error('Bill number is required');
    if (totalBags === '' || Number(totalBags) <= 0) return toast.error('Total bags must be greater than 0');
    if (Number(totalBags) > remainingBags) return toast.error(`Cannot exceed the remaining bags (${remainingBags})`);
    if (!isValidEwayNumber(ewayNo)) return toast.error('E-way number must be exactly 12 digits');

    const payload = {
      grn_id: grnId,
      grn_entry_item_id: itemId,
      commodity_id: item?.commodity_id,
      grade_id: item?.grade_id,
      baradana_type_id: item?.bag_type_id,
      company_id: companyId,
      party_id: partyId,
      agent_id: agentId || undefined,
      bill_no: billNo,
      bill_date: billDate,
      eway_no: ewayNo,
      total_bags: Number(totalBags),
      bill_weight: Number(billWeight || 0),
      amount: Number(charges.amount || 0),
      other_exp1: Number(charges.other_exp1 || 0),
      other_exp2: Number(charges.other_exp2 || 0),
      other_exp3: Number(charges.other_exp3 || 0),
      adhat_exp: Number(charges.adhat_exp || 0),
      dalali: Number(charges.dalali || 0),
      kkc: Number(charges.kkc || 0),
      mandi_tax: Number(charges.mandi_tax || 0),
      labour_exp: Number(charges.labour_exp || 0),
      transport_amount: Number(charges.transport_amount || 0),
      discount: Number(charges.discount || 0),
      remarks,
      ...computed,
    } as unknown as BillEntry;

    try {
      await create.mutateAsync(payload);
      toast.success('Bill created', { description: `Net ${formatCurrency(computed.net_amount)}` });
      router.back();
    } catch (error) {
      toast.error('Could not create the bill', { description: getErrorMessage(error) });
    }
  };

  if (grns.isLoading) {
    return (
      <Screen>
        <Header title="New bill" />
        <Loading label="Loading GRN line…" />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <Header
        title="New bill"
        subtitle={item ? `${lookups.commodityName(item.commodity_id)} · ${lookups.gradeName(item.grade_id)}` : 'GRN line'}
      />

      <Body>
        {item && (
          <Callout
            tone={remainingBags > 0 ? 'info' : 'warning'}
            icon="cube-outline"
            title={`${formatNumber(remainingBags)} of ${formatNumber(item.bags_used)} bags still to bill`}
            description={`GRN ${grn?.grn_id} · ${lookups.bagConfigName(item.bag_type_id)}`}
          />
        )}

        <Card>
          <SectionHeader title="Parties" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Company" required hint="The entity raising this purchase">
              <Select value={companyId} options={lookups.companyOptions} onChange={setCompanyId} title="Company" />
            </Field>
            <Field label="Party" required hint="Who the goods were bought from">
              <Select value={partyId} options={lookups.vendorOptions} onChange={setPartyId} title="Party" />
            </Field>
            {!!party && (
              <Text variant="caption" tone="muted">
                {party.state ? `${party.state} · ` : ''}
                {isIntraState(party.state) ? 'Intra-state — CGST + SGST' : 'Inter-state — IGST'}
              </Text>
            )}
          </View>
        </Card>

        <Card>
          <SectionHeader title="Bill" />
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Bill no" required style={{ flex: 1 }}>
                <Input value={billNo} onChangeText={setBillNo} autoCapitalize="characters" />
              </Field>
              <Field label="Bill date" required style={{ flex: 1 }}>
                <DateField value={billDate} onChange={setBillDate} />
              </Field>
            </View>

            <Field label="E-way no" hint="12 digits, if applicable">
              <Input
                value={ewayNo}
                onChangeText={setEwayNo}
                keyboardType="number-pad"
                error={Boolean(ewayNo) && !isValidEwayNumber(ewayNo)}
              />
            </Field>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field
                label="Total bags"
                required
                style={{ flex: 1 }}
                error={totalBags !== '' && Number(totalBags) > remainingBags ? `Max ${remainingBags}` : undefined}
              >
                <NumberInput
                  value={totalBags}
                  onChangeValue={setTotalBags}
                  error={totalBags !== '' && Number(totalBags) > remainingBags}
                />
              </Field>
              <Field label="Bill weight" style={{ flex: 1 }}>
                <NumberInput value={billWeight} onChangeValue={setBillWeight} suffix="kg" />
              </Field>
            </View>

            <Field label="Goods amount" required hint="Before expenses and GST">
              <NumberInput
                value={charges.amount}
                onChangeValue={(value) => setCharges({ ...charges, amount: value })}
                suffix="₹"
              />
            </Field>
          </View>
        </Card>

        <Card>
          <Accordion title="Expenses" caption="All expense lines are taxable">
            <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}>
              {EXPENSE_FIELDS.map((expense) => (
                <Field key={expense.key} label={expense.label}>
                  <NumberInput
                    value={charges[expense.key]}
                    onChangeValue={(value) => setCharges({ ...charges, [expense.key]: value })}
                    suffix="₹"
                  />
                </Field>
              ))}
            </View>
          </Accordion>
        </Card>

        <Card>
          <SectionHeader title="Tax and settlement" />
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="GST rate" style={{ flex: 1 }}>
                <NumberInput value={taxRate} onChangeValue={setTaxRate} suffix="%" />
              </Field>
              <Field label="Discount" style={{ flex: 1 }}>
                <NumberInput
                  value={charges.discount}
                  onChangeValue={(value) => setCharges({ ...charges, discount: value })}
                  suffix="₹"
                />
              </Field>
            </View>
            <Field label="Remarks">
              <Input value={remarks} onChangeText={setRemarks} />
            </Field>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Summary" />
          <DetailRow label="Rate" value={computed.rate ? `${formatCurrency(computed.rate)}/kg` : null} />
          <DetailRow label="Before GST" value={formatCurrency(computed.amount_before_gst)} />
          {computed.igst > 0 ? (
            <DetailRow label="IGST" value={formatCurrency(computed.igst)} />
          ) : (
            <>
              <DetailRow label="CGST" value={formatCurrency(computed.cgst)} />
              <DetailRow label="SGST" value={formatCurrency(computed.sgst)} />
            </>
          )}
          <DetailRow label="After GST" value={formatCurrency(computed.amount_after_gst)} />
          <DetailRow label="Discount" value={formatCurrency(Number(charges.discount || 0))} />
          <DetailRow label="Net payable" value={formatCurrency(computed.net_amount)} emphasis />
        </Card>
      </Body>

      <ActionBar>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button label="Create bill" style={{ flex: 2 }} loading={create.isPending} onPress={submit} />
      </ActionBar>
    </Screen>
  );
}
