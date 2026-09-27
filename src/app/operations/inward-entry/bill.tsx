import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useAgents } from '@/api/masters-api';
import {
  useBillEntriesByGrn,
  useCreateBillEntry,
  useGenerateGrnEntry,
  useInwardEntries,
  useUpdateBillEntry,
  type BillEntry,
} from '@/api/operations-api';
import { getErrorMessage } from '@/api/request';
import { Button } from '@/components/ui/button';
import { Card, SectionHeader } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { EmptyState, Loading } from '@/components/ui/feedback';
import { Field, Input, NumberInput } from '@/components/ui/field';
import { Accordion, Callout, DetailRow } from '@/components/ui/misc';
import { Select, type Option } from '@/components/ui/select';
import { ActionBar, Body, Header, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { computeBill, isIntraState, isValidEwayNumber } from '@/features/operations/bill-maths';
import { isInwardLocked } from '@/features/operations/inward';
import { useMasterLookups } from '@/features/operations/lookups';
import { usePermissions } from '@/hooks/use-permissions';
import { useSyncedState } from '@/hooks/use-synced-state';
import { formatCurrency, formatNumber, today } from '@/lib/format';
import { useTheme } from '@/theme';

type Num = number | '';

interface FormState {
  bill_no: string;
  bill_date: string;
  eway_no: string;
  company_id: string;
  party_id: string;
  agent_id: string;
  grade_id: string;
  total_bags: Num;
  bill_weight: Num;
  amount: Num;
  adhat_exp: Num;
  dalali: Num;
  kkc: Num;
  mandi_tax: Num;
  labour_exp: Num;
  transport_amount: Num;
  other_exp1: Num;
  other_exp2: Num;
  other_exp3: Num;
  discount: Num;
  tax_rate: Num;
  baradana_type_id: string;
  freight_type_id: string;
  remarks: string;
}

const EXPENSES: { key: keyof FormState; label: string }[] = [
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

const BARADANA: Option[] = [
  { value: 'returnable', label: 'Returnable' },
  { value: 'non-returnable', label: 'Non-returnable' },
];
const FREIGHT: Option[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
];

/** Changeable after inward — none of them touches quantities or valuation. */
const PAPERWORK = ['bill_no', 'bill_date', 'eway_no', 'agent_id', 'remarks'] as const;

const num = (value: Num | undefined) => Number(value || 0);
const orBlank = (value?: number | null): Num => (value ? value : '');

/**
 * The GST rate a saved bill was computed with. The web form resets it to 5 %
 * on every edit and silently re-taxes the bill on save; this keeps the rate
 * the bill actually carries.
 */
const inferTaxRate = (bill: BillEntry): Num => {
  if (!bill.amount_before_gst) return 5;
  const tax = (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0);
  return Math.round((tax / bill.amount_before_gst) * 10000) / 100;
};

const fromBill = (bill: BillEntry): FormState => ({
  bill_no: bill.bill_no ?? '',
  bill_date: bill.bill_date ? String(bill.bill_date).slice(0, 10) : today(),
  eway_no: bill.eway_no ?? '',
  company_id: String(bill.company_id ?? ''),
  party_id: String(bill.party_id ?? ''),
  agent_id: String(bill.agent_id ?? ''),
  grade_id: bill.grade_id ?? '',
  total_bags: orBlank(bill.total_bags),
  bill_weight: orBlank(bill.bill_weight),
  amount: orBlank(bill.amount),
  adhat_exp: orBlank(bill.adhat_exp),
  dalali: orBlank(bill.dalali),
  kkc: orBlank(bill.kkc),
  mandi_tax: orBlank(bill.mandi_tax),
  labour_exp: orBlank(bill.labour_exp),
  transport_amount: orBlank(bill.transport_amount),
  other_exp1: orBlank(bill.other_exp1),
  other_exp2: orBlank(bill.other_exp2),
  other_exp3: orBlank(bill.other_exp3),
  discount: orBlank(bill.discount),
  tax_rate: inferTaxRate(bill),
  baradana_type_id: bill.baradana_type_id ?? '',
  freight_type_id: bill.freight_type_id ?? '',
  remarks: bill.remarks ?? '',
});

/**
 * Purchase bill for a GRN — create and edit, as in the web's bill entry form.
 *
 * Totals recompute on every keystroke and ride in the action bar, because the
 * number checked against the paper bill is the net amount. Once inward entries
 * exist for the GRN only the paperwork fields stay editable.
 */
export default function BillEntryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { grn: grnId, id } = useLocalSearchParams<{ grn: string; id?: string }>();
  const isEdit = Boolean(id);
  const lookups = useMasterLookups();
  const { can } = usePermissions();
  const agents = useAgents(can('agent:read'));

  const grnQuery = useGenerateGrnEntry(grnId);
  const billsQuery = useBillEntriesByGrn(grnId);
  const inwards = useInwardEntries();
  const create = useCreateBillEntry();
  const update = useUpdateBillEntry();

  const grn = grnQuery.data;
  const bills = useMemo(() => billsQuery.data ?? [], [billsQuery.data]);
  const editItem = isEdit ? bills.find((bill) => bill._id === id) : undefined;
  const paperworkOnly = Boolean(grn && isInwardLocked(grn, inwards.data ?? []));

  const firstLine = grn?.entries?.[0];
  const blank = (): FormState => ({
    ...fromBill({} as BillEntry),
    bill_date: today(),
    grade_id: firstLine?.grade_id ?? '',
    tax_rate: 5,
  });

  const [form, setForm] = useSyncedState<FormState>(
    isEdit ? (editItem?._id ?? null) : grn ? `new:${grn._id}` : null,
    () => (editItem ? fromBill(editItem) : blank())
  );
  const [error, setError] = useState<{ key: keyof FormState; message: string } | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (error?.key === key) setError(null);
  };

  /** Grades on this GRN; a bill is always for one of them. */
  const gradeOptions = useMemo<Option[]>(() => {
    const ids = [...new Set((grn?.entries ?? []).map((line) => line.grade_id))];
    return ids.map((gradeId) => ({ value: gradeId, label: lookups.gradeName(gradeId) }));
  }, [grn?.entries, lookups]);

  /** Stock is held per company group, so a company outside every group cannot be billed. */
  const companyOptions = useMemo<Option[]>(() => {
    const grouped = new Set(lookups.raw.companyGroups.flatMap((group) => group.company_ids ?? []));
    return lookups.companyOptions.map((option) =>
      grouped.has(option.value) ? option : { ...option, disabled: true, description: 'Not in a company group yet' }
    );
  }, [lookups]);

  const partyOptions = useMemo<Option[]>(
    () =>
      lookups.raw.vendors
        .filter((vendor) => !vendor.category?.length || vendor.category.includes('seller'))
        .map((vendor) => ({ value: vendor._id, label: vendor.vendor_name, description: vendor.state || undefined }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    [lookups.raw.vendors]
  );

  const agentOptions = useMemo<Option[]>(
    () =>
      (agents.data ?? [])
        .map((agent) => ({ value: agent._id, label: agent.agent_name, description: agent.mobile_no || undefined }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    [agents.data]
  );

  /** Bags of this grade on the GRN less what the other bills already claim. */
  const gradeBags = (grn?.entries ?? [])
    .filter((line) => line.grade_id === form.grade_id)
    .reduce((sum, line) => sum + (line.bags_used || 0), 0);
  const claimedByOthers = bills
    .filter((bill) => bill._id !== editItem?._id && bill.grade_id === form.grade_id)
    .reduce((sum, bill) => sum + (bill.total_bags || 0), 0);
  const remainingBags = gradeBags - claimedByOthers;

  const party = lookups.raw.vendors.find((vendor) => vendor._id === form.party_id);
  const computed = computeBill(
    {
      amount: num(form.amount),
      other_exp1: num(form.other_exp1),
      other_exp2: num(form.other_exp2),
      other_exp3: num(form.other_exp3),
      adhat_exp: num(form.adhat_exp),
      dalali: num(form.dalali),
      kkc: num(form.kkc),
      mandi_tax: num(form.mandi_tax),
      labour_exp: num(form.labour_exp),
      transport_amount: num(form.transport_amount),
      discount: num(form.discount),
      bill_weight: num(form.bill_weight),
    },
    { taxRatePercent: num(form.tax_rate), partyState: party?.state, hasParty: Boolean(party) }
  );

  const validate = (): { key: keyof FormState; message: string } | null => {
    if (!form.company_id) return { key: 'company_id', message: 'Company is required' };
    if (!form.party_id) return { key: 'party_id', message: 'Party is required' };
    if (!form.bill_no.trim()) return { key: 'bill_no', message: 'Bill no is required' };
    if (!form.grade_id) return { key: 'grade_id', message: 'Grade is required' };
    if (!num(form.total_bags)) return { key: 'total_bags', message: 'Total bags must be greater than 0' };
    if (!paperworkOnly && num(form.total_bags) > remainingBags) {
      return { key: 'total_bags', message: `Cannot exceed the ${remainingBags} bags of this grade still to bill` };
    }
    if (!isValidEwayNumber(form.eway_no)) return { key: 'eway_no', message: 'E-way no must be exactly 12 digits' };
    return null;
  };

  const payloadFor = (): Partial<BillEntry> => {
    const line = (grn?.entries ?? []).find((entry) => entry.grade_id === form.grade_id);
    const full: Partial<BillEntry> = {
      grn_id: grn?._id,
      bill_number: editItem?.bill_number ?? bills.reduce((max, bill) => Math.max(max, bill.bill_number || 0), 0) + 1,
      commodity_id: line?.commodity_id ?? editItem?.commodity_id ?? '',
      company_id: form.company_id,
      party_id: form.party_id,
      agent_id: form.agent_id,
      bill_no: form.bill_no.trim(),
      bill_date: form.bill_date as unknown as Date,
      eway_no: form.eway_no.trim(),
      grade_id: form.grade_id,
      total_bags: num(form.total_bags),
      bill_weight: num(form.bill_weight),
      amount: num(form.amount),
      other_exp1: num(form.other_exp1),
      other_exp2: num(form.other_exp2),
      other_exp3: num(form.other_exp3),
      adhat_exp: num(form.adhat_exp),
      dalali: num(form.dalali),
      kkc: num(form.kkc),
      mandi_tax: num(form.mandi_tax),
      labour_exp: num(form.labour_exp),
      transport_amount: num(form.transport_amount),
      discount: num(form.discount),
      baradana_type_id: form.baradana_type_id,
      freight_type_id: form.freight_type_id,
      remarks: form.remarks,
      ...computed,
    };
    if (paperworkOnly) {
      return Object.fromEntries(PAPERWORK.map((key) => [key, full[key]])) as Partial<BillEntry>;
    }
    return full;
  };

  const submit = async (another: boolean) => {
    const failure = validate();
    if (failure) {
      setError(failure);
      toast.error(failure.message);
      return;
    }
    try {
      if (editItem) {
        await update.mutateAsync({ id: editItem._id, data: payloadFor() });
        toast.success(`Bill ${form.bill_no} updated`);
        router.back();
      } else {
        await create.mutateAsync(payloadFor() as BillEntry);
        toast.success(`Bill ${form.bill_no} added`, { description: `Net ${formatCurrency(computed.net_amount)}` });
        if (another) {
          setForm(blank());
          setError(null);
        } else {
          router.back();
        }
      }
    } catch (err) {
      toast.error(editItem ? 'Could not update the bill' : 'Could not add the bill', {
        description: getErrorMessage(err),
      });
    }
  };

  if (grnQuery.isLoading || billsQuery.isLoading) {
    return (
      <Screen>
        <Header title={isEdit ? 'Edit bill' : 'New bill'} />
        <Loading label="Loading GRN…" />
      </Screen>
    );
  }

  if (!grn || (isEdit && !editItem)) {
    return (
      <Screen>
        <Header title={isEdit ? 'Edit bill' : 'New bill'} />
        <EmptyState icon="alert-circle-outline" title="Not found" description="The GRN or bill may have been deleted." />
      </Screen>
    );
  }

  const errorFor = (key: keyof FormState) => (error?.key === key ? error.message : undefined);
  const locked = paperworkOnly;
  const createMaster = (module: string) =>
    !locked && can(`${module}:create`) ? () => router.push(`/masters/${module}/new` as never) : undefined;
  const avgWeight = num(form.total_bags) ? num(form.bill_weight) / num(form.total_bags) : 0;
  const saving = create.isPending || update.isPending;

  return (
    <Screen edges={['top']}>
      <Header
        title={isEdit ? `Edit bill ${editItem?.bill_no ?? ''}` : 'New bill'}
        subtitle={`GRN ${grn.grn_id} · ${formatNumber(grn.total_bags)} bags`}
      />

      <Body bottomOffset={140}>
        {locked && (
          <Callout
            tone="info"
            title="Only paperwork can change"
            description="Inward entries exist for this GRN, so company, party, grade, quantities and amounts are locked. Bill no, date, e-way no, agent and remarks can still be corrected."
          />
        )}

        <Card>
          <SectionHeader title="Bill" caption={`Entry #${editItem?.bill_number ?? bills.reduce((max, bill) => Math.max(max, bill.bill_number || 0), 0) + 1}`} />
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Bill no" required error={errorFor('bill_no')} style={{ flex: 1 }}>
                <Input
                  value={form.bill_no}
                  onChangeText={(value) => set('bill_no', value)}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={Boolean(errorFor('bill_no'))}
                />
              </Field>
              <Field label="Bill date" style={{ flex: 1.2 }}>
                <DateField value={form.bill_date} onChange={(value) => set('bill_date', value)} />
              </Field>
            </View>
            <Field label="E-way no" hint="12 digits, if the load has one" error={errorFor('eway_no')}>
              <Input
                value={form.eway_no}
                onChangeText={(value) => set('eway_no', value.replace(/\D/g, '').slice(0, 12))}
                keyboardType="number-pad"
                maxLength={12}
                error={Boolean(errorFor('eway_no')) || (form.eway_no.length > 0 && !isValidEwayNumber(form.eway_no))}
              />
            </Field>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Parties" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Company" required error={errorFor('company_id')}>
              <Select
                value={form.company_id}
                options={companyOptions}
                onChange={(value) => set('company_id', value)}
                title="Company"
                disabled={locked}
                error={Boolean(errorFor('company_id'))}
                onCreate={createMaster('company')}
                createLabel="Add company"
              />
            </Field>
            <Field label="Party" required error={errorFor('party_id')} hint={party ? `${party.state || 'State not set'} · ${isIntraState(party.state) ? 'CGST + SGST' : 'IGST'}` : 'Sellers only'}>
              <Select
                value={form.party_id}
                options={partyOptions}
                onChange={(value) => set('party_id', value)}
                title="Party"
                disabled={locked}
                error={Boolean(errorFor('party_id'))}
                onCreate={createMaster('vendor')}
                createLabel="Add vendor"
              />
            </Field>
            <Field label="Agent">
              <Select
                value={form.agent_id}
                options={agentOptions}
                onChange={(value) => set('agent_id', value)}
                title="Agent"
                clearable
                onCreate={can('agent:create') ? () => router.push('/masters/agent/new' as never) : undefined}
                createLabel="Add agent"
              />
            </Field>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Quantity and price" />
          <View style={{ gap: theme.spacing.lg }}>
            <Field label="Grade" required error={errorFor('grade_id')}>
              <Select
                value={form.grade_id}
                options={gradeOptions}
                onChange={(value) => set('grade_id', value)}
                title="Grade"
                disabled={locked}
                error={Boolean(errorFor('grade_id'))}
              />
            </Field>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field
                label="Total bags"
                required
                style={{ flex: 1 }}
                hint={locked ? undefined : `Up to ${formatNumber(Math.max(0, remainingBags))}`}
                error={errorFor('total_bags')}
              >
                <NumberInput
                  value={form.total_bags}
                  onChangeValue={(value) => set('total_bags', value === '' ? '' : Math.floor(value))}
                  keyboardType="number-pad"
                  readOnly={locked}
                  error={Boolean(errorFor('total_bags')) || (!locked && num(form.total_bags) > remainingBags)}
                />
              </Field>
              <Field label="Bill weight" style={{ flex: 1.2 }}>
                <NumberInput value={form.bill_weight} onChangeValue={(value) => set('bill_weight', value)} suffix="kg" readOnly={locked} />
              </Field>
            </View>
            <Field label="Goods amount" hint="Before expenses and GST">
              <NumberInput value={form.amount} onChangeValue={(value) => set('amount', value)} suffix="₹" readOnly={locked} />
            </Field>
            <View>
              <DetailRow label="Average weight" value={avgWeight ? `${formatNumber(avgWeight, 2)} kg/bag` : null} />
              <DetailRow label="Average rate" value={computed.rate ? `${formatCurrency(computed.rate)}/kg` : null} />
            </View>
          </View>
        </Card>

        <Card>
          <Accordion title="Expenses" caption="All taxable, added before GST" defaultOpen={isEdit && EXPENSES.some((e) => num(form[e.key] as Num) > 0)}>
            <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}>
              {Array.from({ length: Math.ceil(EXPENSES.length / 2) }, (_, row) => (
                <View key={row} style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                  {EXPENSES.slice(row * 2, row * 2 + 2).map((expense) => (
                    <Field key={expense.key} label={expense.label} style={{ flex: 1 }}>
                      <NumberInput
                        value={form[expense.key] as Num}
                        onChangeValue={(value) => set(expense.key, value as never)}
                        suffix="₹"
                        readOnly={locked}
                      />
                    </Field>
                  ))}
                  {row * 2 + 1 >= EXPENSES.length && <View style={{ flex: 1 }} />}
                </View>
              ))}
            </View>
          </Accordion>
        </Card>

        <Card>
          <SectionHeader title="Tax and settlement" />
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="GST rate" style={{ flex: 1 }}>
                <NumberInput value={form.tax_rate} onChangeValue={(value) => set('tax_rate', value)} suffix="%" readOnly={locked} />
              </Field>
              <Field label="Discount" style={{ flex: 1 }}>
                <NumberInput value={form.discount} onChangeValue={(value) => set('discount', value)} suffix="₹" readOnly={locked} />
              </Field>
            </View>
            <View>
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
              <DetailRow label="Net payable" value={formatCurrency(computed.net_amount)} emphasis />
            </View>
            {!party && <Text variant="caption" tone="faint">GST is worked out once a party is chosen.</Text>}
            {editItem && (editItem.adjustment_bags || editItem.adjustment_weight || editItem.adjustment_amount) ? (
              <Callout
                tone="info"
                title="This bill carries adjustments"
                description={`${formatNumber(editItem.adjustment_bags ?? 0)} bags · ${formatNumber(editItem.adjustment_weight ?? 0, 2)} kg · ${formatCurrency(editItem.adjustment_amount ?? 0)}. They are kept as they are; change them on the web.`}
              />
            ) : null}
          </View>
        </Card>

        <Card>
          <SectionHeader title="Other" />
          <View style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Field label="Baradana" style={{ flex: 1 }}>
                <Select value={form.baradana_type_id} options={BARADANA} onChange={(value) => set('baradana_type_id', value)} title="Baradana type" disabled={locked} />
              </Field>
              <Field label="Freight" style={{ flex: 1 }}>
                <Select value={form.freight_type_id} options={FREIGHT} onChange={(value) => set('freight_type_id', value)} title="Freight type" disabled={locked} />
              </Field>
            </View>
            <Field label="Remarks">
              <Input value={form.remarks} onChangeText={(value) => set('remarks', value)} multiline />
            </Field>
          </View>
        </Card>
      </Body>

      <ActionBar
        summary={
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="caption" tone="muted">
              {formatNumber(num(form.total_bags))} bags · {formatNumber(num(form.bill_weight), 2)} kg
            </Text>
            <Text variant="bodyStrong" tone="primary" numeric>
              Net {formatCurrency(computed.net_amount)}
            </Text>
          </View>
        }
      >
        {isEdit ? (
          <>
            <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => router.back()} />
            <Button label="Save changes" style={{ flex: 2 }} loading={saving} onPress={() => void submit(false)} />
          </>
        ) : (
          <>
            <Button label="Save & add another" variant="outline" style={{ flex: 1 }} loading={create.isPending} onPress={() => void submit(true)} />
            <Button label="Save bill" style={{ flex: 1 }} loading={create.isPending} onPress={() => void submit(false)} />
          </>
        )}
      </ActionBar>
    </Screen>
  );
}
